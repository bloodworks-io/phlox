"""Shared test configuration — initializes the test database before collection."""

import pytest

from server.database.core.connection import initialize_database
from server.utils.current_user import CurrentUser, set_current_user

initialize_database()

TEST_CLINICIAN = CurrentUser(910001, "test_clinician", "clinician")
TEST_ADMIN = CurrentUser(910002, "test_admin", "admin")


@pytest.fixture
def clinician_ctx():
    """Run the test as a low-privilege clinician."""
    set_current_user(TEST_CLINICIAN)
    yield
    set_current_user(None)


@pytest.fixture
def admin_ctx():
    """Run the test as an administrator."""
    set_current_user(TEST_ADMIN)
    yield
    set_current_user(None)
