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
import unicodedata
from typing import Any, Callable

from app.db.connection import db_cursor

# ── Source/direction → type resolution ────────────────────────────────────────
# Which uploadedTypes row(s) represent "Swift, Đi" or "Core" is now read from
# each type's own fields_schema.source/direction (set in FileTypeSettings),
# not hardcoded here. Previously this was a fixed {(source,direction): "swift_di"}
# dict — any time a type got renamed or a source got split into multiple
# uploads (e.g. Core Banking split into separate Đi/Đến files), the hardcoded
# type_code would silently point at the wrong type, or a type sharing that
# type_code by coincidence would win a `.find()`/lookup. See
# docs/agent-notes.md for the incident this replaced.
#
# Core is intentionally NOT tagged with a direction: Core GL entries are
# split into Đi/Đến per ROW (whichever of số_tiền_ghi_có/số_tiền_ghi_nợ is
# populated), not per upload — so ALL types tagged source="Core" (whether
# that's one combined upload or several split by teller/batch) are unioned
# together first, then filtered by row content. Confirmed from data: ghi_có
# entries are Đi-direction, ghi_nợ entries are Đến-direction.
_CORE_ROW_FILTER: dict[str, Callable[[dict], bool]] = {
    "Đi":  lambda d: bool(d.get("số_tiền_ghi_có")),
    "Đến": lambda d: bool(d.get("số_tiền_ghi_nợ")),
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


# (source, direction-or-None) → resolved type_id(s). direction=None only
# valid for source="Core" (see module docstring above) — returns every
# matching type_id, unioned by the caller. Any other source requires a
# direction and resolves to exactly one type_id.
_source_resolve_cache: dict[tuple[str, str | None], list[int]] = {}


def resolve_type_ids(source: str, direction: str | None) -> list[int]:
    """Active uploadedTypes tagged with this source (+ direction, for
    Swift/NAPAS). Empty list means nothing is configured yet — callers
    should surface that as an actionable error, not fail silently."""
    cache_key = (source, direction)
    cached = _source_resolve_cache.get(cache_key)
    if cached is not None:
        return cached
    with db_cursor() as cur:
        if source == "Core":
            cur.execute(
                "SELECT id FROM uploadedTypes WHERE is_active = 1 AND JSON_VALUE(fields_schema,'$.source') = ?",
                source,
            )
        else:
            cur.execute(
                """
                SELECT id FROM uploadedTypes
                WHERE is_active = 1
                  AND JSON_VALUE(fields_schema,'$.source') = ?
                  AND JSON_VALUE(fields_schema,'$.direction') = ?
                """,
                source, direction,
            )
        result = [r[0] for r in cur.fetchall()]
    if result:
        _source_resolve_cache[cache_key] = result
    return result


def _resolve_and_load(source: str, direction: str) -> tuple[int | None, list[dict]]:
    """Resolve (source, direction) to its rows. Core unions all source="Core"
    types and filters by row content (see resolve_type_ids docstring);
    everything else is exactly one type. Returns (representative_type_id,
    rows) — type_id is None (and rows []) if nothing is configured yet."""
    if source == "Core":
        type_ids = resolve_type_ids("Core", None)
        if not type_ids:
            return None, []
        row_filter = _CORE_ROW_FILTER.get(direction)
        rows: list[dict] = []
        for tid in type_ids:
            rows.extend(_load_rows(tid, row_filter))
        return type_ids[0], rows

    type_ids = resolve_type_ids(source, direction)
    if not type_ids:
        return None, []
    return type_ids[0], _load_rows(type_ids[0])


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


def _norm(s: str) -> str:
    """Diacritic- and case-insensitive key: 'Ngày GD' / 'Ngay GD' / 'ngày gd' all match.
    reconcileStatusRules rows saved by seed.py use plain-ASCII field names
    ("Ngay GD") while this module and the DateRules UI use Vietnamese
    diacritics ("Ngày GD") — without normalizing, every date-comparison
    chip loaded from a freshly-seeded DB silently resolves to "" and never
    matches, so day-matched vs day-mismatched statuses can't be told apart.
    """
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").strip().lower()


_FIELD_ALIASES_NORM: dict[str, list[str]] = {_norm(k): v for k, v in _FIELD_ALIASES.items()}
_DATE_FIELDS_NORM = {_norm(x) for x in ("Ngày GD", "Ngày GN", "Ngày NAPAS", "Ngày Core", "Ngày Swift")}

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
    # Diacritic/case-insensitive fallback (see _norm docstring).
    for key in _FIELD_ALIASES_NORM.get(_norm(f), []):
        if key in merged and merged[key] is not None:
            return str(merged[key]).strip()
    return ""


def _is_date_field(name: str) -> bool:
    return _norm(name) in _DATE_FIELDS_NORM


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

    if _is_date_field(val) or _is_date_field(f):
        # Date comparison: normalize both to YYYY-MM-DD
        a = _to_date_str(actual_str)
        b_raw = _resolve_field(val, merged) if _is_date_field(val) else val
        b = _to_date_str(b_raw)
    else:
        # Diacritic/case-insensitive comparison for status values — DateRules'
        # suggestion dropdown offers accented text ("Thành công") while raw
        # data is unaccented ("THANH CONG"); must normalize both the same way.
        a = _norm(actual_str)
        b_raw = _resolve_field(val, merged)
        b = _norm(b_raw if b_raw else val)

    if op == "=":         return a == b
    if op in ("≠", "ne"): return a != b
    if op == "<":
        try: return float(a) < float(b)
        except ValueError: return a < b
    if op == ">":
        try: return float(a) > float(b)
        except ValueError: return a > b
    return False


def _eval_rule_groups(groups: list[list[dict]], merged: dict, left_data: dict, right_data: dict | None) -> bool:
    """A rule matches if ANY group matches, and a group matches if ALL its
    chips match — i.e. groups are OR'd together, chips within a group are
    AND'd. A single-group rule with N chips behaves exactly like the old
    "all chips must match" format (this is what a migrated legacy rule
    looks like: groups=[the original chip list])."""
    return any(
        all(_eval_chip(c, merged, left_data, right_data) for c in group)
        for group in groups
    )


def _classify(
    left_data: dict,
    right_data: dict | None,
    merged: dict,
    cond_key: str,
    status_rules: dict,
) -> str:
    """Apply DateRules rules for cond_key, in order, first match wins.
    Each rule is self-describing: {id, label, color, groups: [[chip,...],...]}.
    Returns the matching rule's label, or a fallback status name."""
    rules_for_key: list[dict] = status_rules.get(cond_key, [])

    for rule in rules_for_key:
        groups = rule.get("groups") or []
        if not groups:
            continue
        if _eval_rule_groups(groups, merged, left_data, right_data):
            return rule.get("label") or rule.get("id") or "KHOP"

    # Fallback: simple match/no-match
    if right_data is not None:
        return "KHOP"
    return "CHI_TRAI"


# ── Cond key mapping ────────────────────────────────────────────────────────

# Maps (leftSource, direction) → DateRules condKey
_COND_KEY: dict[tuple[str, str], str] = {
    ("Swift", "Đi"):   "SWIFT_DI",
    ("Swift", "Đến"):  "SWIFT_DEN",
    ("NAPAS", "Đi"):   "NAPAS_DI",
    ("NAPAS", "Đến"):  "NAPAS_DEN",
    ("Core",  "Đi"):   "CORE_DI",
    ("Core",  "Đến"):  "CORE_DEN",
}

# ── Legacy format migration ───────────────────────────────────────────────────
# Old reconcileStatusRules shape: {cond_key: [[chip,...], [chip,...], ...]} —
# status NAME/label/color lived in separate frontend arrays (data/reconcile.js
# SWIFT_COLS_DI etc.) matched purely by array position — fragile, and made it
# impossible to add/remove/reorder a status without editing frontend source.
# New shape: {cond_key: [{id, label, color, groups: [[chip,...],...]}, ...]}
# — every rule carries its own identity, no positional coupling to anything.
# _LEGACY_RULE_META supplies the label/color a legacy rule gets migrated to
# (mirrors the labels historically shown in frontend/src/data/reconcile.js's
# SWIFT_COLS_DI/SWIFT_COLS_DEN/NAPAS_COLS_DI/NAPAS_COLS_DEN/CORE_COLS_DI/
# CORE_COLS_DEN, transcribed here since the backend can't import a JS file —
# NOT used at runtime for anything except generating a readable label the
# first time an old-format row is migrated).
_LEGACY_RULE_META: dict[str, list[tuple[str, str]]] = {
    "SWIFT_DI": [
        ("Thành công – Core ngày T", "#059669"), ("Thành công – Core ngày T+1", "#0891b2"),
        ("Timeout – Core ngày T", "#d97706"), ("Timeout – Core ngày T+1", "#f59e0b"),
        ("Thất bại – ngày T", "#6b7280"), ("Thất bại – ngày T+1", "#9ca3af"),
        ("Chỉ Swift", "#dc2626"),
    ],
    "SWIFT_DEN": [
        ("Thành công – Core ngày T", "#059669"), ("Thành công – Core ngày T+1", "#0891b2"),
        ("Timeout – Core ngày T", "#d97706"), ("Timeout – Core ngày T+1", "#f59e0b"),
        ("Thất bại – ngày T", "#6b7280"), ("Thất bại – ngày T+1", "#9ca3af"),
        ("Chỉ Swift", "#dc2626"),
    ],
    "NAPAS_DI": [
        ("Thành công – NAPAS ngày T-1, Core ngày T", "#0891b2"),
        ("Thành công – NAPAS ngày T, Core ngày T", "#059669"),
        ("Không thành công (KTC)", "#dc2626"),
        ("Chỉ NAPAS TC – không có Core", "#d97706"),
    ],
    "NAPAS_DEN": [
        ("Thành công – Core ngày T-1", "#7c3aed"),
        ("Thành công – Core ngày T", "#059669"),
        ("Thành công – Core ngày T+1", "#0891b2"),
    ],
    "CORE_DI": [
        ("Swift ngày T-1 – NAPAS ngày T", "#0891b2"), ("Swift ngày T – NAPAS ngày T", "#059669"),
        ("Swift ngày T – NAPAS ngày T+1", "#7c3aed"), ("Thất bại – không có trên NAPAS", "#d97706"),
    ],
    "CORE_DEN": [
        ("Core ngày T – NAPAS ngày T-1", "#0891b2"), ("Core ngày T – NAPAS ngày T", "#059669"),
        ("Core ngày T – NAPAS ngày T+1", "#7c3aed"), ("Core có – không có NAPAS", "#d97706"),
    ],
}

_PALETTE = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#64748b"]


def migrate_status_rules(rules: dict) -> tuple[dict, bool]:
    """Upgrade any old-format (bare chip-list) cond_key entries to the new
    self-describing rule-object format. Returns (possibly-new dict, changed?).
    Safe/idempotent: cond_keys already in the new format pass through
    untouched; existing conditions are preserved exactly (wrapped as a
    single OR-group), only the label/color/id wrapper is added."""
    changed = False
    out: dict = {}
    for cond_key, entries in (rules or {}).items():
        if not entries or not isinstance(entries, list):
            out[cond_key] = entries
            continue
        if isinstance(entries[0], dict) and "groups" in entries[0]:
            out[cond_key] = entries  # already new format
            continue
        # Old format: entries is a list of chip-lists
        changed = True
        meta = _LEGACY_RULE_META.get(cond_key, [])
        migrated = []
        for i, chips in enumerate(entries):
            label, color = meta[i] if i < len(meta) else (f"Trạng thái {i + 1}", _PALETTE[i % len(_PALETTE)])
            migrated.append({
                "id": f"{cond_key.lower()}_{i}",
                "label": label,
                "color": color,
                "groups": [chips] if chips else [],
            })
        out[cond_key] = migrated
    return out, changed


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

    # 2. Load latest status rules (auto-upgrade legacy format if needed)
    with db_cursor() as cur:
        cur.execute("SELECT TOP 1 id, rules_json FROM reconcileStatusRules ORDER BY id DESC")
        sr_row = cur.fetchone()
    status_rules: dict = json.loads(sr_row[1]) if sr_row else {}
    status_rules, was_migrated = migrate_status_rules(status_rules)
    if was_migrated and sr_row:
        with db_cursor() as cur:
            cur.execute(
                "UPDATE reconcileStatusRules SET rules_json = ? WHERE id = ?",
                json.dumps(status_rules, ensure_ascii=False), sr_row[0],
            )

    cond_key = _COND_KEY.get((left_source, direction), "")

    config_snapshot = json.dumps(
        {"config": config, "status_rules_cond_key": cond_key},
        ensure_ascii=False,
    )

    # 3+4. Resolve source/direction → type(s), and load their rows. For Core
    # this unions every type tagged source="Core" and splits Đi/Đến by row
    # content (số_tiền_ghi_có vs số_tiền_ghi_nợ); for Swift/NAPAS it's a
    # single type per (source, direction). left_type_id/right_type_id below
    # are used only for reconcileResults' cache-invalidation columns — for a
    # multi-type Core, that's the first matching type_id (a known, accepted
    # limitation: mark_stale_by_type() on the other Core type(s) won't mark
    # this result stale — soft UX gap, not a data-correctness one).
    left_type_id, left_rows = _resolve_and_load(left_source, direction)
    right_type_id, right_rows = _resolve_and_load(right_source, direction) if right_source else (None, [])

    if left_type_id is None:
        raise ValueError(
            f"Không tìm thấy loại file nào gán Nguồn={left_source}"
            + (f", Chiều={direction}" if left_source != "Core" else "")
            + " — vào Cấu hình loại file để gán."
        )
    # right_source == "" is a legitimate one-sided config (right_type_id is
    # None by design in that case) — but if right_source WAS given and still
    # failed to resolve, this used to silently continue with right_rows=[],
    # so every left row got 0 matches with no explanation ("nothing matched"
    # looked like a join/data bug when it was really an untagged type).
    if right_source and right_type_id is None:
        raise ValueError(
            f"Không tìm thấy loại file nào gán Nguồn={right_source}"
            + (f", Chiều={direction}" if right_source != "Core" else "")
            + " — vào Cấu hình loại file để gán."
        )

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
                status = _classify(lr["data"], rr["data"], merged, cond_key, status_rules)
                new_results.append(_make_result(
                    config_id, today, left_type_id, right_type_id,
                    lr["id"], {"pair_1": rr["id"]}, merged,
                    status, config_snapshot, created_by, preserved.get(lr["id"]),
                ))
        else:
            if join_type in ("left", "full"):
                merged = {**lr["data"]}
                status = _classify(lr["data"], None, merged, cond_key, status_rules)
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
    _source_resolve_cache.clear()


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
