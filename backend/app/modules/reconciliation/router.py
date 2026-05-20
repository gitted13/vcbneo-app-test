import datetime
import traceback

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.modules.reconciliation.service import get_results
from app.modules.reconciliation.rows_builder import get_rows, clear_rows_cache

router = APIRouter()


class RunRequest(BaseModel):
    date_labels: list[str]
    year: int = datetime.date.today().year


@router.post("/run")
def run_reconciliation(req: RunRequest):
    if not req.date_labels:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="date_labels must not be empty")
    try:
        results = get_results(req.date_labels, req.year)
        return {"success": True, "results": results}
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": str(e), "trace": traceback.format_exc()},
        )


@router.get("/rows")
def get_transaction_rows(
    year: int = Query(default=datetime.date.today().year),
    date_labels: list[str] = Query(default=[]),
):
    try:
        rows = get_rows(year=year, date_labels=date_labels if date_labels else None)
        return {"success": True, "rows": rows, "total": len(rows)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": str(e), "trace": traceback.format_exc()},
        )


@router.post("/rows/cache/clear")
def clear_rows():
    clear_rows_cache()
    return {"success": True}


@router.get("/results")
def get_cached_results(
    date_labels: list[str] = Query(...),
    year: int = Query(default=datetime.date.today().year),
):
    try:
        results = get_results(date_labels, year)
        return {"success": True, "results": results}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
