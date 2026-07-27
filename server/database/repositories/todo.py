from server.database.core.connection import get_db


def add_todo_item(task: str) -> dict:
    with get_db().transaction() as cursor:
        cursor.execute("INSERT INTO todos (task, completed) VALUES (?, ?)", (task, False))
        todo_id = cursor.lastrowid
    return {"id": todo_id, "task": task, "completed": False}


def get_todo_items() -> list[dict]:
    with get_db().read() as cursor:
        cursor.execute("SELECT id, task, completed FROM todos")
        return [
            {"id": row[0], "task": row[1], "completed": bool(row[2])} for row in cursor.fetchall()
        ]


def update_todo_item(todo_id: int, task: str, completed: bool) -> dict:
    with get_db().transaction() as cursor:
        cursor.execute(
            "UPDATE todos SET task = ?, completed = ? WHERE id = ?",
            (task, completed, todo_id),
        )
    return {"id": todo_id, "task": task, "completed": completed}


def delete_todo_item(todo_id: int):
    with get_db().transaction() as cursor:
        cursor.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
