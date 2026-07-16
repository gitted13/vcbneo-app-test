import datetime
import hashlib
import json
import re
from io import BytesIO
from typing import Any

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from app.db.connection import db_cursor
from app.modules.reconciliation.engine_flex import mark_stale_by_type, mark_stale_all, clear_type_id_cache
from app.modules.reconciliation.unified_db_builder import clear_db_rows_cache

router = APIRouter()


def _cols(cur) -> list[str]:
    return [col[0] for col in cur.description]


# ── Systems ──────────────────────────────────────────────────────────────────

@router.get("/systems")
def list_systems() -> list[dict]:
    with db_cursor() as cur:
        cur.execute("SELECT id, system_code, system_name, is_active FROM systemCollection ORDER BY id")
        cols = _cols(cur)
        return [dict(zip(cols, r)) for r in cur.fetchall()]


# ── Types ─────────────────────────────────────────────────────────────────────

@router.get("/types")
def list_types(system_code: str | None = Query(None)) -> list[dict]:
    with db_cursor() as cur:
        if system_code:
            cur.execute(
                """
                SELECT t.id, t.system_id, t.file_type_id, t.upload_name,
                       t.fields_schema, t.is_active, s.system_code
                FROM uploadedTypes t
                JOIN systemCollection s ON s.id = t.system_id
                WHERE s.system_code = ? AND t.is_active = 1
                ORDER BY t.id
                """,
                system_code,
            )
        else:
            cur.execute(
                """
                SELECT t.id, t.system_id, t.file_type_id, t.upload_name,
                       t.fields_schema, t.is_active, s.system_code
                FROM uploadedTypes t
                JOIN systemCollection s ON s.id = t.system_id
                WHERE t.is_active = 1
                ORDER BY t.id
                """
            )
        all_rows = cur.fetchall()
        cols = _cols(cur)
        result = []
        for r in all_rows:
            d = dict(zip(cols, r))
            if d.get("fields_schema"):
                try:
                    d["fields_schema"] = json.loads(d["fields_schema"])
                except (json.JSONDecodeError, TypeError):
                    pass
            result.append(d)
        return result


@router.post("/types")
def create_type(body: dict) -> dict:
    system_code = body.get("system_code", "reconcile")
    upload_name = body.get("upload_name", "").strip()
    fields_schema = body.get("fields_schema", {})
    if not upload_name:
        raise HTTPException(400, "upload_name is required")
    if not isinstance(fields_schema, str):
        fields_schema = json.dumps(fields_schema, ensure_ascii=False)
    with db_cursor() as cur:
        cur.execute("SELECT id FROM systemCollection WHERE system_code = ?", system_code)
        sys_row = cur.fetchone()
        if not sys_row:
            raise HTTPException(404, f"System '{system_code}' not found")
        system_id = sys_row[0]
        cur.execute("SELECT id FROM uploadedFileTypes WHERE file_type_name = 'Excel'")
        ft_row = cur.fetchone()
        file_type_id = ft_row[0] if ft_row else 1
        cur.execute(
            """
            INSERT INTO uploadedTypes
                (system_id, file_type_id, upload_name, fields_schema, is_active, created, created_by)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, 1, GETDATE(), 'web')
            """,
            system_id, file_type_id, upload_name, fields_schema,
        )
        new_id = cur.fetchone()[0]
    return {"id": new_id, "ok": True}


@router.patch("/types/{type_id}")
def update_type(type_id: int, body: dict) -> dict:
    allowed = {"upload_name", "fields_schema", "is_active"}
    patch = {k: v for k, v in body.items() if k in allowed}
    if not patch:
        raise HTTPException(400, "No valid fields to update")
    if "fields_schema" in patch and not isinstance(patch["fields_schema"], str):
        patch["fields_schema"] = json.dumps(patch["fields_schema"], ensure_ascii=False)
    set_clause = ", ".join(f"{k} = ?" for k in patch)
    with db_cursor() as cur:
        cur.execute(f"UPDATE uploadedTypes SET {set_clause} WHERE id = ?", *patch.values(), type_id)
        if cur.rowcount == 0:
            raise HTTPException(404, "Type not found")
    clear_type_id_cache()
    mark_stale_by_type(type_id)
    clear_db_rows_cache()
    return {"ok": True}


@router.delete("/types/{type_id}", status_code=200)
def delete_type(type_id: int) -> dict:
    """Soft-delete a file type (set is_active=0). Blocked if it still has
    active uploaded files — remove/purge that data first so no upload ends
    up pointing at a type that's disappeared from every list."""
    with db_cursor() as cur:
        cur.execute("SELECT id FROM uploadedTypes WHERE id = ? AND is_active = 1", type_id)
        if not cur.fetchone():
            raise HTTPException(404, "Type not found")
        cur.execute("SELECT COUNT(*) FROM uploadedFiles WHERE upload_type_id = ? AND is_active = 1", type_id)
        file_count = cur.fetchone()[0]
        if file_count > 0:
            raise HTTPException(
                409,
                f"Loại file này còn {file_count} file đã tải lên — xóa dữ liệu (Xóa dữ liệu ở trang Tải lên) trước khi xóa loại file.",
            )
        cur.execute("UPDATE uploadedTypes SET is_active = 0 WHERE id = ?", type_id)
    clear_type_id_cache()
    clear_db_rows_cache()
    return {"ok": True}


# ── Files ─────────────────────────────────────────────────────────────────────

@router.get("/files")
def list_files(
    type_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    search: str | None = Query(None),
    status: str | None = Query(None),
) -> dict[str, Any]:
    _base = """
        SELECT f.id, f.upload_type_id, t.upload_name, t.fields_schema,
               f.original_name, f.is_active, f.error_detail,
               f.created_by, f.created,
               (SELECT COUNT(*) FROM uploadedFileRows r
                WHERE r.upload_file_id = f.id) AS row_count
        FROM uploadedFiles f
        JOIN uploadedTypes t ON t.id = f.upload_type_id
    """
    with db_cursor() as cur:
        if type_id:
            cur.execute(_base + " WHERE f.upload_type_id = ? AND f.is_active = 1 ORDER BY f.created DESC", type_id)
        else:
            cur.execute(_base + " WHERE f.is_active = 1 ORDER BY f.created DESC")
        cols = _cols(cur)
        rows = []
        for r in cur.fetchall():
            d = dict(zip(cols, r))
            if d.get("created"):
                d["created"] = str(d["created"])
            try:
                schema = json.loads(d.pop("fields_schema") or "{}")
                d["type_code"] = schema.get("type_code", "")
            except Exception:
                d.pop("fields_schema", None)
                d["type_code"] = ""
            d["status"] = "ok" if d.get("error_detail") is None else "error"
            rows.append(d)

        # Stat-tile counts reflect the type_id scope (if any) but ignore
        # search/status so the tiles above the table don't shift as you type.
        total_all   = len(rows)
        total_ok    = sum(1 for r in rows if r["status"] == "ok")
        total_error = total_all - total_ok

        if status in ("ok", "error"):
            rows = [r for r in rows if r["status"] == status]

        if search and search.strip():
            q = search.strip().lower()
            rows = [
                r for r in rows
                if q in str(r.get("original_name") or "").lower()
                or q in str(r.get("upload_name") or "").lower()
            ]

        total = len(rows)
        start = (page - 1) * page_size
        return {
            "rows": rows[start:start + page_size],
            "total": total,
            "total_all": total_all,
            "total_ok": total_ok,
            "total_error": total_error,
        }


@router.get("/files/{file_id}/row-log")
def get_file_row_log(
    file_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    status: str | None = Query(None),
) -> dict[str, Any]:
    """Per-row outcome for one upload — saved / duplicate / rejected (missing
    a required field) / blank (separator row, harmless). Only recorded for
    uploads made after this feature shipped; older files return null."""
    with db_cursor() as cur:
        cur.execute("SELECT row_log FROM uploadedFiles WHERE id = ?", file_id)
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "File not found")
    if not row[0]:
        return {"rows": [], "total": 0, "counts": {}, "available": False}

    log: list[dict] = json.loads(row[0])
    counts: dict[str, int] = {}
    for entry in log:
        counts[entry["status"]] = counts.get(entry["status"], 0) + 1

    if status:
        log = [e for e in log if e["status"] == status]

    total = len(log)
    start = (page - 1) * page_size
    return {"rows": log[start:start + page_size], "total": total, "counts": counts, "available": True}


# ── File management ───────────────────────────────────────────────────────────

@router.delete("/purge", status_code=200)
def purge_uploaded_data(type_id: int | None = None):
    """Hard-delete dữ liệu thô đã tải lên khỏi 3 bảng: uploadedFileRows, uploadedFiles, reconcileResults.
    - type_id truyền vào: chỉ xóa dữ liệu của loại file đó.
    - Không truyền type_id: xóa TOÀN BỘ dữ liệu upload và kết quả đối soát.
    """
    with db_cursor() as cur:
        if type_id is not None:
            cur.execute("SELECT id FROM uploadedTypes WHERE id = ? AND is_active = 1", type_id)
            if not cur.fetchone():
                raise HTTPException(404, f"type_id={type_id} không tồn tại")
            cur.execute(
                "DELETE FROM uploadedFileRows WHERE upload_file_id IN (SELECT id FROM uploadedFiles WHERE upload_type_id = ?)",
                type_id,
            )
            rows_deleted = cur.rowcount
            cur.execute("DELETE FROM uploadedFiles WHERE upload_type_id = ?", type_id)
            files_deleted = cur.rowcount
            cur.execute(
                "DELETE FROM reconcileResults WHERE left_type_id = ? OR right_type_id = ?",
                type_id, type_id,
            )
            results_deleted = cur.rowcount
        else:
            cur.execute("DELETE FROM uploadedFileRows")
            rows_deleted = cur.rowcount
            cur.execute("DELETE FROM uploadedFiles")
            files_deleted = cur.rowcount
            cur.execute("DELETE FROM reconcileResults")
            results_deleted = cur.rowcount
    mark_stale_all()
    clear_db_rows_cache()
    return {
        "ok": True,
        "type_id": type_id,
        "deleted": {
            "uploadedFileRows": rows_deleted,
            "uploadedFiles": files_deleted,
            "reconcileResults": results_deleted,
        },
    }


@router.delete("/files/{file_id}", status_code=200)
def delete_file(file_id: int):
    """Soft-delete an uploaded file (set is_active=0). Rows are kept but excluded from all queries."""
    with db_cursor() as cur:
        cur.execute("SELECT id, upload_type_id FROM uploadedFiles WHERE id = ?", file_id)
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "File not found")
        type_id = row[1]
        cur.execute("UPDATE uploadedFiles SET is_active = 0, modified = GETDATE() WHERE id = ?", file_id)
    mark_stale_by_type(type_id)
    clear_db_rows_cache()
    return {"ok": True, "file_id": file_id}


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_file(
    type_id: int = Form(...),
    file: UploadFile = File(...),
) -> dict:
    # 1. Resolve type + schema
    with db_cursor() as cur:
        cur.execute(
            "SELECT id, upload_name, fields_schema FROM uploadedTypes WHERE id = ? AND is_active = 1",
            type_id,
        )
        type_row = cur.fetchone()
        if not type_row:
            raise HTTPException(404, f"Type id={type_id} not found")
        _, upload_name, schema_raw = type_row

    try:
        schema_obj: dict = json.loads(schema_raw or "{}")
    except (json.JSONDecodeError, TypeError):
        schema_obj = {}

    col_defs: list[dict] = schema_obj.get("columns", [])

    # 2. Parse Excel — detect header từ sheet đầu, đọc toàn bộ sheet và concat
    contents = await file.read()
    try:
        xl = pd.ExcelFile(BytesIO(contents))
        sheet_names = xl.sheet_names

        # Detect header row từ sheet đầu tiên
        df_raw = pd.read_excel(BytesIO(contents), sheet_name=sheet_names[0], dtype=str, header=None, nrows=40)
        header_idx = _detect_header_row(df_raw)

        # Ngày thật của mỗi sheet (theo tên sheet — export từ hệ thống nguồn),
        # dùng làm "day" gốc thay vì tin ngày nhúng trong từng dòng dữ liệu.
        sheet_day_map = _build_sheet_day_map(sheet_names)

        # Đọc tất cả sheet với cùng header_idx rồi concat, giữ lại tên sheet gốc
        # của mỗi dòng (cột nội bộ, không map theo schema) để tra sheet_day_map.
        dfs = []
        for sheet in sheet_names:
            try:
                df_sheet = pd.read_excel(BytesIO(contents), sheet_name=sheet, dtype=str, header=header_idx)
                df_sheet["__sheet__"] = sheet
                dfs.append(df_sheet)
            except Exception:
                pass
        df = pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame()
    except Exception as exc:
        raise HTTPException(400, f"Cannot read Excel: {exc}")

    df.columns = [str(c).strip() for c in df.columns]
    df = df.where(df.notna(), other=None)

    # Map col_name → DataFrame column (case-insensitive)
    col_map: dict[str, str] = {}   # field_name → excel_col
    for col_def in col_defs:
        target = col_def.get("col_name", "").strip().upper()
        for excel_col in df.columns:
            if excel_col.strip().upper() == target:
                col_map[col_def["field_name"]] = excel_col
                break

    # 3. Parse + validate rows
    rows_data: list[dict[str, Any]] = []
    row_excel_nums: list[int] = []   # parallel to rows_data — 1-based Excel row number, for the per-row upload log
    errors: list[dict] = []

    for row_idx, (_, excel_row) in enumerate(df.iterrows()):
        row_json: dict[str, Any] = {}
        for col_def in col_defs:
            field_name = col_def["field_name"]

            # Fixed value — không đọc từ Excel
            if col_def.get("fixed_value") is not None:
                row_json[field_name] = col_def["fixed_value"]
                continue

            excel_col = col_map.get(field_name)
            raw_val   = excel_row[excel_col] if excel_col else None

            # Apply transform before required-check.
            # concat runs even when raw_val is None (it builds from row_ctx, not from source col).
            tr = col_def.get("transform")
            if tr and (raw_val is not None or tr.get("type") == "concat"):
                raw_val = _apply_transform(raw_val, tr, row_json)

            # Required check
            excel_row_num = header_idx + row_idx + 2  # 1-based Excel row number
            if col_def.get("required") and _is_empty_cell(raw_val):
                errors.append({"row": excel_row_num, "field": field_name, "reason": "Trường bắt buộc bị thiếu"})
                row_json[field_name] = None
                continue

            # Type coercion + allowed values check
            parsed = _parse_value(raw_val, col_def.get("data_type", "string"))
            av = col_def.get("allowed_values") or []
            if av and not _is_empty_cell(raw_val) and str(raw_val).strip() not in av:
                errors.append({"row": excel_row_num, "field": field_name,
                               "reason": f"Giá trị '{raw_val}' không hợp lệ. Cho phép: {', '.join(av)}"})
            row_json[field_name] = parsed

        sheet_day = sheet_day_map.get(excel_row.get("__sheet__"))
        if sheet_day:
            row_json["_sheet_day"] = sheet_day
        rows_data.append(row_json)
        row_excel_nums.append(header_idx + row_idx + 2)  # 1-based Excel row number

    # 4. Persist to DB — one row per transaction
    unique_key: list[str] = schema_obj.get("unique_key") or []

    # Detect which fields are required (excluding fixed_value columns)
    required_fields = [
        c["field_name"] for c in col_defs
        if c.get("required") and c.get("fixed_value") is None
    ]

    status = "error" if any(e for e in errors if "bắt buộc" in e["reason"]) else "ok"

    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO uploadedFiles (upload_type_id, original_name, is_active, created_by, created, modified, error_detail) OUTPUT INSERTED.id VALUES (?, ?, 1, 'web', GETDATE(), GETDATE(), ?)",
            type_id, file.filename,
            json.dumps(errors[:20], ensure_ascii=False) if errors else None,
        )
        file_id = cur.fetchone()[0]

        # Pre-load existing row keys for cross-upload deduplication
        existing_keys: set[str] = set()
        if unique_key:
            cur.execute(
                """
                SELECT r.file_data FROM uploadedFileRows r
                JOIN uploadedFiles f ON f.id = r.upload_file_id
                WHERE f.upload_type_id = ?
                """,
                type_id,
            )
            for (data_raw,) in cur.fetchall():
                try:
                    k = _row_key(type_id, unique_key, json.loads(data_raw or "{}"))
                    if k:
                        existing_keys.add(k)
                except Exception:
                    pass

        saved_count    = 0
        dup_count      = 0
        skip_count     = 0   # every field on the row empty — blank separator row, harmless
        rejected_count = 0   # required field(s) missing but the row has other data — real problem, not saved
        row_log: list[dict] = []   # per-row outcome, shown via "Xem chi tiết" in Lịch sử tải lên
        for row_json, excel_row_num in zip(rows_data, row_excel_nums):
            if required_fields:
                # "Blank row" must mean every FIELD is empty, not just every
                # required one — checking only required fields breaks for any
                # schema with a single required column (all-required-empty and
                # some-required-empty become the same condition), silently
                # reclassifying a real row missing its one required field as
                # a harmless blank row instead of rejecting it.
                is_blank_row = all(v is None for k, v in row_json.items() if not k.startswith("_"))
                if is_blank_row:
                    skip_count += 1
                    row_log.append({"row": excel_row_num, "status": "blank"})
                    continue
                missing = [f for f in required_fields if row_json.get(f) is None]
                if missing:
                    # Previously this only skipped rows with ALL required fields
                    # missing, so a row with e.g. trace = null (regex_extract
                    # failed to match) but other required fields present would
                    # still get inserted — "required" was validated (logged as
                    # an error) but never actually enforced. Now it's dropped.
                    rejected_count += 1
                    row_log.append({"row": excel_row_num, "status": "rejected", "reason": f"Thiếu trường bắt buộc: {', '.join(missing)}"})
                    continue
            if unique_key:
                k = _row_key(type_id, unique_key, row_json)
                if k and k in existing_keys:
                    dup_count += 1
                    row_log.append({"row": excel_row_num, "status": "duplicate", "reason": f"Trùng dữ liệu đã có ({', '.join(unique_key)})"})
                    continue
                if k:
                    existing_keys.add(k)
            cur.execute(
                "INSERT INTO uploadedFileRows (upload_file_id, row_count, file_data, created, created_by) VALUES (?, ?, ?, GETDATE(), 'web')",
                file_id, 0, json.dumps(row_json, ensure_ascii=False),
            )
            saved_count += 1
            row_log.append({"row": excel_row_num, "status": "saved"})

        cur.execute(
            "UPDATE uploadedFiles SET row_log = ? WHERE id = ?",
            json.dumps(row_log, ensure_ascii=False), file_id,
        )

    mark_stale_by_type(type_id)
    clear_db_rows_cache()
    return {
        "file_id":        file_id,
        "row_count":      saved_count,
        "duplicate_count": dup_count,
        "skip_count":     skip_count,
        "rejected_count": rejected_count,
        "error_count":    len(errors),
        "errors":         errors[:10],
        "upload_name":    upload_name,
        "status":         status,
    }


def _is_empty_cell(raw) -> bool:
    """Empty Excel cells can reach here as three different "nothing" shapes
    depending on pandas/openpyxl version: Python None; a float NaN (plain
    `raw is None` misses it, NaN is a float not None — needs pd.isna, and
    pd.isna() on a string raises for some inputs, so only call it once we
    know raw isn't a string); or — on some dtype=str + NaN read combinations
    — the literal 3-char string "nan" already baked in at read time
    (str(float('nan')) == "nan"), which pd.isna() does NOT catch since by
    then it's a genuine non-empty string. Any of the three must count as
    empty, or it serializes as the literal text "nan" instead of null."""
    if isinstance(raw, str):
        return raw.strip() in ("", "nan")
    return raw is None or pd.isna(raw)


def _parse_value(raw, data_type: str):
    if _is_empty_cell(raw):
        return None
    try:
        if data_type == "integer":
            return int(float(str(raw).strip()))
        if data_type == "number":
            return float(str(raw).strip().replace(",", ""))
        if data_type == "boolean":
            return str(raw).strip().lower() in ("true", "1", "yes", "có")
        if data_type in ("date", "datetime"):
            return str(raw).strip()
    except (ValueError, TypeError):
        pass
    return str(raw).strip() if raw is not None else None


# ── Transform helpers ────────────────────────────────────────────────────────

def _apply_transform(raw: Any, transform: dict, row_ctx: dict | None = None) -> Any:
    """Apply a column-level transform. row_ctx holds already-processed fields in the current row."""
    t = transform.get("type")

    if t == "regex_extract":
        m = re.search(transform.get("pattern", ""), str(raw))
        if m:
            try:
                return m.group(int(transform.get("group", 0)))
            except (IndexError, ValueError):
                return None
        return None

    if t == "math":
        try:
            num = float(str(raw).replace(",", "").strip())
            operand = float(transform.get("value", 1))
            op = transform.get("op", "multiply")
            if op == "multiply": return num * operand
            if op == "divide":   return (num / operand) if operand != 0 else None
            if op == "add":      return num + operand
            if op == "subtract": return num - operand
        except (ValueError, TypeError):
            return raw
        return raw

    if t == "if_else":
        val_str   = str(raw) if raw is not None else ""
        op        = transform.get("op", "contains")
        cond_val  = transform.get("cond_value", "")
        match = False
        if   op == "contains":     match = cond_val in val_str
        elif op == "equals":       match = val_str == cond_val
        elif op == "starts_with":  match = val_str.startswith(cond_val)
        elif op == "ends_with":    match = val_str.endswith(cond_val)
        elif op == "is_empty":     match = not val_str.strip()
        elif op == "is_not_empty": match = bool(val_str.strip())
        then_val = transform.get("then_value", "")
        else_val = transform.get("else_value", "")
        if match:
            return then_val if then_val else raw
        else:
            return else_val if else_val else raw

    if t == "concat":
        ctx    = row_ctx or {}
        result = []
        for part in transform.get("parts", []):
            if part.get("kind") == "field":
                fval = ctx.get(part.get("field_name", ""), "")
                result.append(str(fval) if fval is not None else "")
            elif part.get("kind") == "literal":
                result.append(part.get("value", ""))
        return "".join(result)

    return raw


def _row_key(type_id: int, unique_key: list[str], row: dict) -> str | None:
    """Compute a dedup key for a row given the unique_key field list."""
    if not unique_key:
        return None
    parts = [str(row.get(k) or "") for k in unique_key]
    raw = f"{type_id}:" + "|".join(parts)
    return hashlib.md5(raw.encode()).hexdigest()


# ── Sheet-day parsing ─────────────────────────────────────────────────────────
# Excel sheets are named by the source system's export day (the "true" business
# day for every row in that sheet) — not to be confused with each row's own
# embedded date/time field, which stays untouched and still drives T-1/T/T+1
# offset classification in the reconcile engine. Recognized patterns, seen in
# real VCB export files:
#   'DD.MM'          — Swift, Core                (no year in the name)
#   'MMDDYY_...'     — NAPAS TC files              (year embedded)
#   'MMDD'           — NAPAS KTC, later sheets      (no year in the name)
# Sheets that don't match any pattern are left unresolved — rows from them fall
# back to today's behavior (day derived from the row's own date field).

_SHEET_DAY_DOTTED = re.compile(r"^(\d{2})\.(\d{2})$")             # DD.MM
_SHEET_DAY_YEARED = re.compile(r"^(\d{2})(\d{2})(\d{2})_")        # MMDDYY_...
_SHEET_DAY_BARE   = re.compile(r"^(\d{2})(\d{2})$")               # MMDD


def _valid_mmdd(mm: str, dd: str) -> bool:
    return 1 <= int(mm) <= 12 and 1 <= int(dd) <= 31


def _build_sheet_day_map(sheet_names: list[str]) -> dict[str, str]:
    """Map sheet name → 'YYYYMMDD' for every sheet whose name encodes a day.

    A first pass finds any sheet with an explicit year (MMDDYY_... pattern) to
    use as the fallback year for sibling sheets in the same file that encode
    day/month only (DD.MM or bare MMDD, no year segment).
    """
    fallback_year: str | None = None
    for name in sheet_names:
        m = _SHEET_DAY_YEARED.match(name.strip())
        if m:
            fallback_year = f"20{m.group(3)}"
            break

    # Swift/Core sheets ('DD.MM') never carry a year anywhere in the file — the
    # only fallback available is the server's current year at upload time. This
    # is a best-effort default (wrong only at a year boundary, e.g. uploading a
    # December file in January) and only used when nothing better is available.
    if fallback_year is None:
        fallback_year = str(datetime.date.today().year)

    result: dict[str, str] = {}
    for name in sheet_names:
        s = name.strip()

        m = _SHEET_DAY_YEARED.match(s)
        if m:
            mm, dd, yy = m.groups()
            if _valid_mmdd(mm, dd):
                result[name] = f"20{yy}{mm}{dd}"
            continue

        m = _SHEET_DAY_DOTTED.match(s)
        if m and fallback_year:
            dd, mm = m.groups()
            if _valid_mmdd(mm, dd):
                result[name] = f"{fallback_year}{mm}{dd}"
            continue

        m = _SHEET_DAY_BARE.match(s)
        if m and fallback_year:
            # Bare 4-digit sheet names are ambiguous — could be MMDD (matching
            # the yeared NAPAS sibling sheets) or DDMM (matching Swift/Core's
            # dotted convention). Try both; only accept when unambiguous:
            # exactly one ordering is a valid calendar date, or both orderings
            # agree on the same date. Otherwise leave unresolved rather than
            # silently guessing wrong (confirmed real case: '0302' is invalid
            # as neither... both readings are valid dates but disagree — Feb 3
            # vs March 2 — so it must be left unresolved here).
            a, b = m.groups()
            candidates = set()
            if _valid_mmdd(a, b):
                candidates.add(f"{fallback_year}{a}{b}")   # read as MMDD
            if _valid_mmdd(b, a):
                candidates.add(f"{fallback_year}{b}{a}")   # read as DDMM
            if len(candidates) == 1:
                result[name] = candidates.pop()
            continue
        # Unrecognized pattern — leave unresolved, caller falls back to
        # each row's own embedded date field.

    return result


# ── Header detection ─────────────────────────────────────────────────────────

def _detect_header_row(df_raw) -> int:
    """Return 0-based row index with the highest text-cell count (most likely header)."""
    def _text_score(row) -> int:
        score = 0
        for v in row:
            s = str(v).strip() if v is not None else ""
            if not s or s.lower() in ("nan", "none", ""):
                continue
            try:
                float(s.replace(",", "").replace(" ", ""))
            except ValueError:
                score += 1
        return score

    best_idx, best_score = 0, -1
    for i in range(len(df_raw)):
        score = _text_score(df_raw.iloc[i].tolist())
        if score > best_score:
            best_score, best_idx = score, i
    return best_idx


# ── Type inference helpers ────────────────────────────────────────────────────

_DATE_RE = re.compile(
    r"^\d{4}[-/]\d{2}[-/]\d{2}$"               # YYYY-MM-DD
    r"|^\d{2}[-/]\d{2}[-/]\d{4}$"              # DD/MM/YYYY
)
_DATETIME_RE = re.compile(
    r"^\d{4}[-/]\d{2}[-/]\d{2}[T ]\d{2}:\d{2}" # YYYY-MM-DD HH:MM
    r"|^\d{2}[-/]\d{2}[-/]\d{4} \d{2}:\d{2}"   # DD/MM/YYYY HH:MM
)

# Column-name keywords that hint at a specific type
_MONEY_KW = ("tiền", "amount", "tien", "giá", "gia", "phí", "phi", "balance",
             "số dư", "so du", "price", "cost", "value")
_DATE_KW  = ("ngày", "ngay", "date", "hostdate", "thời gian", "thoi gian",
             "datetime", "time", "created", "modified")


def _col_hint(col_name: str) -> str | None:
    """Return a type hint based on column name keywords, or None if no hint."""
    low = col_name.lower()
    if any(kw in low for kw in _MONEY_KW):
        return "number"
    if any(kw in low for kw in _DATE_KW):
        return "date"
    return None


def _is_yyyymmdd(values: list[str]) -> bool:
    """True when every value is an 8-digit integer representing a valid date."""
    for v in values:
        s = v.replace(",", "").strip()
        if len(s) != 8 or not s.isdigit():
            return False
        n = int(s)
        if not (19000101 <= n <= 21001231):
            return False
        month = (n // 100) % 100
        day   = n % 100
        if not (1 <= month <= 12 and 1 <= day <= 31):
            return False
    return True


def _infer_type(col_name: str, samples: list[str]) -> str:
    non_empty = [
        s.strip() for s in samples
        if s and str(s).strip() and str(s).lower() not in ("nan", "none", "nat")
    ]
    if not non_empty:
        return _col_hint(col_name) or "string"

    # Explicit pattern matches take priority
    if all(_DATETIME_RE.match(v) for v in non_empty):
        return "datetime"
    if all(_DATE_RE.match(v) for v in non_empty):
        return "date"

    def _is_float(v):
        try:
            float(v.replace(",", ""))
            return True
        except ValueError:
            return False

    def _is_int(v):
        try:
            f = float(v.replace(",", ""))
            return f == int(f)
        except ValueError:
            return False

    if all(_is_int(v) for v in non_empty):
        if _is_yyyymmdd(non_empty):
            return "date"
        # Column-name hint overrides integer detection
        hint = _col_hint(col_name)
        if hint:
            return hint
        return "integer"

    if all(_is_float(v) for v in non_empty):
        # Money column hint
        if _col_hint(col_name) == "number":
            return "number"
        return "number"

    return "string"


# ── Scan file headers ────────────────────────────────────────────────────────

@router.post("/scan-file")
async def scan_file(file: UploadFile = File(...)) -> dict:
    contents = await file.read()
    try:
        df_raw = pd.read_excel(BytesIO(contents), dtype=str, header=None, nrows=40)
    except Exception as exc:
        raise HTTPException(400, f"Cannot read file: {exc}")

    best_idx = _detect_header_row(df_raw)

    try:
        df = pd.read_excel(BytesIO(contents), dtype=str, header=best_idx)
    except Exception as exc:
        raise HTTPException(400, f"Cannot parse headers: {exc}")

    df.columns = [str(c).strip() for c in df.columns]
    df = df.where(df.notna(), other=None)

    columns = []
    for col in df.columns:
        if not col or col.startswith("Unnamed:"):
            continue
        sample = [str(v) for v in df[col].dropna().head(30).tolist()]
        columns.append({"col_name": col, "suggested_type": _infer_type(col, sample)})

    return {"columns": columns, "header_row": best_idx + 1}


# ── Rows ──────────────────────────────────────────────────────────────────────

def _parse_flex_date_iso(val: Any) -> str | None:
    """Mirrors frontend/src/pages/DataStorage/index.jsx's parseFlexDate() —
    keep both in sync. Used for server-side date-range filtering so paginated
    results match what the client would have filtered locally before."""
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})[ T]\d{2}:\d{2}:\d{2}", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r"^(\d{4})(\d{2})(\d{2})$", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", s)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    if re.match(r"^\d{3,4}$", s):
        padded = s.zfill(4)
        year = datetime.date.today().year
        return f"{year}-{padded[:2]}-{padded[2:]}"
    return None


@router.get("/rows")
def get_rows(
    type_id: int = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    search: str | None = Query(None),
    date_field: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
) -> dict[str, Any]:
    with db_cursor() as cur:
        cur.execute(
            "SELECT fields_schema FROM uploadedTypes WHERE id = ?", type_id
        )
        type_row = cur.fetchone()
        if not type_row:
            raise HTTPException(404, "Type not found")

        try:
            schema_obj: dict = json.loads(type_row[0] or "{}")
        except (json.JSONDecodeError, TypeError):
            schema_obj = {}

        field_keys = [c["field_name"] for c in schema_obj.get("columns", [])]

        cur.execute(
            """
            SELECT r.id, r.upload_file_id, r.row_count, r.file_data
            FROM uploadedFileRows r
            JOIN uploadedFiles f ON f.id = r.upload_file_id
            WHERE f.upload_type_id = ?
            ORDER BY r.id
            """,
            type_id,
        )

        result: list[dict] = []
        for r in cur.fetchall():
            row_id, file_id, _unused, file_data_raw = r
            try:
                data_row: dict = json.loads(file_data_raw or "{}")
                # Backward-compat: old blob format was a JSON array
                if isinstance(data_row, list):
                    for i, old_row in enumerate(data_row):
                        parsed: dict[str, Any] = {"_id": f"{row_id}_{i}", "_file_id": file_id}
                        parsed.update({k: old_row.get(k) for k in field_keys} if field_keys else old_row)
                        result.append(parsed)
                    continue
            except (json.JSONDecodeError, TypeError):
                data_row = {}

            parsed = {"_id": str(row_id), "_file_id": file_id}
            if field_keys:
                for key in field_keys:
                    parsed[key] = data_row.get(key)
            else:
                parsed.update(data_row)
            result.append(parsed)

        raw_total = len(result)

        if search and search.strip():
            q = search.strip().lower()
            result = [
                r for r in result
                if any(q in str(v).lower() for v in r.values() if v is not None)
            ]

        if date_field and (date_from or date_to):
            def _in_range(r: dict) -> bool:
                iso = _parse_flex_date_iso(r.get(date_field))
                if iso is None:
                    return True  # unparseable — don't hide the row, matches prior client behavior
                if date_from and iso < date_from:
                    return False
                if date_to and iso > date_to:
                    return False
                return True
            result = [r for r in result if _in_range(r)]

        total = len(result)
        start = (page - 1) * page_size
        return {"rows": result[start:start + page_size], "total": total, "raw_total": raw_total}
