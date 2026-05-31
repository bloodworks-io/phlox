"""Shared test configuration — initializes the test database before collection."""

from server.database.core.connection import initialize_database

initialize_database()
