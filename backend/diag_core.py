"""
Diagnostic: tìm nguyên nhân 2,412 CHI_SWIFT Đi không khớp Core.
Chạy từ thư mục backend/: python diag_core.py
"""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
from app.db.connection import db_cursor
from app.modules.reconciliation.engine_flex import _get_type_id, _load_rows
from app.modules.reconciliation.rows_builder import _to_int, _to_str

def sep(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

# ── 1. Kiểm tra Core Banking: sequence có bị null không? ──────────────────
sep("1. CORE BANKING — sequence null/non-null stats")
tid_core = _get_type_id('core_banking')
print(f"  core_banking type_id = {tid_core}")

core_rows = _load_rows(tid_core) if tid_core else []
print(f"  Tổng rows Core: {len(core_rows)}")

null_seq   = sum(1 for r in core_rows if not _to_str(r['data'].get('sequence')))
null_date  = sum(1 for r in core_rows if not r['data'].get('ngày_giao_dịch'))
has_credit = sum(1 for r in core_rows if _to_int(r['data'].get('số_tiền_ghi_có') or 0) or 0 > 0)
has_debit  = sum(1 for r in core_rows if _to_int(r['data'].get('số_tiền_ghi_nợ') or 0) or 0 > 0)

print(f"  Rows có sequence null/rỗng: {null_seq}  ({null_seq*100//len(core_rows) if core_rows else 0}%)")
print(f"  Rows không có ngày_giao_dịch: {null_date}")
print(f"  Rows có ghi_có > 0: {has_credit}")
print(f"  Rows có ghi_nợ > 0: {has_debit}")

sep("2. CORE BANKING — 5 rows mẫu (cả null và non-null sequence)")
null_samples    = [r for r in core_rows if not _to_str(r['data'].get('sequence'))][:3]
nonnull_samples = [r for r in core_rows if _to_str(r['data'].get('sequence'))][:3]

for label, samples in [("NULL sequence", null_samples), ("HAS sequence", nonnull_samples)]:
    print(f"\n--- {label} ---")
    for r in samples:
        d = r['data']
        print(f"  sequence={d.get('sequence')!r}  trace={d.get('trace')!r}")
        print(f"  ghi_có={d.get('số_tiền_ghi_có')}  ghi_nợ={d.get('số_tiền_ghi_nợ')}")
        print(f"  ngày={d.get('ngày_giao_dịch')}  diễn_giải={str(d.get('diễn_giải',''))[:80]}")

# ── 2. Kiểm tra Swift DI: seq có bị null không? ───────────────────────────
sep("3. SWIFT DI — seq null/non-null stats")
tid_sdi = _get_type_id('swift_di')
print(f"  swift_di type_id = {tid_sdi}")

sdi_rows = _load_rows(tid_sdi) if tid_sdi else []
print(f"  Tổng rows Swift Đi: {len(sdi_rows)}")

sdi_null_seq = sum(1 for r in sdi_rows if not _to_str(r['data'].get('seq')))
sdi_null_tr  = sum(1 for r in sdi_rows if not _to_str(r['data'].get('trace_number')))
sdi_thanh    = sum(1 for r in sdi_rows if 'thanh' in str(r['data'].get('phản_hồi','')).lower())
sdi_that_bai = sum(1 for r in sdi_rows if not r['data'].get('phản_hồi'))

print(f"  Rows seq null: {sdi_null_seq}")
print(f"  Rows trace null: {sdi_null_tr}")
print(f"  Rows phản_hồi chứa 'thanh': {sdi_thanh}")
print(f"  Rows phản_hồi null/rỗng: {sdi_that_bai}")

sep("4. SWIFT DI — 3 rows mẫu có seq non-null")
sdi_with_seq = [r for r in sdi_rows if _to_str(r['data'].get('seq'))][:3]
for r in sdi_with_seq:
    d = r['data']
    print(f"  seq={d.get('seq')!r}  trace={d.get('trace_number')!r}")
    print(f"  số_tiền={d.get('số_tiền')}  phản_hồi={d.get('phản_hồi')!r}")

# ── 3. Thử match trực tiếp: lấy 5 CHI_SWIFT, check tại sao không khớp Core ─
sep("5. CROSS-CHECK: 5 Swift DI có seq — tìm trong Core")

# Build Core indexes
from collections import defaultdict
core_by_seq_credit = {}
core_by_seq_debit  = {}
for r in core_rows:
    d   = r['data']
    seq = _to_str(d.get('sequence'))
    if not seq:
        continue
    credit = _to_int(d.get('số_tiền_ghi_có')) or 0
    debit  = _to_int(d.get('số_tiền_ghi_nợ')) or 0
    if credit > 0:
        core_by_seq_credit[seq] = credit
    if debit > 0:
        core_by_seq_debit[seq] = debit

print(f"  Core index có sequence: credit={len(core_by_seq_credit)}  debit={len(core_by_seq_debit)}")

# Sample 5 Swift DI with seq
checked = 0
for r in sdi_rows:
    d   = r['data']
    seq = _to_str(d.get('seq'))
    if not seq:
        continue
    amt = _to_int(d.get('số_tiền')) or 0
    if amt == 0:
        continue
    c_credit = core_by_seq_credit.get(seq)
    c_debit  = core_by_seq_debit.get(seq)
    match_c  = c_credit == amt if c_credit else None
    match_d  = c_debit  == amt if c_debit  else None
    print(f"\n  Swift seq={seq!r} amt={amt}")
    print(f"    Core credit[{seq}]={c_credit}  match={match_c}")
    print(f"    Core debit [{seq}]={c_debit}   match={match_d}")
    checked += 1
    if checked >= 10:
        break

# ── 4. Kiểm tra Swift DI không khớp Core ─────────────────────────────────
sep("6. TỶ LỆ KHỚP trực tiếp")
matched_c = matched_d = no_seq = no_core = amt_mismatch = total = 0
for r in sdi_rows:
    d   = r['data']
    seq = _to_str(d.get('seq'))
    amt = _to_int(d.get('số_tiền')) or 0
    total += 1
    if not seq or amt == 0:
        no_seq += 1
        continue
    c = core_by_seq_credit.get(seq)
    db = core_by_seq_debit.get(seq)
    if c == amt:
        matched_c += 1
    elif db == amt:
        matched_d += 1
    elif c or db:
        amt_mismatch += 1
        if amt_mismatch <= 3:
            print(f"  AMT MISMATCH: swift_seq={seq} swift_amt={amt} core_credit={c} core_debit={db}")
    else:
        no_core += 1

print(f"\n  Tổng: {total}")
print(f"  Không có seq/amt: {no_seq}")
print(f"  Khớp GHI CÓ (credit): {matched_c}")
print(f"  Khớp GHI NỢ (debit):  {matched_d}")
print(f"  Có Core nhưng số tiền lệch: {amt_mismatch}")
print(f"  Không có Core nào (seq không tồn tại): {no_core}")
