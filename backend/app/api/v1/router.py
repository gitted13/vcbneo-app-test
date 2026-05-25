from fastapi import APIRouter

from app.modules.ingestion.router import router as ingestion_router
from app.modules.reconciliation.router import router as reconciliation_router
from app.modules.reporting.router import router as reporting_router
from app.modules.flex.router import router as flex_router

api_router = APIRouter()

api_router.include_router(ingestion_router, prefix="/files",        tags=["Ingestion"])
api_router.include_router(reconciliation_router, prefix="/reconcile", tags=["Reconciliation"])
api_router.include_router(reporting_router, prefix="/report",       tags=["Reporting"])
api_router.include_router(flex_router, prefix="/flex",              tags=["Flex"])
