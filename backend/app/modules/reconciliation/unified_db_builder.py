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
            'amount':   _to_int(d.get('số_tiền')) or 0,
            'raw_ngay': d.get('ngày_gd'),
            'time':     _napas_time_fmt(d.get('giờ_gd')) if d.get('giờ_gd') is not None else None,
            'failed':   failed,
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

    # ── Build Core indexes (keyed by sequence) ─────────────────────────────────
    core_cred: dict[str, dict] = {}   # credit (ghi có) — matches Swift DI
    core_deb:  dict[str, dict] = {}   # debit  (ghi nợ) — matches Swift DEN

    for r in core_rows:
        d = r['data']
        seq = _to_str(d.get('sequence'))
        if not seq:
            continue
        core_dt = _parse_db_date(d.get('ngày_giao_dịch'))
        if not core_dt:
            continue
        credit = _to_int(d.get('số_tiền_ghi_có')) or 0
        debit  = _to_int(d.get('số_tiền_ghi_nợ')) or 0
        if credit > 0:
            core_cred[seq] = {'amount': credit, 'date': core_dt}
        elif debit > 0:
            core_deb[seq] = {'amount': debit, 'date': core_dt}

    # ── Build unified rows anchored on Swift ───────────────────────────────────
    rows: list[dict] = []
    rid = 1

    # Swift DI rows — giữ lại TẤT CẢ rows có ít nhất 1 trường key không rỗng
    for r in swift_di_rows:
        d = r['data']
        trace = _to_str(d.get('trace_number')) or None
        seq   = _to_str(d.get('seq')) or None
        amt   = _to_int(d.get('số_tiền')) or 0
        # Bỏ qua row trắng (header/blank) lọt vào DB khi upload
        if trace is None and seq is None and amt == 0:
            continue

        txn_date, _ = _parse_swift_di_time(d.get('thời_gian')) if d.get('thời_gian') else (None, None)
        swift_date  = _parse_db_date(d.get('hostdate')) or txn_date
        st          = _swift_status(str(d.get('phản_hồi') or ''))
        day         = txn_date or swift_date or ''

        core_e = core_cred.get(seq) if seq else None
        if core_e and core_e['amount'] != amt:
            core_e = None

        is_ktc = bool(trace and trace in napas_ktc)
        n_tc   = napas_di.get(trace) if trace else None
        if n_tc and n_tc['amount'] != amt:
            n_tc = None
        if st == 'THAT_BAI':
            core_e = None
            n_tc   = None

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
            'core':      {'date': core_e['date'], 'entry': 'Ghi có'} if core_e else None,
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
        # Bỏ qua row trắng
        if trace is None and seq is None and amt == 0:
            continue

        txn_date, _ = _parse_swift_den_time(d.get('thời_gian')) if d.get('thời_gian') else (None, None)
        swift_date  = _parse_db_date(d.get('host_date')) or txn_date
        st          = _swift_status(str(d.get('phản_hồi') or ''))
        day         = txn_date or swift_date or ''

        core_e = core_deb.get(seq) if seq else None
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
            'core':      {'date': core_e['date'], 'entry': 'Ghi nợ'} if core_e else None,
            'napas':     napas_dict,
            'recon_status': rs,
            'resolved_by': None, 'resolved_at': None, 'note': None,
        })
        rid += 1

    return rows


def get_db_rows() -> list[dict]:
    return _build_from_db()
