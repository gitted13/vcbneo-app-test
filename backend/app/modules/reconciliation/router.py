import datetime
import json
import traceback
from typing import Any

from fastapi import APIRouter, HTTPException, Path, Query, status
from pydantic import BaseModel

from app.db.connection import db_cursor
from app.modules.reconciliation.engine_flex import (
    run_flex_reconcile,
    mark_stale_by_config,
    mark_stale_all,
)
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


# ── Join Configs ───────────────────────────────────────────────────────────────

class JoinConfigBody(BaseModel):
    config: dict[str, Any]
    created_by: str = "user"


@router.get("/join-configs")
def list_join_configs():
    with db_cursor() as cur:
        cur.execute("SELECT id, config_json, is_active, created, created_by FROM reconcileJoinConfigs WHERE is_active = 1 ORDER BY id")
        rows = cur.fetchall()
    return [
        {
            "id": r[0],
            "config": json.loads(r[1]),
            "is_active": bool(r[2]),
            "created": r[3].isoformat() if r[3] else None,
            "created_by": r[4],
        }
        for r in rows
    ]


@router.post("/join-configs", status_code=201)
def create_join_config(body: JoinConfigBody):
    config_json = json.dumps(body.config, ensure_ascii=False)
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO reconcileJoinConfigs (config_json, created_by) OUTPUT INSERTED.id VALUES (?, ?)",
            config_json, body.created_by,
        )
        new_id = cur.fetchone()[0]
    return {"id": new_id, "config": body.config}


@router.patch("/join-configs/{config_id}")
def update_join_config(config_id: int = Path(...), body: JoinConfigBody = ...):
    config_json = json.dumps(body.config, ensure_ascii=False)
    with db_cursor() as cur:
        cur.execute("SELECT id FROM reconcileJoinConfigs WHERE id = ? AND is_active = 1", config_id)
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Config not found")
        cur.execute("UPDATE reconcileJoinConfigs SET config_json = ? WHERE id = ?", config_json, config_id)
    mark_stale_by_config(config_id)
    return {"id": config_id, "config": body.config}


@router.delete("/join-configs/{config_id}", status_code=204)
def delete_join_config(config_id: int = Path(...)):
    with db_cursor() as cur:
        cur.execute("SELECT id FROM reconcileJoinConfigs WHERE id = ? AND is_active = 1", config_id)
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Config not found")
        cur.execute("UPDATE reconcileJoinConfigs SET is_active = 0 WHERE id = ?", config_id)


# ── Status Rules ───────────────────────────────────────────────────────────────

class StatusRulesBody(BaseModel):
    rules: dict[str, Any]
    updated_by: str = "user"


@router.get("/status-rules")
def get_status_rules():
    with db_cursor() as cur:
        cur.execute("SELECT TOP 1 rules_json, updated, updated_by FROM reconcileStatusRules ORDER BY id DESC")
        row = cur.fetchone()
    if not row:
        return {"rules": {}, "updated": None, "updated_by": None}
    return {
        "rules": json.loads(row[0]),
        "updated": row[1].isoformat() if row[1] else None,
        "updated_by": row[2],
    }


@router.put("/status-rules")
def save_status_rules(body: StatusRulesBody):
    rules_json = json.dumps(body.rules, ensure_ascii=False)
    with db_cursor() as cur:
        cur.execute("SELECT TOP 1 id FROM reconcileStatusRules ORDER BY id DESC")
        existing = cur.fetchone()
        if existing:
            cur.execute(
                "UPDATE reconcileStatusRules SET rules_json = ?, updated = GETDATE(), updated_by = ? WHERE id = ?",
                rules_json, body.updated_by, existing[0],
            )
        else:
            cur.execute(
                "INSERT INTO reconcileStatusRules (rules_json, updated_by) VALUES (?, ?)",
                rules_json, body.updated_by,
            )
    mark_stale_all()
    return {"success": True}


# ── Flex Reconcile ─────────────────────────────────────────────────────────────

class RunFlexRequest(BaseModel):
    config_id: int
    run_date: str | None = None
    created_by: str = "user"


class PatchResultBody(BaseModel):
    note: str | None = None
    status_override: str | None = None
    resolved_by: str | None = None


@router.post("/run-flex")
def run_flex(req: RunFlexRequest):
    try:
        summary = run_flex_reconcile(req.config_id, req.run_date, req.created_by)
        return {"success": True, **summary}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": str(e), "trace": traceback.format_exc()},
        )


@router.get("/flex-results")
def get_flex_results(
    config_id: int = Query(...),
    run_date: str | None = Query(None),
):
    with db_cursor() as cur:
        if run_date:
            cur.execute(
                """
                SELECT id, config_id, run_date, left_type_id, right_type_id,
                       left_row_id, matched_ids, merged_data, status, status_override,
                       is_stale, note, resolved_by, resolved_at, created_by, created
                FROM reconcileResults
                WHERE config_id = ? AND run_date = ?
                ORDER BY id
                """,
                config_id, run_date,
            )
        else:
            # Return latest run_date for this config
            cur.execute(
                """
                SELECT id, config_id, run_date, left_type_id, right_type_id,
                       left_row_id, matched_ids, merged_data, status, status_override,
                       is_stale, note, resolved_by, resolved_at, created_by, created
                FROM reconcileResults
                WHERE config_id = ?
                  AND run_date = (SELECT MAX(run_date) FROM reconcileResults WHERE config_id = ?)
                ORDER BY id
                """,
                config_id, config_id,
            )
        rows = cur.fetchall()

    results = []
    for r in rows:
        results.append({
            "id":             r[0],
            "config_id":      r[1],
            "run_date":       str(r[2]) if r[2] else None,
            "left_type_id":   r[3],
            "right_type_id":  r[4],
            "left_row_id":    r[5],
            "matched_ids":    json.loads(r[6])  if r[6]  else {},
            "merged_data":    json.loads(r[7])  if r[7]  else {},
            "status":         r[8],
            "status_override": r[9],
            "is_stale":       bool(r[10]),
            "note":           r[11],
            "resolved_by":    r[12],
            "resolved_at":    str(r[13]) if r[13] else None,
            "created_by":     r[14],
            "created":        str(r[15]) if r[15] else None,
        })
    return results


@router.get("/flex-summary")
def get_flex_summary(
    config_id: int = Query(...),
    run_date: str | None = Query(None),
):
    rows = get_flex_results(config_id=config_id, run_date=run_date)
    if not rows:
        return {"config_id": config_id, "run_date": run_date, "total": 0, "by_status": [], "has_stale": False}

    by_status: dict[str, dict] = {}
    for r in rows:
        effective_status = r["status_override"] or r["status"] or "UNKNOWN"
        if effective_status not in by_status:
            by_status[effective_status] = {"status": effective_status, "count": 0, "amount": 0}
        by_status[effective_status]["count"] += 1
        amt = r["merged_data"].get("amount") or r["merged_data"].get("so_tien") or 0
        try:
            by_status[effective_status]["amount"] += float(amt)
        except (TypeError, ValueError):
            pass

    return {
        "config_id": config_id,
        "run_date":  rows[0]["run_date"],
        "total":     len(rows),
        "by_status": sorted(by_status.values(), key=lambda x: -x["count"]),
        "has_stale": any(r["is_stale"] for r in rows),
    }


@router.patch("/flex-results/{result_id}")
def patch_flex_result(result_id: int = Path(...), body: PatchResultBody = ...):
    with db_cursor() as cur:
        cur.execute("SELECT id FROM reconcileResults WHERE id = ?", result_id)
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Result not found")

        fields: dict[str, Any] = {}
        if body.note is not None:
            fields["note"] = body.note
        if body.status_override is not None:
            fields["status_override"] = body.status_override
        if body.resolved_by is not None:
            fields["resolved_by"] = body.resolved_by
            fields["resolved_at"] = datetime.datetime.now()

        if not fields:
            raise HTTPException(status_code=400, detail="Nothing to update")

        set_clause = ", ".join(f"{k} = ?" for k in fields)
        cur.execute(
            f"UPDATE reconcileResults SET {set_clause} WHERE id = ?",
            *fields.values(), result_id,
        )
    return {"success": True}


@router.get("/flex-run-dates")
def get_flex_run_dates(config_id: int = Query(...)):
    """Return available run_dates for a config (newest first)."""
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT run_date,
                COUNT(*) AS row_count,
                SUM(CASE WHEN is_stale = 1 THEN 1 ELSE 0 END) AS stale_count
            FROM reconcileResults
            WHERE config_id = ?
            GROUP BY run_date
            ORDER BY run_date DESC
            """,
            config_id,
        )
        rows = cur.fetchall()
    return [
        {"run_date": str(r[0]), "row_count": r[1], "stale_count": r[2], "has_stale": r[2] > 0}
        for r in rows
    ]
