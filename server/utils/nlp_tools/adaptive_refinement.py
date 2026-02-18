import json
import logging
from posixpath import basename
from typing import List, Optional

import Levenshtein
from server.database.config.manager import config_manager
from server.schemas.grammars import ConsolidatedInstructions
from server.utils.llm_client import repair_json
from server.utils.llm_client.client import get_llm_client

logger = logging.getLogger(__name__)

# Maximum number of instructions after consolidation
MAX_INSTRUCTIONS = 8


async def generate_adaptive_refinement_suggestions(
    initial_content: str,
    modified_content: str,
    existing_instructions: Optional[List[str]] = None,
    model_name: Optional[str] = None,
    change_threshold: float = 0.4,
) -> List[str]:
    """
    Generates adaptive refinement suggestions by comparing initial and modified content,
    and manages a running list of unique instructions using LLM tools.

    Args:
        initial_content: The original text before refinement
        modified_content: The refined text after modifications
        existing_instructions: Previous refinement instructions to build upon
        model_name: Optional model name override (uses config default if not provided)
        change_threshold: Minimum change ratio to trigger adaptive refinement

    Returns:
        List of refined instructions based on observed improvements
    """
    logger.info(
        f"Generating adaptive refinement suggestions. Initial content length: {len(initial_content)}, "
        f"Modified content length: {len(modified_content)} "
    )

    if not modified_content.strip():
        logger.warning(
            "Modified content is empty. Returning existing instructions."
        )
        return existing_instructions or []

    if initial_content == modified_content:
        logger.info(
            "Initial and modified content are identical. Returning existing instructions."
        )
        return existing_instructions or []

    # Check if content has changed enough to warrant adaptive refinement
    change_ratio = calculate_content_change_ratio(
        initial_content, modified_content
    )
    if change_ratio < change_threshold:
        logger.info(
            f"Content change ratio {change_ratio:.2f} is below threshold {change_threshold}. Skipping adaptive refinement."
        )
        return existing_instructions or []

    # Get configuration and client
    config = config_manager.get_config()
    client = get_llm_client()
    prompts = config_manager.get_prompts_and_options()
    options = prompts["options"]["general"].copy()
    options.pop("stop", None)  # Remove stop tokens for tool calls

    # Get default model from config if not specified
    model_name = model_name or config.get("PRIMARY_MODEL")

    # Initialize with existing instructions
    current_instructions = (
        list(existing_instructions) if existing_instructions else []
    )

    # Auto-consolidate if approaching the limit
    if len(current_instructions) >= MAX_INSTRUCTIONS:
        logger.info(
            f"Instruction count ({len(current_instructions)}) >= {MAX_INSTRUCTIONS}, "
            "triggering auto-consolidation"
        )
        consolidation_result = await consolidate_adaptive_instructions(
            instructions=current_instructions,
            field_key="auto",
            field_name="Auto-consolidation",
            model_name=model_name,
        )
        consolidated = consolidation_result["consolidated_instructions"]
        logger.info(f"Consolidated instructions: {consolidated}")
        return consolidated

    # Create system prompt for tool-based instruction management
    system_prompt = """You are an expert writing analyst. Your task is to compare two versions of text, identify specific improvements made, and make ONE targeted update to a list of writing refinement instructions.

    You will be provided with:
    1. Original and improved text versions
    2. Current list of refinement instructions

    Your goal is to make EXACTLY ONE change to the instruction list based on the most important improvement you observe. You can:
    - Delete an existing instruction and replace it with a new one (if an existing instruction doesn't capture the key improvement)
    - Modify an existing instruction to make it more precise (if it's close but needs refinement)
    - Add one new instruction (only if under the maximum limit and the improvement isn't captured by existing instructions)
    - Keep the list unchanged (if it already captures the improvements well)

    Focus on the MOST SIGNIFICANT improvement observed:
    - Grammar and syntax improvements
    - Style and clarity enhancements
    - Conciseness and word choice
    - Structure and flow improvements
    - Medical/technical terminology usage (if applicable)

    Each individual instruction should be:
    - Specific and actionable
    - A single short and concise sentence.
    - General enough to apply to other texts
    - Based on actual improvements observed

    Make only ONE change that captures the most important improvement."""

    # Prepare instruction list display
    instructions_display = _format_instructions_for_display(
        current_instructions
    )

    user_prompt = f"""Compare these two versions of text and make ONE targeted update to the refinement instruction list:

    ORIGINAL VERSION:
    ---
    {initial_content}
    ---

    IMPROVED VERSION:
    ---
    {modified_content}
    ---

    CURRENT INSTRUCTION LIST:
    {instructions_display}

    Based on the most significant improvement you observe, use ONE of the available tools to update the instruction list. Choose the single most important change that would help capture this type of improvement in future refinements."""

    # Define tools for instruction management
    tools = _get_instruction_management_tools()

    base_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        response = await client.chat(
            model=model_name,
            messages=base_messages,
            tools=tools,
            options=options,
        )

        # Process tool calls to update instructions (limited to one change)
        updated_instructions = await _process_single_tool_call(
            response, current_instructions, client, model_name, options
        )

        logger.info(f"Final updated instructions: {updated_instructions}")
        return updated_instructions

    except Exception as e:
        logger.error(f"Error during LLM call or processing: {e}", exc_info=True)
        return existing_instructions or []


def _get_instruction_management_tools():
    """Define tools for managing refinement instructions."""
    return [
        {
            "type": "function",
            "function": {
                "name": "replace_instruction",
                "description": "Delete an existing instruction and replace it with a new one",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "index_to_replace": {
                            "type": "integer",
                            "description": "The index (0-based) of the instruction to replace",
                        },
                        "new_instruction": {
                            "type": "string",
                            "description": "The new instruction to add in place of the old one",
                        },
                    },
                    "required": ["index_to_replace", "new_instruction"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "modify_instruction",
                "description": "Modify an existing instruction to make it more precise or accurate",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "index_to_modify": {
                            "type": "integer",
                            "description": "The index (0-based) of the instruction to modify",
                        },
                        "modified_instruction": {
                            "type": "string",
                            "description": "The updated version of the instruction",
                        },
                    },
                    "required": ["index_to_modify", "modified_instruction"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "add_instruction",
                "description": "Add a new instruction to the list (only if under the maximum limit)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "new_instruction": {
                            "type": "string",
                            "description": "The new instruction to add to the list",
                        }
                    },
                    "required": ["new_instruction"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "keep_unchanged",
                "description": "Keep the current instruction list as-is (no changes needed)",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
    ]


def _format_instructions_for_display(instructions: List[str]) -> str:
    """Format instruction list for display to the LLM."""
    if not instructions:
        return "No current instructions."

    formatted = []
    for i, instruction in enumerate(instructions):
        formatted.append(f"{i}: {instruction}")

    return "\n".join(formatted)


async def _process_single_tool_call(
    response,
    current_instructions: List[str],
    client,
    model_name: str,
    options: dict,
) -> List[str]:
    """Process a single tool call to update the instruction list."""

    # Get tool calls from response
    config = config_manager.get_config()

    # Import the enum for proper comparison
    from server.utils.llm_client import LLMProviderType

    if (
        config.get("LLM_PROVIDER", "ollama").lower()
        == LLMProviderType.OPENAI_COMPATIBLE.value
    ):
        tool_calls = response["message"].get("tool_calls")
    else:
        tool_calls = response.get("tool_calls")

    if not tool_calls:
        logger.info("LLM chose to keep instructions unchanged (no tool calls)")
        return current_instructions

    # Only process the first tool call
    if len(tool_calls) > 1:
        logger.warning(
            f"LLM made {len(tool_calls)} tool calls, but only processing the first one"
        )

    tool_call = tool_calls[0]
    logger.info(f"Processing single tool call: {tool_call['function']['name']}")

    # Work with a copy of current instructions
    updated_instructions = current_instructions.copy()

    function_name = tool_call["function"]["name"]

    # Parse arguments
    try:
        if isinstance(tool_call["function"]["arguments"], str):
            function_arguments = json.loads(tool_call["function"]["arguments"])
        else:
            function_arguments = tool_call["function"]["arguments"]
    except json.JSONDecodeError:
        logger.error("Failed to parse function arguments JSON")
        return current_instructions

    logger.info(
        f"Processing tool call: {function_name} with args: {function_arguments}"
    )

    if function_name == "replace_instruction":
        index = function_arguments.get("index_to_replace")
        new_instruction = function_arguments.get("new_instruction")

        if 0 <= index < len(updated_instructions):
            logger.info(
                f"Replacing instruction at index {index}: '{updated_instructions[index]}' -> '{new_instruction}'"
            )
            updated_instructions[index] = new_instruction
        else:
            logger.warning(f"Invalid index {index} for replace_instruction")

    elif function_name == "modify_instruction":
        index = function_arguments.get("index_to_modify")
        modified_instruction = function_arguments.get("modified_instruction")

        if 0 <= index < len(updated_instructions):
            logger.info(
                f"Modifying instruction at index {index}: '{updated_instructions[index]}' -> '{modified_instruction}'"
            )
            updated_instructions[index] = modified_instruction
        else:
            logger.warning(f"Invalid index {index} for modify_instruction")

    elif function_name == "add_instruction":
        new_instruction = function_arguments.get("new_instruction")

        if len(updated_instructions) < MAX_INSTRUCTIONS:
            logger.info(f"Adding new instruction: '{new_instruction}'")
            updated_instructions.append(new_instruction)
        else:
            logger.warning(
                f"Cannot add instruction - already at maximum ({MAX_INSTRUCTIONS})"
            )

    elif function_name == "keep_unchanged":
        logger.info("LLM chose to keep instructions unchanged")
        return current_instructions

    # Ensure uniqueness while preserving order
    unique_instructions = []
    seen = set()

    for instruction in updated_instructions:
        instruction_clean = instruction.strip()
        if instruction_clean and instruction_clean.lower() not in seen:
            unique_instructions.append(instruction_clean)
            seen.add(instruction_clean.lower())

    # Enforce maximum limit
    if len(unique_instructions) > MAX_INSTRUCTIONS:
        unique_instructions = unique_instructions[:MAX_INSTRUCTIONS]
        logger.info(
            f"Truncated instructions to maximum limit of {MAX_INSTRUCTIONS}"
        )

    return unique_instructions


def calculate_content_change_ratio(
    initial_content: str, modified_content: str
) -> float:
    """
    Calculate the ratio of content that has changed using Levenshtein distance.

    Args:
        initial_content: The original text
        modified_content: The modified text

    Returns:
        Float between 0 and 1 representing the proportion of content that changed
    """
    if not initial_content and not modified_content:
        return 0.0

    if not initial_content or not modified_content:
        return 1.0

    # Calculate similarity ratio using Levenshtein
    similarity = Levenshtein.ratio(initial_content, modified_content)
    change_ratio = 1.0 - similarity

    logger.info(
        f"Levenshtein similarity for adaptive refinement: {similarity:.3f}, change ratio: {change_ratio:.3f}"
    )

    return change_ratio


async def consolidate_adaptive_instructions(
    instructions: List[str],
    field_key: str,
    field_name: str,
    model_name: Optional[str] = None,
) -> dict:
    """
    Consolidate a list of adaptive refinement instructions into a clean,
    non-contradictory set of concise instructions.

    This function analyzes accumulated instructions and generates an optimized
    set that removes contradictions, merges redundancy, simplifies complexity,
    and generalizes over-specific instructions.

    Args:
        instructions: Current list of instructions to consolidate
        field_key: Field identifier (e.g., "plan", "clinical_history")
        field_name: Human-readable field name for context
        model_name: Optional model override (uses config default if not provided)

    Returns:
        dict with keys:
        - consolidated_instructions: List of 3-8 clean instructions
        - changes_made: List of change descriptions
        - reason: Explanation of consolidation approach
    """
    logger.info(
        f"Consolidating {len(instructions)} instructions for field '{field_key}' ({field_name})"
    )

    if not instructions:
        return {
            "consolidated_instructions": [],
            "changes_made": [],
            "reason": "No instructions to consolidate",
        }

    # Get configuration and client
    config = config_manager.get_config()
    client = get_llm_client()
    prompts = config_manager.get_prompts_and_options()
    options = prompts["options"]["general"].copy()

    # Get default model from config if not specified
    model_name = model_name or config.get("PRIMARY_MODEL")

    # Build consolidation system prompt
    system_prompt = """You are an expert at consolidating writing refinement instructions. Your task is to analyze a list of adaptive refinement instructions and produce a clean, optimized set.

    ANALYZE the input instructions for:
    1. **Contradictions** - Instructions that conflict with each other (e.g., "omit dosages" vs "use precise dosages")
    2. **Redundancy** - Similar instructions that can be merged
    3. **Complexity** - Multi-clause instructions that should be simplified
    4. **Over-specificity** - Instructions that reference specific examples instead of general principles

    CONSOLIDATION RULES:
    - Remove contradictions by keeping the more specific/actionable instruction
    - Merge similar instructions into a single, comprehensive one
    - Simplify multi-clause instructions to one sentence or split if truly distinct
    - Convert specific examples to general principles (e.g., "Trace PP in one lab..." -> "Clarify lab result discrepancies")
    - Each instruction must be ONE sentence only (prefer under 25 words)
    - Start each instruction with a verb (action-oriented)
    - Keep only instructions that provide actionable guidance

    OUTPUT:
    Return 3-8 instructions that capture the essence of the input without conflicts or redundancy.
    If the input is already good quality (no contradictions, concise, generalizable), return it unchanged.

    """

    # Add JSON schema instruction to ensure proper format
    json_schema_instruction = (
        "Output MUST be ONLY valid JSON with the following structure:\n"
        + json.dumps(
            {
                "consolidated_instructions": ["Instruction 1", "Instruction 2"],
                "changes_made": ["Merged similar instructions"],
                "reason": "Removed redundancy and clarified language",
            }
        )
    )

    instructions_display = "\n".join(
        [f"{i}: {inst}" for i, inst in enumerate(instructions)]
    )

    user_prompt = f"""Consolidate the following adaptive refinement instructions for the '{field_name}' field:

    CURRENT INSTRUCTIONS:
    {instructions_display}

    Produce an optimized set of instructions that removes contradictions, merges redundancy, and ensures each instruction is concise and generalizable."""

    messages = [
        {
            "role": "system",
            "content": system_prompt + "\n\n" + json_schema_instruction,
        },
        {"role": "user", "content": user_prompt},
    ]

    try:
        # Use structured output for deterministic results
        response_schema = ConsolidatedInstructions.model_json_schema()

        result = await client.chat_with_structured_output(
            model=model_name,
            messages=messages,
            schema=response_schema,
            options=options,
        )

        # Repair JSON for flaky endpoints before validation
        if isinstance(result, str):
            result = repair_json(result)
        else:
            result = json.dumps(result)

        # Parse the response
        consolidated = ConsolidatedInstructions.model_validate_json(result)

        logger.info(
            f"Consolidated {len(instructions)} instructions to {len(consolidated.consolidated_instructions)}"
        )
        logger.info(f"Changes: {consolidated.changes_made}")
        logger.info(f"Reason: {consolidated.reason}")

        return {
            "consolidated_instructions": consolidated.consolidated_instructions,
            "changes_made": consolidated.changes_made,
            "reason": consolidated.reason,
        }

    except Exception as e:
        logger.error(f"Error during consolidation: {e}", exc_info=True)
        # Return original instructions on error
        return {
            "consolidated_instructions": instructions,
            "changes_made": [],
            "reason": f"Consolidation failed: {str(e)}",
        }
