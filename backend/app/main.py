import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.v1.router import api_router
from app.db.seed import seed_flex, init_reconcile_tables, seed_reconcile_configs, migrate_type_source_direction, migrate_napas_ktc_marker

logger = logging.getLogger(__name__)


def _wait_for_db(retries: int = 15, delay: float = 5.0):
    """Retry until SQL Server is ready. Connects to master so vcbneo need not exist yet."""
    from app.db.connection import get_master_connection
    for attempt in range(1, retries + 1):
        try:
            conn = get_master_connection()
            conn.close()
            return
        except Exception as e:
            if attempt == retries:
                raise RuntimeError(f"Cannot connect to DB after {retries} attempts: {e}") from e
            logger.warning("DB not ready (attempt %d/%d): %s — retrying in %.0fs", attempt, retries, e, delay)
            time.sleep(delay)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    _wait_for_db()
    from app.db.connection import ensure_database
    ensure_database()
    init_reconcile_tables()
    seed_flex()
    migrate_type_source_direction()
    migrate_napas_ktc_marker()
    seed_reconcile_configs()
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}
