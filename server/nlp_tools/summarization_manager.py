import asyncio
import logging
import time

logger = logging.getLogger(__name__)


class SummarizationManager:
    """Manages per-patient summarization tasks with deduplication.

    Ensures that only the latest task for a given patient is processed,
    preventing redundant LLM calls when the same patient is saved multiple times
    in quick succession.
    """

    def __init__(self) -> None:
        # Map of note_id -> asyncio.Lock
        self._locks: dict[int, asyncio.Lock] = {}
        # Map of note_id -> latest task token (timestamp as string)
        self._latest_tokens: dict[int, str] = {}

    def _ensure_patient_initialized(self, note_id: int) -> None:
        """Ensures a patient has their lock and token initialized."""
        if note_id not in self._locks:
            self._locks[note_id] = asyncio.Lock()
            self._latest_tokens[note_id] = ""

    def generate_token(self) -> str:
        """Generate a unique task token based on timestamp.

        Returns:
            A string representing the current time with high precision.
        """
        return f"{time.time()}"

    async def should_process(self, note_id: int, task_token: str) -> bool:
        """Check if a task should proceed (not stale).

        Args:
            note_id: The ID of the patient to check.
            task_token: The token for this task (timestamp string).

        Returns:
            True if this is the latest task for this patient and should proceed,
            False if a newer task has already been registered.
        """
        self._ensure_patient_initialized(note_id)

        async with self._locks[note_id]:
            # Empty token means no task is currently registered
            if self._latest_tokens[note_id] == "":
                # First task - register and proceed
                self._latest_tokens[note_id] = task_token
                logger.info(f"Registered first summarization task for patient {note_id}")
                return True

            # Compare tokens as floats (timestamps) - newer is greater
            current_token = float(self._latest_tokens[note_id])
            new_token = float(task_token)

            if new_token > current_token:
                # This is a newer task - replace the old one
                self._latest_tokens[note_id] = task_token
                logger.info(
                    f"Registered newer summarization task for patient {note_id} "
                    f"(replacing stale task)"
                )
                return True
            else:
                # This is an older task - skip it
                logger.info(
                    f"Skipping stale summarization task for patient {note_id} "
                    f"(task token {task_token} < latest {self._latest_tokens[note_id]})"
                )
                return False

    async def mark_complete(self, note_id: int) -> None:
        """Mark a task as complete, clearing the token for this patient.

        Args:
            note_id: The ID of the patient whose task is complete.
        """
        self._ensure_patient_initialized(note_id)
        async with self._locks[note_id]:
            self._latest_tokens[note_id] = ""
            logger.debug(f"Cleared summarization task token for patient {note_id}")


# Global instance
summarization_manager = SummarizationManager()
