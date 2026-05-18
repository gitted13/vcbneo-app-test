import datetime

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.modules.reconciliation.service import get_results
from app.modules.reporting.excel import build_excel

router = APIRouter()


@router.get("/export/excel")
def export_excel(
    date_labels: list[str] = Query(...),
    year: int = Query(default=datetime.date.today().year),
):
    results = get_results(date_labels, year)
    xls_bytes = build_excel(results, date_labels, year)
    filename = f"TONG_HOP_{year}_{'_'.join(date_labels)}.xls"
    return Response(
        content=xls_bytes,
        media_type="application/vnd.ms-excel",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
