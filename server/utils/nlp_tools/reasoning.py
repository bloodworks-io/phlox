import json
import logging

from server.database.config.defaults.prompts import DEFAULT_PROMPTS
from server.database.config.manager import config_manager
from server.schemas.grammars import ClinicalReasoning
from server.utils.chat.tools import execute_tool_non_streaming, get_tools_definition
from server.utils.helpers import calculate_age
from server.utils.llm_client import repair_json
from server.utils.llm_client.client import get_llm_client

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

    tools = get_tools_definition([])

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
    conversation = [{"role": "user", "content": initial_prompt}]

    # Yield initial status
    yield {"type": "status", "message": "Analyzing clinical data..."}

    # Loop for tool calls
    while tool_iterations < max_tool_iterations:
        response = await client.chat(
            model=config["REASONING_MODEL"],
            messages=conversation,
            tools=tools,
            options=reasoning_options,
        )

        tool_calls = response.get("tool_calls") or response["message"].get("tool_calls")
        if not tool_calls:
            if tool_iterations == 0:
                logger.info("Clinical reasoning: LLM did not request any tools")
            break

        if tool_iterations == 0:
            logger.info(f"Clinical reasoning: LLM requested {len(tool_calls)} tool call(s)")

        logger.info(f"Reasoning tool iteration {tool_iterations + 1}/{max_tool_iterations}")

        conversation.append(response["message"])

        # Execute each tool call and yield status
        for tool_call in tool_calls:
            try:
                function_name = tool_call["function"]["name"]

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

                result, tool_citations = await execute_tool_non_streaming(tool_call, config)
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

    reasoning = final_response["message"].get("reasoning")
    if reasoning:
        content_dict["thinking"] = reasoning

    if citations:
        content_dict["citations"] = citations
        logger.info(f"Clinical reasoning: Added {len(citations)} citation(s) to output")

    result = ClinicalReasoning.model_validate(content_dict)

    # Yield final result
    yield {"type": "result", "data": result.dict()}
