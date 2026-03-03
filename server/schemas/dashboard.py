from pydantic import BaseModel, HttpUrl


class Task(BaseModel):
    """
    Represents a task item.

    Attributes:
        id (int): The unique identifier for the task.
        task (str): The description or content of the task.
        completed (bool): The completion status of the task.
    """

    id: int
    task: str
    completed: bool


class RssFeed(BaseModel):
    """
    Represents an RSS feed.

    Attributes:
        id (Optional[int]): The unique identifier for the RSS feed. Defaults to None.
        url (HttpUrl): The URL of the RSS feed.
        title (Optional[str]): The title of the RSS feed. Defaults to None.
    """

    id: int | None = None
    url: HttpUrl
    title: str | None = None


class RssFeedList(BaseModel):
    feeds: list[RssFeed]


class RssItem(BaseModel):
    """
    Represents an item within an RSS feed.

    Attributes:
        title (str): The title of the RSS item.
        link (HttpUrl): The URL link to the full content of the RSS item.
        description (Optional[str]): A brief description or summary of the RSS item. Defaults to None.
        published (Optional[str]): The publication date of the RSS item. Defaults to None.
    """

    title: str
    link: HttpUrl
    description: str
    published: str
    feed_title: str | None = None
    added_at: str | None = None


class RssFeedRefreshRequest(BaseModel):
    feed_id: int | None = None


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
