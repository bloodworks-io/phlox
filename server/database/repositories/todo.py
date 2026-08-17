from server.database.core.connection import get_db
from server.utils.current_user import current_user_id, scoped


def add_todo_item(task: str) -> dict:
    with get_db().transaction() as cursor:
        cursor.execute(
            "INSERT INTO todos (task, completed, owner_id) VALUES (?, ?, ?)",
            (task, False, current_user_id()),
        )
        todo_id = cursor.lastrowid
    return {"id": todo_id, "task": task, "completed": False}


def get_todo_items() -> list[dict]:
    scope_sql, scope_params = scoped("owner_id")
    with get_db().read() as cursor:
        cursor.execute(f"SELECT id, task, completed FROM todos WHERE 1=1{scope_sql}", scope_params)
        return [
            {"id": row[0], "task": row[1], "completed": bool(row[2])} for row in cursor.fetchall()
        ]


def update_todo_item(todo_id: int, task: str, completed: bool) -> dict:
    scope_sql, scope_params = scoped("owner_id")
    with get_db().transaction() as cursor:
        cursor.execute(
            f"UPDATE todos SET task = ?, completed = ? WHERE id = ?{scope_sql}",
            (task, completed, todo_id, *scope_params),
        )
    return {"id": todo_id, "task": task, "completed": completed}


def delete_todo_item(todo_id: int):
    scope_sql, scope_params = scoped("owner_id")
    with get_db().transaction() as cursor:
        cursor.execute(f"DELETE FROM todos WHERE id = ?{scope_sql}", (todo_id, *scope_params))
