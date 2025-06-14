from server.database.connection import PatientDatabase
from typing import List, Dict
from icalendar import Calendar, Todo
from datetime import datetime
from pathlib import Path
from server.constants import DATA_DIR
import os

db = PatientDatabase()
ICS_FILE_PATH = DATA_DIR / "todos.ics"


def update_ics_file():
    """Update the ICS file with current todo items"""
    cal = Calendar()
    todos = get_todo_items()
    for todo in todos:
        vtodo = Todo()
        vtodo.add("summary", todo["task"])
        vtodo.add("dtstamp", datetime.now())
        vtodo.add(
            "status", "COMPLETED" if todo["completed"] else "NEEDS-ACTION"
        )
        vtodo["uid"] = f"todo-{todo['id']}@example.com"
        cal.add_component(vtodo)

    ICS_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)

    with open(ICS_FILE_PATH, "wb") as f:
        f.write(cal.to_ical())


def add_todo_item(task: str) -> Dict:
    db.cursor.execute(
        "INSERT INTO todos (task, completed) VALUES (?, ?)", (task, False)
    )
    todo_id = db.cursor.lastrowid
    db.commit()
    update_ics_file()
    return {"id": todo_id, "task": task, "completed": False}


def get_todo_items() -> List[Dict]:
    db.cursor.execute("SELECT id, task, completed FROM todos")
    todos = [
        {"id": row[0], "task": row[1], "completed": bool(row[2])}
        for row in db.cursor.fetchall()
    ]
    return todos


def update_todo_item(todo_id: int, task: str, completed: bool) -> Dict:
    db.cursor.execute(
        "UPDATE todos SET task = ?, completed = ? WHERE id = ?",
        (task, completed, todo_id),
    )
    db.commit()
    update_ics_file()
    return {"id": todo_id, "task": task, "completed": completed}


def delete_todo_item(todo_id: int):
    db.cursor.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
    db.commit()
    update_ics_file()


# Ensure the data directory exists
os.makedirs(os.path.dirname(ICS_FILE_PATH), exist_ok=True)

# Initialize the ICS file if it doesn't exist
if not os.path.exists(ICS_FILE_PATH):
    update_ics_file()
