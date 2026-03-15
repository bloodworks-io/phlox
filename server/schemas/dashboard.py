from pydantic import BaseModel


class TodoItem(BaseModel):
    """
    Represents a single to-do item.

    Attributes:
        id (Optional[int]): Unique identifier for the to-do item.
        task (str): Description of the task.
        completed (bool): Indicates whether the task is completed.
    """

    id: int | None = None
    task: str
    completed: bool = False
