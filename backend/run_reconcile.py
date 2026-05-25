"""Chạy reconcile cho tất cả 6 configs và in kết quả."""
import json, sys, urllib.request
sys.stdout.reconfigure(encoding='utf-8')

RUN_DATE = "2026-02-01"
BASE = "http://127.0.0.1:8000/api/v1/reconcile"

# Tên config
CONFIG_NAMES = {
    1: "Swift Đi  ↔ NAPAS Đi",
    2: "Swift Đến ↔ NAPAS Đến",
    3: "Swift Đi  ↔ Core (ghi có)",
    4: "Swift Đến ↔ Core (ghi nợ)",
    5: "Core (ghi có) ↔ NAPAS Đi",
    6: "Core (ghi nợ) ↔ NAPAS Đến",
}

STATUS_VN = {
    "TC_LECH_NGAY":       "TC – lệch ngày",
    "TC_KHOP":            "TC – khớp ngày",
    "TIMEOUT_KHOP":       "Timeout – khớp ngày",
    "TIMEOUT_LECH_NGAY":  "Timeout – lệch ngày",
    "THAT_BAI_KHOP":      "Thất bại – khớp ngày",
    "THAT_BAI_LECH_NGAY": "Thất bại – lệch ngày",
    "CHI_SWIFT":          "Chỉ Swift",
    "CHI_TRAI":           "Chỉ trái (unmatched left)",
    "CHI_PHAI":           "Chỉ phải (unmatched right)",
    "KHOP":               "Khớp",
    "TC_KHOP_T":          "TC – NAPAS ngày T-1, Core ngày T",
    "TC_KHOP_T1":         "TC – NAPAS & Core cùng ngày",
    "KTC":                "Không thành công",
    "TC_KHONG_CORE":      "TC – không có Core",
    "KHOP_T_TRUOC":       "Khớp – Core ngày T-1",
    "KHOP_CUNG_NGAY":     "Khớp – cùng ngày",
    "KHOP_T_SAU":         "Khớp – Core ngày T+1",
    "CORE_SWIFT_T_TRUOC": "Core & Swift – NAPAS ngày sau",
    "CORE_KHOP":          "Core khớp",
    "CORE_SWIFT_T_SAU":   "Core & Swift – NAPAS ngày trước",
    "CORE_THAT_BAI":      "Core – Thất bại",
    "KHOP_NAPAS_T_TRUOC": "Khớp – NAPAS ngày T-1",
    "KHOP_NAPAS_CUNG_NGAY":"Khớp – NAPAS cùng ngày",
    "KHOP_NAPAS_T_SAU":   "Khớp – NAPAS ngày T+1",
    "CHI_CORE":           "Chỉ Core",
}

def api_post(path, body):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}{path}", data=data, method="POST",
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def api_get(path):
    with urllib.request.urlopen(f"{BASE}{path}") as resp:
        return json.loads(resp.read())


print(f"\n{'='*70}")
print(f"  KẾT QUẢ ĐỐI SOÁT — Ngày {RUN_DATE}")
print(f"{'='*70}\n")

grand_total = 0
grand_matched = 0

for cfg_id in range(1, 7):
    # Run
    result = api_post("/run-flex", {"config_id": cfg_id, "run_date": RUN_DATE, "created_by": "admin"})
    # Summary
    summary = api_get(f"/flex-summary?config_id={cfg_id}&run_date={RUN_DATE}")

    name = CONFIG_NAMES.get(cfg_id, f"Config {cfg_id}")
    total = summary["total"]
    by_status = summary["by_status"]

    print(f"[{cfg_id}] {name}")
    print(f"     Tổng: {total:,}  |  left={result['left_rows']:,}  right={result['right_rows']:,}")

    unmatched = 0
    matched = 0
    for s in by_status:
        code = s["status"]
        label = STATUS_VN.get(code, code)
        pct = s["count"] * 100 / total if total else 0
        flag = "✗" if code in ("CHI_SWIFT", "CHI_TRAI", "CHI_PHAI") else "✓"
        print(f"     {flag} {label:<35} {s['count']:>6,} ({pct:5.1f}%)")
        if code in ("CHI_SWIFT", "CHI_TRAI", "CHI_PHAI"):
            unmatched += s["count"]
        else:
            matched += s["count"]

    match_rate = matched * 100 / total if total else 0
    print(f"     → Tỷ lệ khớp: {match_rate:.1f}%  ({matched:,}/{total:,})")
    print()
    grand_total += total
    grand_matched += matched

print(f"{'='*70}")
print(f"  TỔNG HỢP: {grand_matched:,}/{grand_total:,} rows khớp  ({grand_matched*100//grand_total if grand_total else 0}%)")
print(f"{'='*70}")
