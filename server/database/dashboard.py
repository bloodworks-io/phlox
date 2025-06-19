from server.database.connection import db
import logging


def add_rss_feed(url: str, title: str):
    """Adds an RSS feed to the database."""
    db.cursor.execute(
        "INSERT INTO rss_feeds (url, title) VALUES (?, ?)", (url, title)
    )
    db.commit()


def get_rss_feeds():
    """Retrieves all RSS feeds from the database."""
    db.cursor.execute("SELECT * FROM rss_feeds")
    return [dict(row) for row in db.cursor.fetchall()]


def add_todo(task: str):
    """Adds a to-do item to the database."""
    db.cursor.execute("INSERT INTO todos (task) VALUES (?)", (task,))
    db.commit()


def get_todos():
    """Retrieves all to-do items from the database."""
    db.cursor.execute("SELECT * FROM todos")
    return [dict(row) for row in db.cursor.fetchall()]


def add_rss_item(
    feed_id: int,
    title: str,
    link: str,
    description: str,
    published: str,
    digest: str,
):
    """Adds an RSS item to the database."""
    db.cursor.execute(
        "INSERT INTO rss_items (feed_id, title, link, description, published, digest) VALUES (?, ?, ?, ?, ?, ?)",
        (feed_id, title, link, description, published, digest),
    )
    db.commit()


def get_rss_items(feed_id: int = None):
    """Retrieves RSS items from the database, optionally filtered by feed ID."""
    if feed_id:
        db.cursor.execute(
            "SELECT * FROM rss_items WHERE feed_id = ?", (feed_id,)
        )
    else:
        db.cursor.execute("SELECT * FROM rss_items")
    return [dict(row) for row in db.cursor.fetchall()]


def get_patients_with_outstanding_jobs_and_summaries():
    """Retrieves patients with outstanding jobs and their summaries."""
    try:
        db.cursor.execute(
            """
            SELECT id, encounter_summary, encounter_date
            FROM patients
            WHERE all_jobs_completed = 0
        """
        )
        rows = db.cursor.fetchall()
        patients_data = [dict(row) for row in rows]
        return patients_data
    except Exception as e:
        logging.error(f"Database error fetching patient data: {e}")
        raise
