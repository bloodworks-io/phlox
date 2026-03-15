import json
import logging
import re

from server.database.config.defaults.prompts import DEFAULT_PROMPTS
from server.database.config.manager import config_manager
from server.schemas.grammars import ClinicalReasoning
from server.utils.chat.tools import execute_tool_non_streaming, get_tools_definition
from server.utils.helpers import calculate_age
from server.utils.llm_client import repair_json
from server.utils.llm_client.client import get_llm_client
from server.utils.rag.chroma import get_chroma_manager

# Set up module-level logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


async def stream_clinical_reasoning_with_tools(
    template_data: dict,
    dob: str,
    encounter_date: str,
    gender: str,
    ur_number: str | None = None,
    max_tool_iterations: int = 10,
):
    """Stream clinical reasoning with real-time status updates.

    An async generator that yields status updates and the final result.
    Yields dictionaries with 'type' key:
    - {'type': 'status', 'message': '...'} for status updates
    - {'type': 'result', 'data': ClinicalReasoning} for final result

    Args:
        template_data: Dictionary of clinical note sections
        dob: Patient date of birth
        encounter_date: Date of the encounter
        gender: Patient gender ('M' or 'F')
        ur_number: Patient UR number (for looking up previous encounters)
        max_tool_iterations: Maximum number of tool calls to make (default: 10)

    Yields:
        dict: Status updates and final result
    """
    config = config_manager.get_config()
    prompts = config_manager.get_prompts_and_options()
    client = get_llm_client()

    age = calculate_age(dob, encounter_date)
    reasoning_options = prompts["options"].get("reasoning", {})
    reasoning_prompt = DEFAULT_PROMPTS["prompts"]["reasoning"]["system"]

    # Format the clinical note
    formatted_note = ""
    for section_name, content in template_data.items():
        if content:
            section_title = section_name.replace("_", " ").title()
            formatted_note += f"{section_title}:\n{content}\n\n"

    # Get available collections for literature search
    chroma_mgr = get_chroma_manager()
    collection_names = chroma_mgr.list_collections() if chroma_mgr else []

    tools = get_tools_definition(collection_names, exclude_chat_only=True)

    patient_info = f"Demographics: {age} year old {"male" if gender == "M" else "female"}"
    if ur_number:
        patient_info += f"\nUR Number: {ur_number}"
    if encounter_date:
        patient_info += f"\nCurrent Encounter Date: {encounter_date}"

    initial_prompt = f"""{reasoning_prompt}

Analyze this case:

{patient_info}

Clinical Note:
```
{formatted_note}
```

Act as an educational peer-reviewer. You may use tools like PubMed search, wiki_search (for general info, use 1-2 word queries), or get_previous_encounter (pass the UR number and current encounter date to exclude same-day notes) to find relevant information before providing your analysis.
Highlight potential documentation gaps and provide standard literature correlations to broaden the consideration set."""

    tool_iterations = 0
    citations: list[str] = []
    reasoning_trace: list[str] = []
    conversation = [{"role": "user", "content": initial_prompt}]

    def _coerce_text(value) -> str:
        if value is None:
            return ""

        if isinstance(value, str):
            return value.strip()

        if isinstance(value, list):
            parts: list[str] = []
            for item in value:
                if isinstance(item, str):
                    parts.append(item.strip())
                elif isinstance(item, dict):
                    text_part = item.get("text") or item.get("content")
                    if text_part:
                        parts.append(str(text_part).strip())
            return "\n".join([p for p in parts if p]).strip()

        if isinstance(value, dict):
            text_part = value.get("content") or value.get("text") or value.get("reasoning")
            if text_part is not None:
                return _coerce_text(text_part)
            return json.dumps(value)

        return str(value).strip()

    def _coerce_stream_piece(value) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            parts: list[str] = []
            for item in value:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    text_part = item.get("text") or item.get("content")
                    if text_part:
                        parts.append(str(text_part))
            return "".join(parts)
        if isinstance(value, dict):
            text_part = value.get("content") or value.get("text") or value.get("reasoning")
            if text_part is not None:
                return _coerce_stream_piece(text_part)
            return json.dumps(value)
        return str(value)

    def _truncate_for_trace(text: str, max_len: int = 700) -> str:
        if len(text) <= max_len:
            return text
        return f"{text[:max_len]} ...[truncated]"

    def _append_trace_step(step: str) -> None:
        text = _coerce_text(step)
        if not text:
            return
        if reasoning_trace and reasoning_trace[-1] == text:
            return
        reasoning_trace.append(text)

    def _strip_think_markers(text: str) -> str:
        if not text:
            return ""
        # Strip only marker tokens while preserving inner thought content.
        marker_pattern = (
            r"</?(?:think|thinking|reason|reasoning|thought|Thought)>"
            r"|<\|begin_of_thought\|>"
            r"|<\|end_of_thought\|>"
            r"|◁/?think▷"
        )
        return re.sub(marker_pattern, "", text, flags=re.IGNORECASE)

    def _append_reasoning(value, label: str = "Reasoning snapshot") -> None:
        text = _coerce_text(value)
        if not text:
            return
        text = _strip_think_markers(text)
        text = " ".join(text.split())
        if not text:
            return
        text = _truncate_for_trace(text)
        _append_trace_step(f"{label}:\n{text}")



    # Yield initial status
    yield {"type": "status", "message": "Analyzing clinical data..."}

    # Loop for tool calls
    while tool_iterations < max_tool_iterations:
        stream = await client.chat(
            model=config["REASONING_MODEL"],
            messages=conversation,
            tools=tools,
            options=reasoning_options,
            stream=True,
        )

        accumulated_reasoning = ""
        accumulated_content = ""
        accumulated_tool_calls = {}

        async for chunk in stream:
            if "message" not in chunk:
                continue

            msg = chunk["message"]

            reasoning_piece = (
                msg.get("reasoning")
                or msg.get("reasoning_content")
                or msg.get("thinking")
            )
            if reasoning_piece:
                accumulated_reasoning += _coerce_stream_piece(reasoning_piece)

            if msg.get("content"):
                accumulated_content += _coerce_stream_piece(msg.get("content"))

            if "tool_calls" in msg and msg["tool_calls"]:
                for tc in msg["tool_calls"]:
                    if hasattr(tc, "index"):
                        idx = tc.index
                        if idx not in accumulated_tool_calls:
                            accumulated_tool_calls[idx] = {
                                "id": getattr(tc, "id", ""),
                                "type": getattr(tc, "type", "function"),
                                "function": {"name": "", "arguments": ""},
                            }

                        if hasattr(tc, "function") and tc.function:
                            if hasattr(tc.function, "name") and tc.function.name:
                                accumulated_tool_calls[idx]["function"]["name"] += tc.function.name
                            if hasattr(tc.function, "arguments") and tc.function.arguments:
                                accumulated_tool_calls[idx]["function"]["arguments"] += tc.function.arguments
                    elif isinstance(tc, dict):
                        idx = tc.get("index", len(accumulated_tool_calls))
                        if idx not in accumulated_tool_calls:
                            accumulated_tool_calls[idx] = {
                                "id": tc.get("id", ""),
                                "type": tc.get("type", "function"),
                                "function": {"name": "", "arguments": ""},
                            }

                        function_payload = tc.get("function", {}) or {}
                        name_part = function_payload.get("name", "")
                        args_part = function_payload.get("arguments", "")

                        if name_part:
                            accumulated_tool_calls[idx]["function"]["name"] += name_part
                        if args_part:
                            accumulated_tool_calls[idx]["function"]["arguments"] += args_part
                        if tc.get("id"):
                            accumulated_tool_calls[idx]["id"] = tc.get("id")
                        if tc.get("type"):
                            accumulated_tool_calls[idx]["type"] = tc.get("type")

        accumulated_reasoning = _strip_think_markers(accumulated_reasoning).strip()
        accumulated_content = _strip_think_markers(accumulated_content).strip()
        tool_calls = [v for k, v in sorted(accumulated_tool_calls.items())]

        assistant_message = {"role": "assistant", "content": accumulated_content or ""}
        if accumulated_reasoning:
            assistant_message["reasoning"] = accumulated_reasoning
        if tool_calls:
            assistant_message["tool_calls"] = tool_calls
        conversation.append(assistant_message)

        if tool_calls:
            _append_trace_step(
                f"Iteration {tool_iterations + 1}: model requested {len(tool_calls)} tool call(s)"
            )
            _append_reasoning(accumulated_reasoning, label="Pre-tool reasoning")
            if not accumulated_reasoning:
                _append_reasoning(accumulated_content, label="Pre-tool assistant note")
        else:
            _append_reasoning(
                accumulated_reasoning or accumulated_content,
                label="Final non-tool reasoning",
            )
            if tool_iterations == 0:
                logger.info("Clinical reasoning: LLM did not request any tools")
            break

        if tool_iterations == 0:
            logger.info(f"Clinical reasoning: LLM requested {len(tool_calls)} tool call(s)")

        logger.info(f"Reasoning tool iteration {tool_iterations + 1}/{max_tool_iterations}")

        # Execute each tool call and yield status
        for tool_call in tool_calls:
            try:
                function_name = tool_call["function"]["name"]
                function_args = _truncate_for_trace(
                    _coerce_text(tool_call.get("function", {}).get("arguments"))
                )
                _append_trace_step(
                    f"Tool call: {function_name}"
                    + (f" | args: {function_args}" if function_args else "")
                )

                # Yield status update based on tool type
                if function_name == "pubmed_search":
                    yield {"type": "status", "message": "Searching PubMed..."}
                elif function_name == "wiki_search":
                    yield {"type": "status", "message": "Searching Wikipedia..."}
                elif function_name == "get_previous_encounter":
                    yield {"type": "status", "message": "Retrieving previous encounters..."}
                elif function_name == "get_relevant_literature":
                    yield {"type": "status", "message": "Searching clinical guidelines..."}
                elif function_name.startswith("mcp_"):
                    tool_display = function_name.replace("mcp_", "").replace("_", " ")
                    yield {"type": "status", "message": f"Running {tool_display}..."}
                else:
                    yield {"type": "status", "message": f"Processing {function_name}..."}

                result, tool_citations = await execute_tool_non_streaming(tool_call, config, chroma_manager=get_chroma_manager())
                result_preview = _truncate_for_trace(_coerce_text(result))
                _append_trace_step(f"Tool result: {function_name}\n{result_preview}")
                if tool_citations:
                    citations.extend(tool_citations)
                tool_id = tool_call.get("id", "")
                conversation.append({
                    "role": "tool",
                    "tool_call_id": tool_id,
                    "content": result,
                })
            except Exception as e:
                logger.error(f"Error executing tool in reasoning: {e}")
                _append_trace_step(f"Tool error: {function_name} -> {str(e)}")
                tool_id = tool_call.get("id", "")
                conversation.append({
                    "role": "tool",
                    "tool_call_id": tool_id,
                    "content": f"Error executing tool: {str(e)}",
                })

        tool_iterations += 1

    if tool_iterations > 0:
        logger.info(
            f"Clinical reasoning: Completed {tool_iterations} tool iteration(s), generating final response"
        )

    # Final JSON schema instruction
    json_schema_instruction = (
        "Output MUST be ONLY valid JSON with top-level keys "
        '"thinking" (string), "summary" (string), '
        '"differentials" (array of objects with "suggestion", "rationale", and "critical" keys), '
        '"investigations" (array of objects with "suggestion", "rationale", and "critical" keys), '
        '"clinical_considerations" (array of objects with "suggestion", "rationale", and "critical" keys). '
        "The 'critical' field is a boolean - set to true ONLY for potentially fatal or urgent misses. "
        "Example: "
        + json.dumps(
            {
                "thinking": "...",
                "summary": "...",
                "differentials": [
                    {
                        "suggestion": "Diagnosis name",
                        "rationale": ["reason 1", "reason 2"],
                        "critical": False,
                    }
                ],
                "investigations": [
                    {
                        "suggestion": "Test name",
                        "rationale": ["reason 1"],
                        "critical": False,
                    }
                ],
                "clinical_considerations": [
                    {
                        "suggestion": "Critical consideration",
                        "rationale": ["reason 1"],
                        "critical": True,
                    }
                ],
            }
        )
    )

    conversation.append(
        {
            "role": "user",
            "content": f"\n\n{json_schema_instruction}\n\nNow provide your final analysis as valid JSON.",
        }
    )

    # Yield final status
    yield {"type": "status", "message": "Generating final analysis..."}

    final_response = await client.chat(
        model=config["REASONING_MODEL"],
        messages=conversation,
        format=ClinicalReasoning.model_json_schema(),
        options=reasoning_options,
    )

    raw_content = final_response["message"]["content"]
    repaired_content = repair_json(raw_content)
    content_dict = json.loads(repaired_content)

    accumulated_thinking = "\n\n".join([entry for entry in reasoning_trace if entry]).strip()
    accumulated_thinking = _strip_think_markers(accumulated_thinking).strip()
    if len(accumulated_thinking) > 15000:
        accumulated_thinking = accumulated_thinking[-15000:]

    reasoning = final_response["message"].get("reasoning")
    if accumulated_thinking:
        content_dict["thinking"] = accumulated_thinking
    elif reasoning:
        content_dict["thinking"] = _coerce_text(reasoning)

    if citations:
        content_dict["citations"] = citations
        logger.info(f"Clinical reasoning: Added {len(citations)} citation(s) to output")

    result = ClinicalReasoning.model_validate(content_dict)

    # Yield final result
    yield {"type": "result", "data": result.dict()}
