"""
Flex reconcile engine.

Flow:
  reconcileJoinConfigs (config_id)
    → load left/right rows from uploadedFileRows
    → join in-memory by matchFields
    → classify using reconcileStatusRules chip conditions
    → upsert into reconcileResults (preserve note/resolved_by on re-run)
"""

import datetime
import json
from typing import Any, Callable

from app.db.connection import db_cursor

# ── Source → type_code mapping ────────────────────────────────────────────────

_SOURCE_TYPE_CODE: dict[tuple[str, str], str] = {
    ("Swift", "Đi"):     "swift_di",
    ("Swift", "Đến"):    "swift_den",
    ("NAPAS", "Đi"):     "napas_di",
    ("NAPAS", "Đến"):    "napas_den",
    ("Core",  "Đi"):     "core_banking",
    ("Core",  "Đến"):    "core_banking",
    ("Core",  "Cả hai"): "core_banking",
}

# Core has one type for both directions; filter by which amount field is non-zero.
# Confirmed from data: NAPAS Đi transactions appear as ghi_có (credit) in Core;
# NAPAS Đến transactions appear as ghi_nợ (debit) in Core.
_ROW_FILTER: dict[tuple[str, str], Callable[[dict], bool]] = {
    ("Core", "Đi"):  lambda d: bool(d.get("số_tiền_ghi_có")),
    ("Core", "Đến"): lambda d: bool(d.get("số_tiền_ghi_nợ")),
}


# ── DB helpers ────────────────────────────────────────────────────────────────

# type_code → type_id barely ever changes (only on a schema edit or
# activate/deactivate), but every dashboard load was re-querying it 6 times.
# Cache hits only — a miss (type not found yet) always re-queries, so a type
# created after this process started is still picked up on its first use.
_type_id_cache: dict[str, int] = {}


def _get_type_id(type_code: str) -> int | None:
    cached = _type_id_cache.get(type_code)
    if cached is not None:
        return cached
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT t.id FROM uploadedTypes t
            WHERE JSON_VALUE(t.fields_schema, '$.type_code') = ?
              AND t.is_active = 1
            """,
            type_code,
        )
        row = cur.fetchone()
    result = row[0] if row else None
    if result is not None:
        _type_id_cache[type_code] = result
    return result


def _load_rows(
    type_id: int,
    row_filter: Callable[[dict], bool] | None = None,
) -> list[dict]:
    """Return list of {id, data} for all rows of this type."""
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT r.id, r.file_data
            FROM uploadedFileRows r
            JOIN uploadedFiles f ON f.id = r.upload_file_id
            WHERE f.upload_type_id = ? AND f.is_active = 1
            ORDER BY r.id
            """,
            type_id,
        )
        rows = cur.fetchall()

    result = []
    for (row_id, data_raw) in rows:
        try:
            data = json.loads(data_raw or "{}")
        except Exception:
            data = {}
        if row_filter and not row_filter(data):
            continue
        result.append({"id": row_id, "data": data})
    return result


def _make_key(data: dict, match_fields: list[dict], side: str) -> tuple:
    """Build a comparable join key from match_fields."""
    field_key = "left" if side == "left" else "right"
    parts = []
    for mf in match_fields:
        val = data.get(mf[field_key])
        # Normalise: strip, lowercase, cast numbers to int for amount matching
        if val is None:
            parts.append(None)
            continue
        s = str(val).strip()
        try:
            parts.append(int(float(s)))
        except (ValueError, TypeError):
            parts.append(s.lower())
    return tuple(parts)


# ── Classification ────────────────────────────────────────────────────────────

_FIELD_ALIASES: dict[str, list[str]] = {
    # abstract name → candidate field keys in merged_data (tried in order)
    # phản_hồi has human-readable status text (e.g. "THANH CONG", "TIMEOUT")
    "TT Swift":   ["phản_hồi", "tinh_trạng_phản_hồi"],
    "TC/KTC":     ["phản_hồi", "tinh_trạng_phản_hồi"],
    "Ngày GD":    ["thời_gian"],                    # Swift transaction datetime (M/D/YYYY h:mm:ss AM)
    "Ngày GN":    ["hostdate", "host_date"],         # Swift host/posting date (YYYYMMDD or YYYY-MM-DD)
    "Ngày NAPAS": ["ngày_gd"],                       # NAPAS date (MMDD or date string)
    "Ngày Core":  ["ngày_giao_dịch"],                # Core date (YYYYMMDD)
    "Ngày Swift": ["hostdate", "host_date"],         # Swift posting date
}

def _to_date_str(v: str) -> str:
    """Normalize various date formats to YYYY-MM-DD for comparison."""
    s = str(v).strip()
    if not s:
        return s
    # YYYYMMDD integer-like
    if s.isdigit() and len(s) == 8:
        return f"{s[:4]}-{s[4:6]}-{s[6:]}"
    # M/D/YYYY h:mm:ss AM/PM  (e.g. "2/1/2026 10:45:46 AM")
    if "/" in s and len(s) > 8:
        date_part = s.split(" ")[0]
        parts = date_part.split("/")
        if len(parts) == 3:
            m, d, y = parts[0], parts[1], parts[2]
            if len(y) == 4:
                return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
    # YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
    if len(s) >= 10 and s[4:5] == "-":
        return s[:10]
    # DD/MM/YYYY
    if len(s) == 10 and s[2:3] == "/" and s[5:6] == "/":
        return f"{s[6:]}-{s[3:5]}-{s[:2]}"
    return s


def _resolve_field(f: str, merged: dict) -> str:
    """Resolve abstract field name to value string in merged_data."""
    if f in merged and merged[f] is not None:
        return str(merged[f]).strip()
    for key in _FIELD_ALIASES.get(f, []):
        if key in merged and merged[key] is not None:
            return str(merged[key]).strip()
    return ""


def _eval_chip(chip: dict, merged: dict, left_data: dict, right_data: dict | None) -> bool:
    """Evaluate one DateRules chip condition against the merged row."""
    f   = chip.get("f", "")
    op  = chip.get("op", "=")
    val = chip.get("v", "")

    # Presence checks — val == "null" means check if right side joined
    if val == "null":
        side_present = right_data is not None
        if op in ("≠", "ne"):
            return side_present
        if op == "=":
            return not side_present
        return False

    actual_str = _resolve_field(f, merged)

    _date_fields = {"Ngày GD", "Ngày GN", "Ngày NAPAS", "Ngày Core", "Ngày Swift"}
    if val in _date_fields or f in _date_fields:
        # Date comparison: normalize both to YYYY-MM-DD
        a = _to_date_str(actual_str)
        b_raw = _resolve_field(val, merged) if val in _date_fields else val
        b = _to_date_str(b_raw)
    else:
        # Case-insensitive string comparison for status values
        a = actual_str.lower()
        b_raw = _resolve_field(val, merged)
        b = (b_raw if b_raw else val).lower()

    if op == "=":         return a == b
    if op in ("≠", "ne"): return a != b
    if op == "<":
        try: return float(a) < float(b)
        except ValueError: return a < b
    if op == ">":
        try: return float(a) > float(b)
        except ValueError: return a > b
    return False


def _classify(
    left_data: dict,
    right_data: dict | None,
    merged: dict,
    cond_key: str,
    status_rules: dict,
    status_cols: list[str],
) -> str:
    """
    Apply DateRules chip conditions for cond_key.
    status_cols: ordered list of status names matching the rows in status_rules[cond_key].
    Returns the first matching status name, or a fallback.
    """
    rules_for_key: list[list[dict]] = status_rules.get(cond_key, [])

    for i, chips in enumerate(rules_for_key):
        if not chips:
            continue
        status_name = status_cols[i] if i < len(status_cols) else f"STATUS_{i}"
        if all(_eval_chip(c, merged, left_data, right_data) for c in chips):
            return status_name

    # Fallback: simple match/no-match
    if right_data is not None:
        return "KHOP"
    return "CHI_TRAI"


# ── Cond key + status col mapping ─────────────────────────────────────────────

# Maps (leftSource, direction) → DateRules condKey
_COND_KEY: dict[tuple[str, str], str] = {
    ("Swift", "Đi"):   "SWIFT_DI",
    ("Swift", "Đến"):  "SWIFT_DEN",
    ("NAPAS", "Đi"):   "NAPAS_DI",
    ("NAPAS", "Đến"):  "NAPAS_DEN",
    ("Core",  "Đi"):   "CORE_DI",
    ("Core",  "Đến"):  "CORE_DEN",
}

# Status names per cond_key — must match the order in DateRules SECTIONS cols
_STATUS_COLS: dict[str, list[str]] = {
    "SWIFT_DI":  ["TC_KHOP", "TC_LECH_NGAY", "TIMEOUT_KHOP", "TIMEOUT_LECH_NGAY",
                  "THAT_BAI_KHOP", "THAT_BAI_LECH_NGAY", "CHI_SWIFT"],
    "SWIFT_DEN": ["TC_KHOP", "TC_LECH_NGAY", "TIMEOUT_KHOP", "TIMEOUT_LECH_NGAY",
                  "THAT_BAI_KHOP", "THAT_BAI_LECH_NGAY"],
    "NAPAS_DI":  ["TC_KHOP_T", "TC_KHOP_T1", "KTC", "TC_KHONG_CORE"],
    "NAPAS_DEN": ["KHOP_T_TRUOC", "KHOP_CUNG_NGAY", "KHOP_T_SAU"],
    "CORE_DI":   ["CORE_SWIFT_T_TRUOC", "CORE_KHOP", "CORE_SWIFT_T_SAU", "CORE_THAT_BAI"],
    "CORE_DEN":  ["KHOP_NAPAS_T_TRUOC", "KHOP_NAPAS_CUNG_NGAY", "KHOP_NAPAS_T_SAU", "CHI_CORE"],
}


# ── Main engine ───────────────────────────────────────────────────────────────

def run_flex_reconcile(
    config_id: int,
    run_date: str | None = None,
    created_by: str = "system",
) -> dict:
    """
    Run join + classify + upsert for one reconcileJoinConfigs entry.
    Returns summary dict with counts.
    """
    today = run_date or datetime.date.today().isoformat()

    # 1. Load join config
    with db_cursor() as cur:
        cur.execute(
            "SELECT config_json FROM reconcileJoinConfigs WHERE id = ? AND is_active = 1",
            config_id,
        )
        row = cur.fetchone()
    if not row:
        raise ValueError(f"reconcileJoinConfigs id={config_id} not found")
    config: dict = json.loads(row[0])

    left_source  = config.get("leftSource", "")
    right_source = config.get("rightSource", "")
    direction    = config.get("direction", "Đi")
    match_fields: list[dict] = config.get("matchFields", [])
    join_type    = config.get("joinType", "left")

    # 2. Load latest status rules
    with db_cursor() as cur:
        cur.execute("SELECT TOP 1 rules_json FROM reconcileStatusRules ORDER BY id DESC")
        sr_row = cur.fetchone()
    status_rules: dict = json.loads(sr_row[0]) if sr_row else {}

    cond_key    = _COND_KEY.get((left_source, direction), "")
    status_cols = _STATUS_COLS.get(cond_key, [])

    config_snapshot = json.dumps(
        {"config": config, "status_rules_cond_key": cond_key},
        ensure_ascii=False,
    )

    # 3. Resolve type codes → IDs
    left_type_code  = _SOURCE_TYPE_CODE.get((left_source, direction))
    right_type_code = _SOURCE_TYPE_CODE.get((right_source, direction))

    left_type_id  = _get_type_id(left_type_code)  if left_type_code  else None
    right_type_id = _get_type_id(right_type_code) if right_type_code else None

    if not left_type_id:
        raise ValueError(f"Cannot resolve type for {left_source}/{direction}")

    # 4. Load rows
    left_filter  = _ROW_FILTER.get((left_source,  direction))
    right_filter = _ROW_FILTER.get((right_source, direction))

    left_rows  = _load_rows(left_type_id,  left_filter)
    right_rows = _load_rows(right_type_id, right_filter) if right_type_id else []

    # 5. Index right side by join key
    right_index: dict[tuple, list] = {}
    for rr in right_rows:
        k = _make_key(rr["data"], match_fields, "right")
        right_index.setdefault(k, []).append(rr)

    # 6. Load existing results for this config+date (to preserve annotations)
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT left_row_id, note, resolved_by, resolved_at, status_override
            FROM reconcileResults
            WHERE config_id = ? AND run_date = ?
            """,
            config_id, today,
        )
        preserved: dict[int, dict] = {
            r[0]: {"note": r[1], "resolved_by": r[2], "resolved_at": r[3], "status_override": r[4]}
            for r in cur.fetchall()
        }

    # 7. Join + classify
    new_results: list[dict] = []
    matched_right_ids: set[int] = set()

    for lr in left_rows:
        k = _make_key(lr["data"], match_fields, "left")
        matches = right_index.get(k, [])

        if matches:
            for rr in matches:
                matched_right_ids.add(rr["id"])
                merged = {**lr["data"], **rr["data"]}
                status = _classify(lr["data"], rr["data"], merged, cond_key, status_rules, status_cols)
                new_results.append(_make_result(
                    config_id, today, left_type_id, right_type_id,
                    lr["id"], {"pair_1": rr["id"]}, merged,
                    status, config_snapshot, created_by, preserved.get(lr["id"]),
                ))
        else:
            if join_type in ("left", "full"):
                merged = {**lr["data"]}
                status = _classify(lr["data"], None, merged, cond_key, status_rules, status_cols)
                new_results.append(_make_result(
                    config_id, today, left_type_id, right_type_id,
                    lr["id"], {"pair_1": None}, merged,
                    status, config_snapshot, created_by, preserved.get(lr["id"]),
                ))

    # RIGHT_ONLY rows for full outer join
    if join_type == "full":
        for rr in right_rows:
            if rr["id"] not in matched_right_ids:
                merged = {**rr["data"]}
                new_results.append(_make_result(
                    config_id, today, left_type_id, right_type_id,
                    rr["id"], {"pair_1": None}, merged,
                    "CHI_PHAI", config_snapshot, created_by, None,
                ))

    # 8. Upsert — delete old rows then insert fresh (preserving annotations)
    with db_cursor() as cur:
        cur.execute(
            "DELETE FROM reconcileResults WHERE config_id = ? AND run_date = ?",
            config_id, today,
        )
        for r in new_results:
            cur.execute(
                """
                INSERT INTO reconcileResults
                  (config_id, run_date, left_type_id, right_type_id, left_row_id,
                   matched_ids, merged_data, status, status_override, is_stale,
                   config_snapshot, note, resolved_by, resolved_at, created_by)
                VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?,?,?)
                """,
                r["config_id"], r["run_date"], r["left_type_id"], r["right_type_id"],
                r["left_row_id"], r["matched_ids"], r["merged_data"], r["status"],
                r["status_override"], r["config_snapshot"],
                r["note"], r["resolved_by"], r["resolved_at"], r["created_by"],
            )

    return {
        "inserted": len(new_results),
        "left_rows": len(left_rows),
        "right_rows": len(right_rows),
        "run_date": today,
        "config_id": config_id,
    }


def _make_result(
    config_id, run_date, left_type_id, right_type_id,
    left_row_id, matched_ids, merged, status,
    config_snapshot, created_by, preserved: dict | None,
) -> dict:
    p = preserved or {}
    return {
        "config_id":       config_id,
        "run_date":        run_date,
        "left_type_id":    left_type_id,
        "right_type_id":   right_type_id,
        "left_row_id":     left_row_id,
        "matched_ids":     json.dumps(matched_ids, ensure_ascii=False),
        "merged_data":     json.dumps(merged,      ensure_ascii=False),
        "status":          status,
        "status_override": p.get("status_override"),
        "config_snapshot": config_snapshot,
        "note":            p.get("note"),
        "resolved_by":     p.get("resolved_by"),
        "resolved_at":     p.get("resolved_at"),
        "created_by":      created_by,
    }


# ── Stale marking helpers (called from other routers) ─────────────────────────

def clear_type_id_cache() -> None:
    """Called when a type's schema/is_active changes — type_id resolution may
    no longer be valid. NOT called on plain file uploads, since a type's id
    doesn't change just because a new file was added for it."""
    _type_id_cache.clear()


def mark_stale_by_type(type_id: int) -> None:
    """Called when a type schema changes or new file is uploaded for type_id."""
    with db_cursor() as cur:
        cur.execute(
            "UPDATE reconcileResults SET is_stale = 1 WHERE left_type_id = ? OR right_type_id = ?",
            type_id, type_id,
        )


def mark_stale_by_config(config_id: int) -> None:
    """Called when a join config changes."""
    with db_cursor() as cur:
        cur.execute(
            "UPDATE reconcileResults SET is_stale = 1 WHERE config_id = ?",
            config_id,
        )


def mark_stale_all() -> None:
    """Called when status rules change — all results may be affected."""
    with db_cursor() as cur:
        cur.execute("UPDATE reconcileResults SET is_stale = 1")
