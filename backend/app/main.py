import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes.transcript import router as transcript_router
from app.api.routes.practices import router as practices_router
from app.api.routes.vocabulary import router as vocabulary_router
from app.api.routes.word import router as word_router
from app.api.routes.tts import router as tts_router
from app.api.routes.ai_config import router as ai_config_router
from app.core.config import Settings, get_settings
from app.db.database import Database
from app.services.qwen_text import QwenTextService
from app.services.qwen_vision import QwenVisionService
from app.services.session_store import SessionStore
from app.services.tts_service import TtsService
from app.services.env_config_service import EnvConfigService
from app.services.vocabulary_audio import backfill_vocabulary_pronunciations


def create_app(settings: Settings | None = None) -> FastAPI:
    active_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(active_app: FastAPI):
        task = asyncio.create_task(
            backfill_vocabulary_pronunciations(
                active_app.state.database,
                active_app.state.tts_service,
                active_app.state.settings,
            )
        )
        active_app.state.vocabulary_audio_backfill_task = task
        yield
        if not task.done():
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    app = FastAPI(title=active_settings.app_name, version="0.1.0", lifespan=lifespan)
    app.state.settings = active_settings
    app.state.database = Database(active_settings.database_path)
    app.state.session_store = SessionStore(active_settings.data_dir)
    app.state.qwen_vision_service = QwenVisionService(active_settings)
    app.state.qwen_text_service = QwenTextService(active_settings)
    app.state.tts_service = TtsService(active_settings)
    app.state.env_config_service = EnvConfigService(active_settings.env_write_path)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=active_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(transcript_router)
    app.include_router(practices_router)
    app.include_router(vocabulary_router)
    app.include_router(word_router)
    app.include_router(tts_router)
    app.include_router(ai_config_router)
    app.mount(
        "/audio/playground",
        StaticFiles(directory=app.state.tts_service.output_dir),
        name="tts-playground-audio",
    )

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
