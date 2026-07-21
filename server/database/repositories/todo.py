from server.database.core.connection import get_db


def add_todo_item(task: str) -> dict:
    get_db().cursor.execute("INSERT INTO todos (task, completed) VALUES (?, ?)", (task, False))
    todo_id = get_db().cursor.lastrowid
    get_db().commit()
    return {"id": todo_id, "task": task, "completed": False}


def get_todo_items() -> list[dict]:
    get_db().cursor.execute("SELECT id, task, completed FROM todos")
    todos = [
        {"id": row[0], "task": row[1], "completed": bool(row[2])}
        for row in get_db().cursor.fetchall()
    ]
    return todos


def update_todo_item(todo_id: int, task: str, completed: bool) -> dict:
    get_db().cursor.execute(
        "UPDATE todos SET task = ?, completed = ? WHERE id = ?",
        (task, completed, todo_id),
    )
    get_db().commit()
    return {"id": todo_id, "task": task, "completed": completed}


def delete_todo_item(todo_id: int):
    get_db().cursor.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
    get_db().commit()
