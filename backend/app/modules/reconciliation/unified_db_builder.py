"""
Build unified transaction rows from DB (uploadedFileRows).
Mirrors rows_builder.py logic but reads from DB instead of Excel files.
"""
from __future__ import annotations

from app.modules.reconciliation.engine_flex import _get_type_id, _load_rows
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


def _build_from_db() -> list[dict]:
    def load(type_code, row_filter=None):
        tid = _get_type_id(type_code)
        return _load_rows(tid, row_filter) if tid else []

    swift_di_rows  = load('swift_di')
    swift_den_rows = load('swift_den')
    core_rows      = load('core_banking')
    napas_di_rows  = load('napas_di')
    napas_den_rows = load('napas_den')
    napas_ktc_rows = load('napas_di_ktc')

    # ── Build NAPAS indexes (keyed by số_trace) ────────────────────────────────
    def _napas_entry(d, failed):
        return {
            'amount':    _to_int(d.get('số_tiền')) or 0,
            'raw_ngay':  d.get('ngày_gd'),
            'time':      _napas_time_fmt(d.get('giờ_gd')) if d.get('giờ_gd') is not None else None,
            'failed':    failed,
            'sheet_day': d.get('_sheet_day'),
        }

    napas_di: dict[str, dict] = {}
    for r in napas_di_rows:
        trace = _to_str(r['data'].get('số_trace'))
        if trace:
            napas_di[trace] = _napas_entry(r['data'], False)

    napas_den: dict[str, dict] = {}
    for r in napas_den_rows:
        trace = _to_str(r['data'].get('số_trace'))
        if trace:
            napas_den[trace] = _napas_entry(r['data'], False)

    napas_ktc: dict[str, dict] = {}
    for r in napas_ktc_rows:
        trace = _to_str(r['data'].get('số_trace'))
        if trace:
            napas_ktc[trace] = _napas_entry(r['data'], True)

    # ── Build Core indexes ──────────────────────────────────────────────────────
    # Keyed primarily by composite (teller, seq) — per ADR-006, plain `seq` resets
    # per shift/teller and collides across days (confirmed: 5 real collisions in
    # production data, e.g. seq=1063 exists on both 02/02 and 03/02 with different
    # tellers). A plain-seq fallback is kept only for sequences that are
    # unambiguous across the whole file, so rows with a missing teller still
    # match safely. Deliberately NOT keyed by date — Core is always day T while
    # Swift can be T or T+1 (ADR-003/4.4), so requiring exact date equality here
    # would break the intentional KHOP_LECH_NGAY day-offset tolerance.
    core_cred: dict = {}   # credit (ghi có) — matches Swift DI
    core_deb:  dict = {}   # debit  (ghi nợ) — matches Swift DEN

    _core_credit_rows: list[tuple[str, str | None, dict]] = []
    _core_debit_rows:  list[tuple[str, str | None, dict]] = []
    _seq_tellers_cred: dict[str, set] = {}
    _seq_tellers_deb:  dict[str, set] = {}

    for r in core_rows:
        d = r['data']
        seq = _to_str(d.get('sequence'))
        if not seq:
            continue
        core_dt = _parse_db_date(d.get('ngày_giao_dịch'))
        if not core_dt:
            continue
        teller = _teller_key(d.get('teller'))
        credit = _to_int(d.get('số_tiền_ghi_có')) or 0
        debit  = _to_int(d.get('số_tiền_ghi_nợ')) or 0

        if credit > 0:
            entry = {'amount': credit, 'date': core_dt}
            _core_credit_rows.append((seq, teller, entry))
            _seq_tellers_cred.setdefault(seq, set()).add(teller)
        elif debit > 0:
            entry = {'amount': debit, 'date': core_dt}
            _core_debit_rows.append((seq, teller, entry))
            _seq_tellers_deb.setdefault(seq, set()).add(teller)

    for seq, teller, entry in _core_credit_rows:
        if teller:
            core_cred[(teller, seq)] = entry
        if len(_seq_tellers_cred.get(seq, ())) <= 1:
            core_cred[seq] = entry

    for seq, teller, entry in _core_debit_rows:
        if teller:
            core_deb[(teller, seq)] = entry
        if len(_seq_tellers_deb.get(seq, ())) <= 1:
            core_deb[seq] = entry

    def _core_lookup(index: dict, seq: str | None, teller: str | None) -> dict | None:
        if not seq:
            return None
        if teller:
            hit = index.get((teller, seq))
            if hit is not None:
                return hit
        return index.get(seq)

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
        teller_k    = _teller_key(d.get('teller'))
        core_e      = _core_lookup(core_cred, seq, teller_k)
        core_entry  = 'Ghi có'
        if core_e and core_e['amount'] != amt:
            core_e = None
        if core_e is None:
            core_e = _core_lookup(core_deb, seq, teller_k)
            core_entry = 'Ghi nợ'
            if core_e and core_e['amount'] != amt:
                core_e = None

        is_ktc = bool(trace and trace in napas_ktc)
        n_tc   = napas_di.get(trace) if trace else None
        if n_tc and n_tc['amount'] != amt:
            n_tc = None
        if st == 'THAT_BAI':
            # Don't discard a genuine Core match just because Swift/NAPAS both
            # reported failure — if Core actually posted the money anyway,
            # that's a real anomaly that must stay visible (see
            # NAPAS_THAT_BAI_CO_CORE / SWIFT_THAT_BAI_CO_CORE below), not be
            # silently hidden. Only the (unrelated) TC-file napas match is
            # discarded, since a failed Swift transaction shouldn't be
            # attributed to a coincidentally-matching successful NAPAS entry.
            n_tc = None

        n_info = napas_ktc.get(trace) if is_ktc else n_tc
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
        teller_k    = _teller_key(d.get('teller'))
        core_e      = _core_lookup(core_deb, seq, teller_k)
        core_entry  = 'Ghi nợ'
        if core_e and core_e['amount'] != amt:
            core_e = None
        if core_e is None:
            core_e = _core_lookup(core_cred, seq, teller_k)
            core_entry = 'Ghi có'
            if core_e and core_e['amount'] != amt:
                core_e = None

        n_tc = napas_den.get(trace) if trace else None
        if n_tc and n_tc['amount'] != amt:
            n_tc = None
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

    for trace, entry in napas_di.items():
        if trace in swift_di_traces:
            continue
        row = _chi_napas_row(trace, entry, 'Đi')
        row['id'] = f'r{rid:05d}'
        rows.append(row)
        rid += 1

    for trace, entry in napas_den.items():
        if trace in swift_den_traces:
            continue
        row = _chi_napas_row(trace, entry, 'Đến')
        row['id'] = f'r{rid:05d}'
        rows.append(row)
        rid += 1

    return rows


def get_db_rows() -> list[dict]:
    return _build_from_db()
