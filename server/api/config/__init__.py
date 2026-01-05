from fastapi import APIRouter

from .global_config import router as global_router
from .local_models import router as local_models_router
from .models import router as models_router
from .ollama import router as ollama_router
from .prompts import router as prompts_router
from .system import router as system_router
from .user import router as user_router
from .validation import router as validation_router
from .whisper_models import router as whisper_models_router

router = APIRouter()

# Include all sub-routers
router.include_router(prompts_router)
router.include_router(global_router)
router.include_router(validation_router)
router.include_router(ollama_router)
router.include_router(models_router)
router.include_router(user_router)
router.include_router(system_router)
router.include_router(local_models_router)
router.include_router(whisper_models_router)
