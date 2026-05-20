# Đặc tả kỹ thuật đối soát NAPAS

> Tài liệu này mô tả toàn bộ luồng dữ liệu, cấu trúc file input, key matching, xử lý ngày,
> và bảng phân loại trạng thái cho module đối soát NAPAS–Swift–Core.
>
> **Nguồn xác nhận:** file Excel mẫu tháng 2/2026 (thư mục `example/`) + báo cáo TONG HOP THANG 2.

---

## 1. Luồng giao dịch

```
Chiều Đi:  Khách hàng → Core (ghi có GL) → Swift đi → NAPAS đi → NH đối tác
Chiều Đến: NH đối tác → NAPAS đến → Swift đến → Core (ghi nợ GL) → Khách hàng
```

Ba nguồn so khớp: **Swift**, **Core GL**, **NAPAS**. Không có nguồn nào làm master mặc định — trạng thái được suy luận từ tổ hợp của cả 3.

---

## 2. File input

| File | Chiều | Loại | Sheets |
|------|-------|------|--------|
| `Swift report đi.xlsx` | Đi | Swift outgoing | 1 sheet/ngày (01.02, 02.02, 03.02) |
| `Swift report đến.xlsx` | Đến | Swift incoming | 1 sheet/ngày |
| `Core.xlsx` | Cả hai | GL sao kê | 1 sheet/ngày |
| `Napas đi.xlsx` | Đi | NAPAS TC outgoing | 1 sheet/ngày (ISS_TRB_TC_SWC) |
| `Napas đến.xlsx` | Đến | NAPAS TC incoming | 1 sheet/ngày (BNB_TRB_TC_SWC) |
| `Napas đi KTC [date].XLSX` | Đi | NAPAS KTC outgoing | N sheets (1/ngày lỗi) |

> **Lưu ý:** Không có file NAPAS đến KTC trong dữ liệu mẫu — các lỗi incoming NAPAS
> được xử lý ở phía NH đối tác trước khi gửi đến.

---

## 3. Cấu trúc cột từng file

### 3.1 Swift report đi (Outgoing)

Bỏ 5 dòng header, dòng 6 là tên cột.

| Cột | Tên gốc | Tên nội bộ | Ghi chú |
|-----|---------|-----------|---------|
| A | THỜI GIAN | `swift_time` | Timestamp thực tế của GD |
| G | TRACE NUMBER | `trace` | 6 chữ số — key match với NAPAS đi |
| H | SỐ TIỀN | `amount` | VND, không bao gồm phí |
| L | TELLER | `teller` | 4 chữ số — dùng verify với Core |
| M | SEQ | `seq` | 5 chữ số — key match với Core |
| O | HOSTDATE | `host_date` | YYYYMMDD — **có thể T hoặc T+1** |
| Q | PHẢN HỒI | `swift_status` | `THANH CONG` / `TIMEOUT` / `THAT BAI` |

### 3.2 Swift report đến (Incoming)

Bỏ 5 dòng header, dòng 6 là tên cột.

| Cột | Tên gốc | Tên nội bộ | Ghi chú |
|-----|---------|-----------|---------|
| B | THỜI GIAN | `swift_time` | Timestamp thực tế |
| I | SỐ TIỀN | `amount` | VND |
| K | HOST DATE | `host_date` | `YYYY-MM-DD` (**format khác Swift đi**) — có thể T+1 nếu GD ~23:5x |
| L | TRACE | `trace` | 6 chữ số — key match với NAPAS đến |
| M | TELLER | `teller` | 4 chữ số |
| N | SEQ | `seq` | 5 chữ số — key match với Core |
| Q | PHẢN HỒI | `swift_status` | `THANH CONG` / `TIMEOUT` / `THAT BAI` |

> ⚠️ **Format ngày khác nhau giữa 2 file Swift:** `đi` dùng `YYYYMMDD` (số), `đến` dùng `YYYY-MM-DD` (chuỗi). Parse riêng.

### 3.3 Core GL sao kê

Bỏ 4 dòng header, dòng 5 là tên cột. Tất cả entries thuộc tài khoản GL NAPAS (`VND06800270411311`).

| Cột | Tên gốc | Tên nội bộ | Ghi chú |
|-----|---------|-----------|---------|
| B | NGÀY GIAO DỊCH | `core_date` | YYYYMMDD — **luôn = T, ngày chuẩn** |
| D | SỐ CHỨNG TỪ | `doc_no` | `TLR.XXXXX` hoặc `NGCP.XXXXXXXX` |
| E | SỐ TIỀN GHI NỢ | `debit` | GD chiều Đến (tiền vào GL) |
| F | SỐ TIỀN GHI CÓ | `credit` | GD chiều Đi (tiền ra GL) |
| H | DIỄN GIẢI | `description` | Chuỗi chứa TELLER + SEQ cho TLR entries |

**Format đầy đủ của DIỄN GIẢI (TLR entries):**

```
"06800-5071-16331 TRANSFER CREDMBNEO.8165321.775741
  │      │     │                        │       │
  │      │     SEQ (5 số)               │     TRACE (6 số) ← key match NAPAS
  │    TELLER (4 số)              internal_id
bank_code
```

**Parse DIỄN GIẢI để lấy TELLER, SEQ và TRACE:**

```
Pattern: /^"?(\d+)-(\d+)-(\d+)\s+TRANSFER\s+CREDMBNEO\.(\d+)\.(\d+)/
Groups:  [bank_code, teller, seq, internal_id, trace]

Ví dụ: "06800-5071-16331 TRANSFER CREDMBNEO.8165321.775741"
  → teller=5071, seq=16331, trace=775741
```

Entries không match pattern (NP_TREO, điều chỉnh) tự bị loại — không cần filter thêm.

**Chiều phân biệt qua debit/credit:**
- `credit > 0, debit = 0` → GD chiều **Đi** (tiền ra, Core ghi có GL)
- `debit > 0, credit = 0` → GD chiều **Đến** (tiền vào, Core ghi nợ GL)

### 3.4 NAPAS đi TC (Thành công)

Sheet naming: `DDMM26_ISS_TRB_970444_1_TC_SWC`. Dòng 1 là header.

| Cột | Tên gốc | Tên nội bộ | Ghi chú |
|-----|---------|-----------|---------|
| B | Số tiền | `amount` | VND — **không bao gồm Phí dịch vụ (cột J)** |
| C | Số trace | `trace` | 6 chữ số — key match với Swift |
| E | Ngày GD | `napas_date` | DDMM (4 chữ số) — **có thể T hoặc T-1** |

### 3.5 NAPAS đến TC (Thành công)

Sheet naming: `DDMM26_BNB_TRB_970444_1_TC_SWC`. Dòng 1 là header.

| Cột | Tên gốc | Tên nội bộ | Ghi chú |
|-----|---------|-----------|---------|
| C | Số tiền | `amount` | VND |
| D | Số trace | `trace` | 6 chữ số — key match với Swift |
| F | Ngày GD | `napas_date` | DDMM — có thể T-1 |

### 3.6 NAPAS đi KTC (Thất bại)

Sheet naming: `DDMM26_ISS_TRB_970444_1_KTC` (và biến thể rút gọn `MMDD`). Dòng 1 là header.

| Cột | Tên gốc | Tên nội bộ | Ghi chú |
|-----|---------|-----------|---------|
| C | Số tiền | `amount` | VND |
| D | Số trace | `trace` | 6 chữ số |
| F | Ngày GD | `napas_date` | DDMM |

> **Edge cases trong KTC:**
> - Có thể xuất hiện `amount = 0` (GD probe/test) — xử lý theo nghiệp vụ
> - Mã GD `0430` (khác `0210` thông thường) — có thể là reversal, cần xác nhận

---

## 4. Matching keys

| Cặp so khớp | Key bắt buộc | Field nguồn | Chiều |
|------------|-------------|-------------|-------|
| Swift đi ↔ NAPAS đi TC | `trace` + `amount` | Swift: TRACE NUMBER; NAPAS: Số trace + Số tiền | Đi |
| Swift đến ↔ NAPAS đến TC | `trace` + `amount` | Swift: TRACE; NAPAS: Số trace + Số tiền | Đến |
| Swift đi ↔ Core (credit) | `seq` + `amount` | Swift: SEQ + SỐ TIỀN; Core: parse DIỄN GIẢI → seq + GHI CÓ | Đi |
| Swift đến ↔ Core (debit) | `seq` + `amount` | Swift: SEQ + SỐ TIỀN; Core: parse DIỄN GIẢI → seq + GHI NỢ | Đến |
| **Core ↔ NAPAS đi TC** | `trace` + `amount` | Core: parse DIỄN GIẢI → trace + GHI CÓ; NAPAS: Số trace + Số tiền | Đi |
| **Core ↔ NAPAS đến TC** | `trace` + `amount` | Core: parse DIỄN GIẢI → trace + GHI NỢ; NAPAS: Số trace + Số tiền | Đến |
| Swift đi ↔ NAPAS đi KTC | `trace` (verify `amount`) | — | Đi — nếu không match TC |

> Core chứa **cả SEQ lẫn trace** trong cùng một field DIỄN GIẢI, cho phép so trực tiếp với cả Swift (qua SEQ) lẫn NAPAS (qua trace). Không cần Swift làm cầu nối.
>
> `TELLER` có thể dùng bổ sung để tăng độ tin cậy khi match Swift↔Core.

---

## 5. Xử lý ngày

Core là ngày tham chiếu chuẩn (T). Các nguồn khác có thể lệch:

| Nguồn | Format | Offset khả dĩ | Lý do |
|-------|--------|--------------|-------|
| Core | `YYYYMMDD` | Luôn = T | Ngày hạch toán thực |
| Swift đi HOSTDATE | `YYYYMMDD` | T hoặc T+1 | GD ~23:5x → host xử lý sang ngày hôm sau |
| Swift đến HOST DATE | `YYYY-MM-DD` | T hoặc T+1 | Tương tự Swift đi |
| NAPAS đi/đến Ngày GD | `DDMM` | T hoặc T-1 | File NAPAS xuất theo ngày quyết toán |

**Quy tắc phân loại ngày (có thể cấu hình qua Quy tắc phân loại trong UI):**

```
|date_swift_host - date_core| ≤ 1 ngày  → KHOP_LECH_NGAY (auto)
|date_napas - date_core|     ≤ 1 ngày  → KHOP_LECH_NGAY (auto)
|any_date_diff|              = 2 ngày  → KHOP_LECH_NGAY (manual, qua cuối tuần/lễ)
|any_date_diff|              > 2 ngày  → NGOAI_LE
```

---

## 6. Trạng thái đối soát master (10 trạng thái)

Trạng thái được **suy luận tự động** từ tổ hợp 3 nguồn. Không lưu cứng trong DB — tính toán khi render hoặc cache có TTL.

| Mã | Tên | Điều kiện xác định | Hướng xử lý |
|----|-----|-------------------|-------------|
| `KHOP` | Khớp | Swift TC + NAPAS TC (not failed) + Core có entry; ngày trong offset chấp nhận | Tự động |
| `KHOP_LECH_NGAY` | Khớp lệch ngày | Match trace/SEQ+amount nhưng ngày lệch ≤ ngưỡng quy tắc | Tự động |
| `TIMEOUT_CO_CORE` | Timeout – Core ghi nhận | Swift TIMEOUT + Core có entry + NAPAS TC | Cần review |
| `CHI_SWIFT` | Chỉ Swift | Swift THANH CONG + không có NAPAS (TC/KTC) + không có Core | Kiểm tra thủ công |
| `SWIFT_TIMEOUT` | Swift timeout | Swift TIMEOUT + không có Core + không có NAPAS | Xác nhận hủy |
| `SWIFT_THAT_BAI` | Swift thất bại | Swift THAT BAI + không có Core + không có NAPAS | Xác nhận hủy |
| `NAPAS_THAT_BAI` | NAPAS thất bại | Swift TC + trace xuất hiện trong NAPAS KTC file | Liên hệ đối tác |
| `CHI_NAPAS` | Chỉ NAPAS | NAPAS TC có entry + không có Swift + không có Core | Kiểm tra thủ công |
| `CHI_CORE` | Chỉ Core | Core có TLR entry (parse DIỄN GIẢI thành công) + không match Swift/NAPAS | Kiểm tra thủ công |
| `NGOAI_LE` | Ngoại lệ | Mâu thuẫn dữ liệu hoặc không phân loại được vào các case trên | Xử lý ngoại lệ |

**Ví dụ NGOAI_LE:** Swift TIMEOUT + Core có entry + NAPAS KTC (failed) → mâu thuẫn 3 chiều.

---

## 7. Cấu trúc record Master giao dịch

```json
{
  "id": "string",
  "trace": "string (6 chữ số, từ Swift/NAPAS)",
  "sequence": "string (5 chữ số SEQ, từ Swift)",
  "direction": "Đi | Đến",
  "amount": "number (VND, principal, không gồm phí)",

  "swift": {
    "date": "DD/MM/YYYY (từ HOSTDATE/HOST DATE)",
    "status": "THANH_CONG | TIMEOUT | THAT_BAI"
  } | null,

  "core": {
    "date": "DD/MM/YYYY (từ NGÀY GIAO DỊCH)",
    "entry": "Ghi có | Ghi nợ"
  } | null,

  "napas": {
    "date": "DD/MM/YYYY (từ Ngày GD, convert DDMM → DD/MM/YYYY)",
    "type": "GD | QT",
    "failed": "boolean (true nếu trace có trong KTC file)"
  } | null,

  "recon_status": "KHOP | KHOP_LECH_NGAY | TIMEOUT_CO_CORE | ...",

  "resolved_by": "string | null",
  "resolved_at": "string | null",
  "note": "string | null"
}
```

---

## 8. Quy trình xử lý backend (gợi ý)

```
1. Load và parse tất cả file theo ngày T
   - Swift đi: skip 5 header rows, parse HOSTDATE (YYYYMMDD)
   - Swift đến: skip 5 header rows, parse HOST DATE (YYYY-MM-DD)
   - Core: skip 4 header rows, parse DIỄN GIẢI với regex
   - NAPAS TC (đi/đến): no skip, parse Ngày GD (DDMM → DD/MM/YYYY với năm = năm file)
   - NAPAS KTC: no skip, build lookup set {trace → {amount, date}}

2. Build lookup indexes
   - napas_di_tc:  Map<trace, {amount, date}>
   - napas_den_tc: Map<trace, {amount, date}>
   - napas_di_ktc: Set<trace>
   - core_di:      Map<seq, {trace, amount, date, teller}>   (credit entries, Đi)
   - core_den:     Map<seq, {trace, amount, date, teller}>   (debit entries, Đến)
   - core_by_trace: Map<trace, core_entry>                   (index phụ cho Core↔NAPAS)

3. Với mỗi Swift record:
   a. Xác định direction từ file source
   b. Look up NAPAS (TC/KTC) bằng trace + amount
   c. Look up Core bằng seq + amount (từ teller+seq parsed)
   d. Xác định ngày lệch giữa các nguồn
   e. Suy luận recon_status theo bảng §6
   f. Ghi vào Master giao dịch

4. Cross-check Core ↔ NAPAS trực tiếp (độc lập với Swift)
   - Với mỗi Core entry (đã parse trace từ DIỄN GIẢI):
     * Look up napas_di_tc / napas_den_tc bằng trace + amount
     * Nếu match → xác nhận cặp Core↔NAPAS (dùng để verify hoặc phát hiện CHI_CORE)

5. Xử lý CHI_NAPAS và CHI_CORE
   - Sau khi xử lý hết Swift records, scan NAPAS TC/Core còn lại chưa được match
   - Tạo master record với swift=null cho những entry này
```

---

## 9. Edge cases cần lưu ý

| Case | Mô tả | Xử lý |
|------|-------|-------|
| Amount = 0 trong KTC | GD probe/test | Bỏ qua hoặc log riêng |
| Mã GD = 0430 trong KTC | Có thể là reversal (không phải IBT thông thường) | Cần xác nhận nghiệp vụ |
| Trace trùng lặp cùng ngày | Lý thuyết không xảy ra; nếu có → NGOAI_LE | Cần alert |
| NAPAS đi TC có Ngày GD = T-1 | Bình thường (QT cuối ngày) | Xử lý theo quy tắc lệch ngày |
| Swift đến thời gian ~23:5x → HOST DATE = T+1 | Bình thường | HOST DATE là ngày Core hạch toán |
| SEQ trùng nhau trong 2 ngày khác nhau | SEQ có thể reset theo ngày → phải kết hợp với ngày khi build index | Dùng (date, teller, seq) làm composite key |
