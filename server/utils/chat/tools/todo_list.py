"""
Todo list tool implementation.

This tool allows the LLM to access and manage the user's global todo list.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from server.database.entities.todo import (
    add_todo_item,
    delete_todo_item,
    get_todo_items,
    update_todo_item,
)
from server.utils.chat.streaming.response import (
    end_message,
    status_message,
    stream_llm_response,
    tool_response_message,
)

logger = logging.getLogger(__name__)

TODO_LIST_TOOL_NAME = "todo_list"


def format_todos_list(todos: list[dict]) -> str:
    """Format todos list for display.

    Args:
        todos: List of todo items

    Returns:
        Formatted string
    """
    if not todos:
        return "No todos in the list."

    lines = ["Todo List:"]
    for todo in todos:
        status = "✓" if todo.get("completed") else "○"
        lines.append(f"  {status} [{todo.get('id')}] {todo.get('task')}")

    return "\n".join(lines)


async def execute(
    tool_call: dict[str, Any],
    llm_client,
    config: dict[str, Any],
    message_list: list,
    context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """Execute the todo_list tool.

    Args:
        tool_call: The tool call to execute
        llm_client: The LLM client instance
        config: The configuration dictionary
        message_list: The current message list
        context_question_options: The context question options

    Yields:
        Dict[str, Any]: Streaming response chunks
    """
    logger.info("Executing todo_list tool...")

    # Parse function arguments
    function_arguments = {}
    if "arguments" in tool_call["function"]:
        try:
            if isinstance(tool_call["function"]["arguments"], str):
                function_arguments = json.loads(tool_call["function"]["arguments"])
            else:
                function_arguments = tool_call["function"]["arguments"]
        except json.JSONDecodeError:
            logger.error("Failed to parse function arguments JSON")

    action = function_arguments.get("action", "list")
    task = function_arguments.get("task")
    todo_id = function_arguments.get("todo_id")

    result_content: str = ""
    citations: list[str] = []

    try:
        if action == "list":
            yield status_message("Retrieving todo list...")
            todos = get_todo_items()
            result_content = format_todos_list(todos)
            logger.info(f"Retrieved {len(todos)} todos")

        elif action == "add":
            yield status_message("Adding todo item...")
            if not task:
                result_content = "Error: Task description is required for 'add' action."
            else:
                new_todo = add_todo_item(task)
                result_content = f"Added todo: {task} (ID: {new_todo['id']})"
                citations.append(f"Added todo: {task}")
                logger.info(f"Added todo: {task}")

        elif action == "complete":
            yield status_message("Completing todo item...")
            if not todo_id:
                result_content = "Error: todo_id is required for 'complete' action."
            else:
                # Get the current todo first
                todos = get_todo_items()
                todo = next((t for t in todos if t["id"] == todo_id), None)
                if todo:
                    update_todo_item(todo_id, todo["task"], True)
                    result_content = f"Completed todo: {todo['task']}"
                    citations.append(f"Completed: {todo['task']}")
                    logger.info(f"Completed todo ID {todo_id}")
                else:
                    result_content = f"Error: Todo with ID {todo_id} not found."

        elif action == "delete":
            yield status_message("Deleting todo item...")
            if not todo_id:
                result_content = "Error: todo_id is required for 'delete' action."
            else:
                # Get the todo before deleting
                todos = get_todo_items()
                todo = next((t for t in todos if t["id"] == todo_id), None)
                if todo:
                    delete_todo_item(todo_id)
                    result_content = f"Deleted todo: {todo['task']}"
                    citations.append(f"Deleted: {todo['task']}")
                    logger.info(f"Deleted todo ID {todo_id}")
                else:
                    result_content = f"Error: Todo with ID {todo_id} not found."

        else:
            result_content = f"Error: Unknown action '{action}'. Valid actions are: list, add, complete, delete."

    except Exception as e:
        logger.error(f"Todo list error: {e}")
        result_content = f"Error managing todo list: {str(e)}"

    message_list.append(
        tool_response_message(
            tool_call_id=tool_call.get("id", ""),
            content=result_content,
        )
    )

    if llm_client is not None:
        yield status_message("Generating response...")
        async for chunk in stream_llm_response(
            llm_client=llm_client,
            model=config["PRIMARY_MODEL"],
            messages=message_list,
            options=context_question_options,
        ):
            yield chunk

    yield end_message(function_response={"content": result_content, "citations": citations})
