"""
Build unified transaction rows from DB (uploadedFileRows).
Mirrors rows_builder.py logic but reads from DB instead of Excel files.

Join keys (which fields link Swift↔Core↔NAPAS) are read live from
`reconcileJoinConfigs` (the same table/UI the JoinLogic page edits) instead of
being hardcoded — editing a config's matchFields there changes matching here on
the next request, no redeploy needed. Status classification stays Python logic
(`_infer_recon_status`): its status vocabulary (KHOP/CHI_SWIFT/...CO_CORE) is
workflow-oriented and intentionally different from the date-offset vocabulary
`reconcileStatusRules`/DateRules uses for the separate Reconcile page — forcing
them into one shared rule set would break that page, so classification here
remains code, only the join keys are config-driven.
"""
from __future__ import annotations

import json

from app.db.connection import db_cursor
from app.modules.reconciliation.engine_flex import _get_type_id, _load_rows, _make_key, resolve_type_ids
from app.modules.reconciliation.rows_builder import (
    _to_int, _to_str,
    _napas_time_fmt, _swift_status, _infer_recon_status,
    _parse_swift_di_time, _parse_swift_den_time,
)


def _teller_key(raw) -> str | None:
    """Normalize teller code (strip leading zeros so '0088' == 88)."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        return str(int(float(s)))
    except (ValueError, TypeError):
        return s


def _parse_db_date(raw) -> str | None:
    """Convert any date format stored in DB to 'DD/MM/YYYY'."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    # "20260201" or "20260201.0"
    try:
        i = int(float(s))
        si = str(i)
        if len(si) == 8:
            return f'{si[6:8]}/{si[4:6]}/{si[0:4]}'
    except (ValueError, TypeError):
        pass
    # "2026-02-01" or "2026-02-01 00:00:00"
    if len(s) >= 10 and s[4:5] == '-':
        return f'{s[8:10]}/{s[5:7]}/{s[:4]}'
    # "01/02/2026"
    if len(s) == 10 and s[2:3] == '/' and s[5:6] == '/':
        return s
    return None


def _napas_date_from_db(raw, txn_date: str | None) -> tuple[str | None, str]:
    """Parse NAPAS ngày_gd (MMDD stored as string/int) → ('DD/MM/YYYY', 'GD'|'QT').

    'QT' when NAPAS GD date differs from Swift txnDate (overnight settlement).
    """
    if raw is None:
        return None, 'GD'
    try:
        i = int(float(str(raw).strip()))
        s = str(i).zfill(4)
        mm, dd = s[0:2], s[2:4]
        date_str = f'{dd}/{mm}/2026'
        if txn_date:
            txn_mmdd = txn_date[3:5] + txn_date[0:2]   # 'DD/MM/YYYY' → 'MMDD'
            typ = 'GD' if s == txn_mmdd else 'QT'
        else:
            typ = 'GD'
        return date_str, typ
    except (ValueError, TypeError):
        return None, 'GD'


# ── Join-config loading (matching keys come from here, not hardcoded) ─────────

def _load_join_field_map() -> dict[tuple[str, str, str], list[dict]]:
    """(leftSource, rightSource, direction) → matchFields, from reconcileJoinConfigs."""
    result: dict[tuple[str, str, str], list[dict]] = {}
    with db_cursor() as cur:
        cur.execute("SELECT config_json FROM reconcileJoinConfigs WHERE is_active = 1")
        rows = cur.fetchall()
    for (config_json,) in rows:
        try:
            cfg = json.loads(config_json)
        except (json.JSONDecodeError, TypeError):
            continue
        key = (cfg.get("leftSource", ""), cfg.get("rightSource", ""), cfg.get("direction", ""))
        result[key] = cfg.get("matchFields") or []
    return result


def _build_match_index(rows: list[dict], match_fields: list[dict]) -> dict[tuple, dict]:
    """Index raw row data by its configured composite match key (right side).

    Rows whose key has any missing component are skipped — a partial key would
    risk matching another row that's *also* missing the same field via a
    coincidental None==None tuple match, which is worse than just not matching.
    """
    idx: dict[tuple, dict] = {}
    if not match_fields:
        return idx
    for r in rows:
        d = r['data']
        key = _make_key(d, match_fields, "right")
        if any(p is None for p in key):
            continue
        idx[key] = d
    return idx


def _build_from_db() -> list[dict]:
    def load_by_type_code(type_code, row_filter=None):
        tid = _get_type_id(type_code)
        return _load_rows(tid, row_filter) if tid else []

    def load_by_source(source, direction=None):
        """Union rows from every active type tagged this source(+direction)
        in FileTypeSettings — not a single hardcoded type_code, so splitting
        a source into multiple uploads (e.g. Core Banking split by teller
        batch) is picked up automatically without touching this function."""
        rows = []
        for tid in resolve_type_ids(source, direction):
            rows.extend(_load_rows(tid))
        return rows

    swift_di_rows  = load_by_source('Swift', 'Đi')
    swift_den_rows = load_by_source('Swift', 'Đến')
    core_rows      = load_by_source('Core')
    napas_di_rows  = load_by_source('NAPAS', 'Đi')
    napas_den_rows = load_by_source('NAPAS', 'Đến')
    # napas_di_ktc (failed/KTC transactions) isn't part of the source+direction
    # model above — it's a 3rd axis (success vs failure) that would collide
    # with napas_di if tagged the same source+direction, so it stays resolved
    # by its fixed type_code, same as before. Low risk: unlike Core, nothing
    # has asked to split this into multiple uploads.
    napas_ktc_rows = load_by_type_code('napas_di_ktc')

    fields = _load_join_field_map()
    napas_di_fields  = fields.get(("Swift", "NAPAS", "Đi"), [])
    napas_den_fields = fields.get(("Swift", "NAPAS", "Đến"), [])
    core_di_fields   = fields.get(("Swift", "Core", "Đi"), [])
    core_den_fields  = fields.get(("Swift", "Core", "Đến"), [])

    # ── NAPAS: trace-only lookup for display/orphan-enumeration purposes ──────
    def _napas_entry(d, failed):
        return {
            'amount':    _to_int(d.get('số_tiền')) or 0,
            'raw_ngay':  d.get('ngày_gd'),
            'time':      _napas_time_fmt(d.get('giờ_gd')) if d.get('giờ_gd') is not None else None,
            'failed':    failed,
            'sheet_day': d.get('_sheet_day'),
        }

    napas_di_by_trace: dict[str, dict] = {}
    for r in napas_di_rows:
        trace = _to_str(r['data'].get('số_trace'))
        if trace:
            napas_di_by_trace[trace] = _napas_entry(r['data'], False)

    napas_den_by_trace: dict[str, dict] = {}
    for r in napas_den_rows:
        trace = _to_str(r['data'].get('số_trace'))
        if trace:
            napas_den_by_trace[trace] = _napas_entry(r['data'], False)

    napas_ktc_by_trace: dict[str, dict] = {}
    for r in napas_ktc_rows:
        trace = _to_str(r['data'].get('số_trace'))
        if trace:
            napas_ktc_by_trace[trace] = _napas_entry(r['data'], True)

    # ── Composite match indices, keyed by each pair's configured matchFields ──
    # (replaces the old hardcoded seq/teller/trace dict-building — editing a
    # config's matchFields via JoinLogic changes this on the next request)
    napas_di_match  = _build_match_index(napas_di_rows, napas_di_fields)
    napas_den_match = _build_match_index(napas_den_rows, napas_den_fields)
    core_cred_match = _build_match_index(
        [r for r in core_rows if _to_int(r['data'].get('số_tiền_ghi_có'))], core_di_fields,
    )
    core_deb_match = _build_match_index(
        [r for r in core_rows if _to_int(r['data'].get('số_tiền_ghi_nợ'))], core_den_fields,
    )

    def _core_entry(d: dict) -> dict:
        return {'amount': _to_int(d.get('số_tiền_ghi_có')) or _to_int(d.get('số_tiền_ghi_nợ')) or 0,
                'date': _parse_db_date(d.get('ngày_giao_dịch'))}

    # ── Build unified rows anchored on Swift ───────────────────────────────────
    rows: list[dict] = []
    rid = 1

    # Swift DI rows — giữ lại TẤT CẢ rows có ít nhất 1 trường key không rỗng
    for r in swift_di_rows:
        d = r['data']
        trace = _to_str(d.get('trace_number')) or None
        seq   = _to_str(d.get('seq')) or None
        amt   = _to_int(d.get('số_tiền')) or 0
        if amt == 0:
            continue

        txn_date, _ = _parse_swift_di_time(d.get('thời_gian')) if d.get('thời_gian') else (None, None)
        swift_date  = _parse_db_date(d.get('hostdate')) or txn_date
        st          = _swift_status(str(d.get('phản_hồi') or ''))
        # "day" (which day-bucket/tab this row is counted under) is anchored on
        # the file's own export sheet when known — not the row's embedded date,
        # which stays untouched below (swift_date/txn_date) and still drives
        # T-1/T/T+1 offset classification via _infer_recon_status.
        day = _parse_db_date(d.get('_sheet_day')) or txn_date or swift_date or ''

        # Thử GHI CÓ trước, fallback sang GHI NỢ — Core có thể dùng bút toán nào cũng được
        core_d = core_cred_match.get(_make_key(d, core_di_fields, "left")) if core_di_fields else None
        core_entry = 'Ghi có'
        if core_d is None and core_den_fields:
            core_d = core_deb_match.get(_make_key(d, core_den_fields, "left"))
            core_entry = 'Ghi nợ'
        core_e = _core_entry(core_d) if core_d is not None else None

        is_ktc = bool(trace and trace in napas_ktc_by_trace)
        n_d = napas_di_match.get(_make_key(d, napas_di_fields, "left")) if napas_di_fields else None
        n_tc = _napas_entry(n_d, False) if n_d is not None else None
        if st == 'THAT_BAI':
            # Don't discard a genuine Core match just because Swift/NAPAS both
            # reported failure — if Core actually posted the money anyway,
            # that's a real anomaly that must stay visible (see
            # NAPAS_THAT_BAI_CO_CORE / SWIFT_THAT_BAI_CO_CORE below), not be
            # silently hidden. Only the (unrelated) TC-file napas match is
            # discarded, since a failed Swift transaction shouldn't be
            # attributed to a coincidentally-matching successful NAPAS entry.
            n_tc = None

        n_info = napas_ktc_by_trace.get(trace) if is_ktc else n_tc
        napas_dict = None
        if n_info:
            n_date, n_type = _napas_date_from_db(n_info.get('raw_ngay'), txn_date)
            napas_dict = {
                'date': n_date, 'time': n_info.get('time'),
                'failed': n_info['failed'], 'type': n_type,
            }

        rs = _infer_recon_status(st, core_e, napas_dict, is_ktc, swift_date)

        rows.append({
            'id':        f'r{rid:05d}',
            'trace':     trace.zfill(6) if trace else None,
            'sequence':  seq,
            'direction': 'Đi',
            'amount':    amt,
            'day':       day,
            'swift':     {'date': swift_date, 'txnDate': txn_date, 'status': st},
            'core':      {'date': core_e['date'], 'entry': core_entry} if core_e else None,
            'napas':     napas_dict,
            'recon_status': rs,
            'resolved_by': None, 'resolved_at': None, 'note': None,
        })
        rid += 1

    # Swift DEN rows — giữ lại TẤT CẢ rows có ít nhất 1 trường key không rỗng
    for r in swift_den_rows:
        d = r['data']
        trace = _to_str(d.get('trace')) or None
        seq   = _to_str(d.get('seq')) or None
        amt   = _to_int(d.get('số_tiền')) or 0
        if amt == 0:
            continue

        txn_date, _ = _parse_swift_den_time(d.get('thời_gian')) if d.get('thời_gian') else (None, None)
        swift_date  = _parse_db_date(d.get('host_date')) or txn_date
        st          = _swift_status(str(d.get('phản_hồi') or ''))
        day = _parse_db_date(d.get('_sheet_day')) or txn_date or swift_date or ''

        # Thử GHI NỢ trước, fallback sang GHI CÓ
        core_d = core_deb_match.get(_make_key(d, core_den_fields, "left")) if core_den_fields else None
        core_entry = 'Ghi nợ'
        if core_d is None and core_di_fields:
            core_d = core_cred_match.get(_make_key(d, core_di_fields, "left"))
            core_entry = 'Ghi có'
        core_e = _core_entry(core_d) if core_d is not None else None

        n_d = napas_den_match.get(_make_key(d, napas_den_fields, "left")) if napas_den_fields else None
        n_tc = _napas_entry(n_d, False) if n_d is not None else None
        if st == 'THAT_BAI':
            core_e = None
            n_tc   = None

        napas_dict = None
        if n_tc:
            n_date, n_type = _napas_date_from_db(n_tc.get('raw_ngay'), txn_date)
            napas_dict = {
                'date': n_date, 'time': n_tc.get('time'),
                'failed': False, 'type': n_type,
            }

        rs = _infer_recon_status(st, core_e, napas_dict, False, swift_date)

        rows.append({
            'id':        f'r{rid:05d}',
            'trace':     trace.zfill(6) if trace else None,
            'sequence':  seq,
            'direction': 'Đến',
            'amount':    amt,
            'day':       day,
            'swift':     {'date': swift_date, 'txnDate': txn_date, 'status': st},
            'core':      {'date': core_e['date'], 'entry': core_entry} if core_e else None,
            'napas':     napas_dict,
            'recon_status': rs,
            'resolved_by': None, 'resolved_at': None, 'note': None,
        })
        rid += 1

    # ── CHI_NAPAS rows — NAPAS entries with no Swift counterpart at all ────────
    # Per ADR-001 (docs/handover.md): these are valid transactions (NAPAS
    # confirmed them; Swift/Core just haven't/won't produce a matching record)
    # and must still appear in the master view, not be silently dropped because
    # the row-building above only walks Swift.
    swift_di_traces  = {_to_str(r['data'].get('trace_number')) for r in swift_di_rows  if r['data'].get('trace_number')}
    swift_den_traces = {_to_str(r['data'].get('trace'))        for r in swift_den_rows if r['data'].get('trace')}

    def _chi_napas_row(trace: str, entry: dict, direction: str) -> dict:
        n_date, n_type = _napas_date_from_db(entry.get('raw_ngay'), None)
        day = _parse_db_date(entry.get('sheet_day')) or n_date or ''
        return {
            'id':        None,   # filled by caller
            'trace':     trace.zfill(6),
            'sequence':  None,
            'direction': direction,
            'amount':    entry['amount'],
            'day':       day,
            'swift':     None,
            'core':      None,
            'napas':     {'date': n_date, 'time': entry.get('time'), 'failed': False, 'type': n_type},
            'recon_status': 'CHI_NAPAS',
            'resolved_by': None, 'resolved_at': None, 'note': None,
        }

    for trace, entry in napas_di_by_trace.items():
        if trace in swift_di_traces:
            continue
        row = _chi_napas_row(trace, entry, 'Đi')
        row['id'] = f'r{rid:05d}'
        rows.append(row)
        rid += 1

    for trace, entry in napas_den_by_trace.items():
        if trace in swift_den_traces:
            continue
        row = _chi_napas_row(trace, entry, 'Đến')
        row['id'] = f'r{rid:05d}'
        rows.append(row)
        rid += 1

    return rows


# In-memory cache: _build_from_db() does a full in-memory join across 6 file
# types (Swift Đi/Đến, Core, NAPAS Đi/Đến/KTC) plus match-index construction —
# this is the actual "load time" cost for CoreSummary/NapasCore/SwiftCore/
# MasterSummary (all 4 call this endpoint), not the payload size. Their KPI
# filters are JS closures (data/reconcile.js filterFn) evaluated over
# recon_status/resolution fields — not portable to a server-side query filter
# without duplicating that classification logic, so pagination here (unlike
# /flex/rows) would only shrink the response, not the rebuild cost that
# dominates. Caching the built result and invalidating on any data change
# (upload/purge/delete/schema/join-config edit — same call sites already
# calling mark_stale_by_type/mark_stale_by_config/mark_stale_all/
# clear_type_id_cache, see flex/router.py and reconciliation/router.py) fixes
# the actual bottleneck instead.
_db_rows_cache: list[dict] | None = None


def get_db_rows() -> list[dict]:
    global _db_rows_cache
    if _db_rows_cache is None:
        _db_rows_cache = _build_from_db()
    return _db_rows_cache


def clear_db_rows_cache() -> None:
    global _db_rows_cache
    _db_rows_cache = None
