import logging
from posixpath import basename
from typing import List, Optional
import json
import Levenshtein

from server.utils.llm_client import get_llm_client
from server.database.config import config_manager

logger = logging.getLogger(__name__)

MAX_INSTRUCTIONS = 10

async def generate_adaptive_refinement_suggestions(
    initial_content: str,
    modified_content: str,
    existing_instructions: Optional[List[str]] = None,
    model_name: Optional[str] = None,
    change_threshold: float = 0.4
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
        f"Modified content length: {len(modified_content)}, "
        f"Existing instructions: {existing_instructions}"
    )

    if not modified_content.strip():
        logger.warning("Modified content is empty. Returning existing instructions.")
        return existing_instructions or []

    if initial_content == modified_content:
        logger.info("Initial and modified content are identical. Returning existing instructions.")
        return existing_instructions or []

    # Check if content has changed enough to warrant adaptive refinement
    change_ratio = calculate_content_change_ratio(initial_content, modified_content)
    if change_ratio < change_threshold:
        logger.info(f"Content change ratio {change_ratio:.2f} is below threshold {change_threshold}. Skipping adaptive refinement.")
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
    current_instructions = list(existing_instructions) if existing_instructions else []

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
    instructions_display = _format_instructions_for_display(current_instructions)

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
        {"role": "user", "content": user_prompt}
    ]

    try:
        response = await client.chat(
                model=model_name,
                messages=base_messages,
                tools=tools,
                options=options
            )

        # Process tool calls to update instructions (limited to one change)
        updated_instructions = await _process_single_tool_call(response, current_instructions, client, model_name, options)

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
                            "description": "The index (0-based) of the instruction to replace"
                        },
                        "new_instruction": {
                            "type": "string",
                            "description": "The new instruction to add in place of the old one"
                        }
                    },
                    "required": ["index_to_replace", "new_instruction"],
                    "additionalProperties": False
                },
                "strict": True
            }
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
                            "description": "The index (0-based) of the instruction to modify"
                        },
                        "modified_instruction": {
                            "type": "string",
                            "description": "The updated version of the instruction"
                        }
                    },
                    "required": ["index_to_modify", "modified_instruction"],
                    "additionalProperties": False
                },
                "strict": True
            }
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
                            "description": "The new instruction to add to the list"
                        }
                    },
                    "required": ["new_instruction"],
                    "additionalProperties": False
                },
                "strict": True
            }
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
                    "additionalProperties": False
                },
                "strict": True
            }
        }
    ]

def _format_instructions_for_display(instructions: List[str]) -> str:
    """Format instruction list for display to the LLM."""
    if not instructions:
        return "No current instructions."

    formatted = []
    for i, instruction in enumerate(instructions):
        formatted.append(f"{i}: {instruction}")

    return "\n".join(formatted)

async def _process_single_tool_call(response, current_instructions: List[str], client, model_name: str, options: dict) -> List[str]:
    """Process a single tool call to update the instruction list."""

    # Get tool calls from response
    config = config_manager.get_config()

    # Import the enum for proper comparison
    from server.utils.llm_client import LLMProviderType

    if config.get("LLM_PROVIDER", "ollama").lower() == LLMProviderType.OPENAI_COMPATIBLE.value:
        tool_calls = response["message"].get("tool_calls")
    else:
        tool_calls = response.get("tool_calls")

    if not tool_calls:
        logger.info("LLM chose to keep instructions unchanged (no tool calls)")
        return current_instructions

    # Only process the first tool call
    if len(tool_calls) > 1:
        logger.warning(f"LLM made {len(tool_calls)} tool calls, but only processing the first one")

    tool_call = tool_calls[0]
    logger.info(f"Processing single tool call: {tool_call['function']['name']}")

    # Work with a copy of current instructions
    updated_instructions = current_instructions.copy()

    function_name = tool_call['function']['name']

    # Parse arguments
    try:
        if isinstance(tool_call['function']['arguments'], str):
            function_arguments = json.loads(tool_call['function']['arguments'])
        else:
            function_arguments = tool_call['function']['arguments']
    except json.JSONDecodeError:
        logger.error("Failed to parse function arguments JSON")
        return current_instructions

    logger.info(f"Processing tool call: {function_name} with args: {function_arguments}")

    if function_name == "replace_instruction":
        index = function_arguments.get("index_to_replace")
        new_instruction = function_arguments.get("new_instruction")

        if 0 <= index < len(updated_instructions):
            logger.info(f"Replacing instruction at index {index}: '{updated_instructions[index]}' -> '{new_instruction}'")
            updated_instructions[index] = new_instruction
        else:
            logger.warning(f"Invalid index {index} for replace_instruction")

    elif function_name == "modify_instruction":
        index = function_arguments.get("index_to_modify")
        modified_instruction = function_arguments.get("modified_instruction")

        if 0 <= index < len(updated_instructions):
            logger.info(f"Modifying instruction at index {index}: '{updated_instructions[index]}' -> '{modified_instruction}'")
            updated_instructions[index] = modified_instruction
        else:
            logger.warning(f"Invalid index {index} for modify_instruction")

    elif function_name == "add_instruction":
        new_instruction = function_arguments.get("new_instruction")

        if len(updated_instructions) < MAX_INSTRUCTIONS:
            logger.info(f"Adding new instruction: '{new_instruction}'")
            updated_instructions.append(new_instruction)
        else:
            logger.warning(f"Cannot add instruction - already at maximum ({MAX_INSTRUCTIONS})")

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
        logger.info(f"Truncated instructions to maximum limit of {MAX_INSTRUCTIONS}")

    return unique_instructions

def calculate_content_change_ratio(initial_content: str, modified_content: str) -> float:
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

    logger.info(f"Levenshtein similarity for adaptive refinement: {similarity:.3f}, change ratio: {change_ratio:.3f}")

    return change_ratio
