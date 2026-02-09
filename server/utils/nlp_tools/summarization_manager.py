import asyncio
import logging
import time
from typing import Dict

logger = logging.getLogger(__name__)


class SummarizationManager:
    """Manages per-patient summarization tasks with deduplication.

    Ensures that only the latest task for a given patient is processed,
    preventing redundant LLM calls when the same patient is saved multiple times
    in quick succession.
    """

    def __init__(self) -> None:
        # Map of patient_id -> asyncio.Lock
        self._locks: Dict[int, asyncio.Lock] = {}
        # Map of patient_id -> latest task token (timestamp as string)
        self._latest_tokens: Dict[int, str] = {}

    def _ensure_patient_initialized(self, patient_id: int) -> None:
        """Ensures a patient has their lock and token initialized."""
        if patient_id not in self._locks:
            self._locks[patient_id] = asyncio.Lock()
            self._latest_tokens[patient_id] = ""

    def generate_token(self) -> str:
        """Generate a unique task token based on timestamp.

        Returns:
            A string representing the current time with high precision.
        """
        return f"{time.time()}"

    async def should_process(self, patient_id: int, task_token: str) -> bool:
        """Check if a task should proceed (not stale).

        Args:
            patient_id: The ID of the patient to check.
            task_token: The token for this task (timestamp string).

        Returns:
            True if this is the latest task for this patient and should proceed,
            False if a newer task has already been registered.
        """
        self._ensure_patient_initialized(patient_id)

        async with self._locks[patient_id]:
            # Empty token means no task is currently registered
            if self._latest_tokens[patient_id] == "":
                # First task - register and proceed
                self._latest_tokens[patient_id] = task_token
                logger.info(
                    f"Registered first summarization task for patient {patient_id}"
                )
                return True

            # Compare tokens as floats (timestamps) - newer is greater
            current_token = float(self._latest_tokens[patient_id])
            new_token = float(task_token)

            if new_token > current_token:
                # This is a newer task - replace the old one
                self._latest_tokens[patient_id] = task_token
                logger.info(
                    f"Registered newer summarization task for patient {patient_id} "
                    f"(replacing stale task)"
                )
                return True
            else:
                # This is an older task - skip it
                logger.info(
                    f"Skipping stale summarization task for patient {patient_id} "
                    f"(task token {task_token} < latest {self._latest_tokens[patient_id]})"
                )
                return False

    async def mark_complete(self, patient_id: int) -> None:
        """Mark a task as complete, clearing the token for this patient.

        Args:
            patient_id: The ID of the patient whose task is complete.
        """
        self._ensure_patient_initialized(patient_id)
        async with self._locks[patient_id]:
            self._latest_tokens[patient_id] = ""
            logger.debug(
                f"Cleared summarization task token for patient {patient_id}"
            )


# Global instance
summarization_manager = SummarizationManager()
