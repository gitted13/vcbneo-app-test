# VCBNeo – Hệ thống Đối soát NAPAS
## Tài liệu Mô tả Ứng dụng & Danh sách Module

---

## 1. Vấn đề đang giải quyết

VCBNeo (Ngân hàng TM TNHH MTV Xây dựng Việt Nam) hiện xử lý hàng nghìn giao dịch chuyển tiền mỗi ngày qua kênh NAPAS 24/7. Cuối mỗi ngày làm việc, bộ phận TTTT phải đối chiếu số liệu giữa ba hệ thống:

- **Swift** – báo cáo giao dịch do hệ thống Swift tạo ra (file đi và đến)
- **Core Banking** – hệ thống ghi sổ nội bộ của ngân hàng (ghi có / ghi nợ)
- **NAPAS** – trung tâm thanh toán quốc gia (file quyết toán đi, đến, thất bại)

Quy trình hiện tại thực hiện hoàn toàn thủ công trên Excel, mất hơn 3 giờ mỗi ngày và thường bỏ sót các giao dịch **lệch ngày** — tức là giao dịch được khởi tạo ngày T nhưng Core xử lý ngày T+1 hoặc được quyết toán bên Napas vào ngày T-1.

**Ứng dụng này tự động hóa toàn bộ quy trình:** từ nhận file, trích xuất dữ liệu, đối chiếu theo logic nghiệp vụ đến xuất báo cáo theo đúng mẫu gốc — với thời gian xử lý dưới 60 giây.

---

## 2. Luồng hoạt động tổng thể

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LUỒNG DỮ LIỆU                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Cấu hình loại file]                                               │
│        │                                                            │
│        ▼                                                            │
│  [Nhập dữ liệu] ◄──── Thủ công (upload trình duyệt)                │
│        │         ◄──── RPA (tự động lấy file từ thư mục server)     │
│        │                                                            │
│        ▼  (validation theo cấu hình → từ chối nếu không hợp lệ)   │
│                                                                     │
│  [Kho dữ liệu] ◄──── Dữ liệu đã trích xuất lưu theo từng bảng     │
│        │                                                            │
│        ▼                                                            │
│  [Logic đối soát] ── ghép bảng, áp dụng offset ngày, so khớp      │
│        │                                                            │
│        ▼                                                            │
│  [Báo cáo] ──────── xuất Excel theo mẫu TONG_HOP gốc              │
│                                                                     │
│  [Lịch sử] ◄──── ghi nhận tất cả lần nhập (thủ công + RPA)        │
│  [Cài đặt] ◄──── cấu hình app, phân quyền, kết nối RPA            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Quy tắc nghiệp vụ cốt lõi (Lệch ngày)

Đây là logic phức tạp nhất, là lý do chính khiến đối chiếu thủ công hay sai:

```
Swift file ngày T-1  →  HOSTDATE = T   →  Core xử lý ngày T  →  Napas file T, Ngày GD = T-1
Swift file ngày T    →  HOSTDATE = T+1 →  Core xử lý ngày T+1 →  Napas file T+1, Ngày GD = T
```

Vì vậy, GL (tài khoản trung gian) ngày T bao gồm:
- Tất cả giao dịch Swift có `HOSTDATE = T` (từ file ngày T)
- Các giao dịch Swift ngày T-1 có `HOSTDATE = T` (giao dịch "chạy sang ngày hôm sau")

Các trường hợp phân loại:
| Nhãn | Ý nghĩa |
|------|---------|
| **GL prevT** | Giao dịch ngày hôm trước đã được Napas quyết toán hôm nay |
| **GL napasT** | Giao dịch hôm nay, Napas quyết toán cùng ngày |
| **GL napasT+1** | Giao dịch hôm nay, Napas quyết toán ngày mai |
| **GL fail** | Giao dịch không tìm thấy trong Napas |
| **Timeout** | Giao dịch NAPAS chưa được Core ghi nhận |

**Lưu ý Core:** Dùng nhãn "Ghi có" (sheet Đi) / "Ghi nợ" (sheet Đến) — không dùng "Đi/Đến".
**Thất bại Đi:** tính vào Core Ghi có. **Thất bại Đến:** KHÔNG tính vào Core Ghi nợ.

---

## 4. Danh sách File đầu vào mặc định

| ID | Tên hiển thị | Mô tả | Keywords nhận diện header |
|----|-------------|-------|--------------------------|
| `swift_di` | Swift Report Đi | Giao dịch chuyển tiền đi qua Swift | SEQ, TIỀN, HOSTDATE |
| `swift_den` | Swift Report Đến | Giao dịch chuyển tiền đến qua Swift | SEQ, TRACE, TIỀN |
| `core` | Core (Ghi có / Ghi nợ) | Dữ liệu từ Core Banking | DIỄN GIẢI, DIEN GIAI |
| `napas_di` | Napas Đi | Quyết toán đi từ NAPAS | Số trace, Số tiền, Ngày GD |
| `napas_den` | Napas Đến | Quyết toán đến từ NAPAS | Số trace, Số tiền, Ngày GD |
| `napas_di_fail` | Napas Đi Thất bại | Giao dịch đi thất bại (KTC) | Số trace, Số tiền |

Mỗi loại file có thể cấu hình thêm/bớt trường, đổi alias, đặt kiểu dữ liệu, và đánh dấu trường bắt buộc.

---

## 5. Danh sách Module

### Module 01 — Loại file & Trường dữ liệu
**Route:** `/file-settings`

**Mục đích:** Là bước cấu hình trước khi làm bất cứ điều gì. Định nghĩa hệ thống sẽ nhận loại file nào và trích xuất những trường gì từ mỗi loại.

**Chức năng:**
- Xem danh sách 6 loại file mặc định (có thể mở rộng)
- Mỗi loại file: cấu hình tên, mô tả, keywords nhận diện header, danh sách trường
- Mỗi trường: tên cột trong file, alias trong hệ thống, kiểu dữ liệu (`string` / `integer` / `number` / `date`), bắt buộc hay không
- Thêm / xóa trường tùy chỉnh
- Thêm loại file mới ngoài 6 loại mặc định

**Ảnh hưởng:** Mọi trang khác (upload, kho dữ liệu, logic, báo cáo) đều phụ thuộc vào cấu hình trang này.

---

### Module 02 — Nhập dữ liệu
**Route:** `/data-input`

**Mục đích:** Nhận file từ người dùng hoặc từ RPA, kiểm tra tính hợp lệ theo cấu hình Module 01, và lưu dữ liệu vào kho.

**Tab: Tải thủ công**
- Hiển thị 6 ô tải file tương ứng 6 loại đã cấu hình
- Hỗ trợ kéo & thả (drag & drop)
- Sau khi thả file: kiểm tra ngay (keywords header có khớp không, các trường bắt buộc có tồn tại không)
- Nếu hợp lệ → viền xanh + badge "Hợp lệ"
- Nếu lỗi → viền đỏ + thông báo lỗi cụ thể (VD: "Không tìm thấy cột bắt buộc: HOSTDATE") → **không lưu**
- Khi đủ file hợp lệ: nút "Lưu & Trích xuất" kích hoạt

**Tab: RPA**
- Cấu hình thư mục nguồn, lịch chạy tự động
- Xem lịch sử các lần RPA chạy: Run ID, trigger, thời gian, số file nhận được, trạng thái
- Xem chi tiết từng lần chạy

---

### Module 03 — Lịch sử
**Route:** `/history`

**Mục đích:** Ghi nhận và tra cứu toàn bộ lịch sử file đã được đưa vào hệ thống.

**Chức năng:**
- Bảng đầy đủ: thời gian, loại file, tên file gốc, nguồn (Thủ công / RPA run ID), người dùng, dung lượng, số sheet, trạng thái
- Dòng lỗi inline hiển thị ngay bên dưới dòng file bị lỗi
- Filter: theo loại file, nguồn (thủ công/RPA), trạng thái (hợp lệ/lỗi)
- Tìm kiếm theo tên file hoặc loại
- Thống kê nhanh: tổng file, hợp lệ, lỗi, từ RPA, thủ công

---

### Module 04 — Kho dữ liệu
**Route:** `/storage`

**Mục đích:** Xem và làm việc với dữ liệu đã được trích xuất và lưu trữ, tổ chức theo từng bảng tương ứng loại file.

**Chức năng:**
- Sidebar trái: danh sách bảng (1 bảng = 1 loại file đã cấu hình), hiển thị số dòng và thời gian cập nhật
- Vùng chính: bảng dữ liệu với các cột đúng theo cấu hình trường đã đặt ở Module 01
- Tìm kiếm toàn bộ bảng
- Filter theo trạng thái (THANH CONG / TIMEOUT / THAT BAI) nếu có trường status
- Sắp xếp theo cột
- Xuất ra CSV
- Thống kê nhanh theo từng bảng (tổng, thành công, timeout, thất bại)

---

### Module 05 — Logic đối soát
**Route:** `/join-logic`

**Mục đích:** Định nghĩa quy tắc ghép bảng để so sánh dữ liệu giữa các nguồn. Mỗi logic là một "công thức đối chiếu" có thể chạy lại bất cứ lúc nào.

**Danh sách logic:**
- Mỗi logic hiển thị dạng card: tên, bảng trái → bảng phải, trường ghép, kết quả lần chạy gần nhất (số khớp / chỉ bên trái / chỉ bên phải)
- Expand để xem chi tiết cấu hình

**Tạo / Sửa logic (form modal):**
| Trường | Mô tả |
|--------|-------|
| Tên logic | Đặt tên mô tả mục đích (VD: "Swift Đi vs Napas Đi") |
| Bảng trái (nguồn) | Bảng A trong phép so sánh |
| Bảng phải (đích) | Bảng B trong phép so sánh |
| Kiểu join | Left Join / Inner Join / Full Outer Join |
| Trường ghép | Cặp trường dùng để so khớp (VD: trace = trace, amount = amount) |
| Offset ngày | T→T / T→T+1 / T-1→T (xử lý lệch ngày) |
| Nhóm theo | Tiêu chí gom nhóm kết quả (ngày, trạng thái…) |
| Bảng kết quả | Tên bảng lưu kết quả sau khi ghép |

**Hành động:** Chạy logic → kết quả lưu vào bảng kết quả → dùng cho báo cáo

---

### Module 06 — Báo cáo
**Route:** `/reports`

**Mục đích:** Tạo và quản lý mẫu báo cáo. Mỗi báo cáo lấy dữ liệu từ một logic đối soát và có thể xuất ra Excel theo mẫu gốc của VCBNeo.

**Danh sách báo cáo:**
- Hiển thị dạng card: tên, logic nguồn, format xuất, thời gian xuất gần nhất, trạng thái
- Expand để xem cấu trúc phần trong báo cáo

**Tạo / Sửa báo cáo:**
- Chọn logic đối soát làm nguồn dữ liệu
- Thêm các phần nội dung theo thứ tự (VD: "Tiêu đề ngân hàng", "Swift count/amount", "Core ngày T"…)
- Mỗi phần ánh xạ sang nhóm cột trong kết quả của logic

**Xuất:** Nút "Xuất Excel" → tải file `.xls` theo đúng mẫu TONG_HOP gốc của VCBNeo (2 sheet: ĐI và ĐẾN)

---

### Module 07 — Cài đặt
**Route:** `/settings`

Trang cài đặt toàn hệ thống, chia thành 4 tab:

**Tab: Chung**
- Tên ứng dụng, tên ngân hàng, đơn vị, múi giờ
- Cấu hình lưu trữ: thư mục upload, thời gian cache, giới hạn kích thước file, số dòng tối đa xuất CSV

**Tab: Phân quyền**
- Danh sách người dùng: tên, email, vai trò, trạng thái hoạt động
- Ma trận quyền: checkbox per-module cho từng người dùng
- Thêm / sửa / khóa người dùng
- 3 vai trò mặc định: Admin (toàn quyền) · Operator (vận hành) · Viewer (chỉ xem)

**Tab: Kết nối RPA**
- Thư mục nguồn và lưu trữ trên server
- Pattern tên file (glob/regex)
- Lịch chạy tự động: giờ chạy, ngày trong tuần

**Tab: Thông báo** *(kế hoạch)*
- Thông báo email / webhook khi upload lỗi, RPA thất bại, hoặc chênh lệch vượt ngưỡng

---

## 6. Công nghệ sử dụng

| Thành phần | Công nghệ |
|------------|-----------|
| Frontend | React 18 + Vite 5 (không dùng CSS framework — inline styles + theme.js) |
| Backend | FastAPI (Python 3.11+) |
| Xử lý dữ liệu | pandas, numpy |
| Đọc/ghi Excel | openpyxl (đọc .xlsx), xlwt (ghi .xls) |
| API | RESTful JSON, tự động docs tại `/docs` |
| Cache | In-memory, key theo mtime file |

---

## 7. Thứ tự triển khai đề xuất

```
Phase 1 – Nền tảng (hiện tại)
  ✓ Frontend scaffold toàn bộ 7 module
  ✓ Backend FastAPI với 3 module: ingestion, reconciliation, reporting
  ✓ Logic đối soát đã kiểm tra khớp với dữ liệu tháng 2/2026

Phase 2 – Kết nối Frontend ↔ Backend
  ○ Wiring API client (api/client.js) vào từng trang
  ○ File upload thực với validation từ server
  ○ Chạy đối soát thực và hiển thị kết quả
  ○ Xuất Excel thực

Phase 3 – Mở rộng
  ○ Authentication (JWT)
  ○ Phân quyền thực thi trên server
  ○ Kết nối RPA thực (webhook hoặc polling thư mục)
  ○ Lịch sử lưu vào database (SQLite → PostgreSQL)
  ○ Thông báo (email/webhook)
```

---

## 8. Cải tiến UI — Tháng 5/2026

Bốn cải tiến giao diện được thực hiện trong phiên làm việc 19–20/05/2026 để làm rõ dữ liệu ngày tháng và trạng thái đối soát trên toàn frontend.

### 8.1 Tách 2 cột ngày (ngày thực tế + ngày ghi nhận)

**Vấn đề:** Swift có 2 ngày khác nhau (`txnDate` = ngày thực tế GD, `date` = hostDate = ngày ghi nhận vào Core). Trước đây hiển thị gộp trong 1 ô.

**Giải pháp:** Tách thành 2 cột riêng nhất quán trên tất cả trang:
- **Swift:** "Ngày GD (thực tế)" (`txnDate`) + "Ngày GN (ghi nhận)" (`date`), có badge **T+1** khi lệch ngày
- **NAPAS:** "Ngày GD" (`date`) + "Ngày giờ GD" (`date + ' ' + time`) dạng monospace

Các trang bị ảnh hưởng: `SwiftCore/index.jsx`, `NapasCore/index.jsx`, `Reconcile/index.jsx` (3 tab), `MasterSummary/index.jsx` (4 detail tables).

### 8.2 Làm rõ nhãn T/T-1/T+1 với ngày thực tế

**Vấn đề:** Các nhãn cột trong bảng tổng hợp ("TC – Core T", "Swift T-1 – NAPAS T") không đủ rõ ý nghĩa.

**Giải pháp:**
- Tất cả nhãn cột trong `MasterSummary` được đổi thành mô tả đầy đủ, ví dụ: "TC – Core ngày sau (T+1)", "Swift T-1 → Core T (lệch ngày)"
- Header chi tiết (khi expand 1 ngày) hiển thị thêm dải ngày thực tế: `(T-1: dd/mm/yyyy · T: dd/mm/yyyy · T+1: dd/mm/yyyy)` dùng hàm `dayOffset(ddmmyyyy, n)`

### 8.3 Đồng nhất trạng thái đối soát trên toàn frontend

**Vấn đề:** Bộ lọc trạng thái trong các tab đối soát hardcode string, không nhất quán với tên hiển thị. Trang Cài đặt không có tài liệu về ý nghĩa các trạng thái.

**Giải pháp:**
- `RECON_STATUS_META` (trong `data/reconcile.js`) được bổ sung trường `desc` mô tả ý nghĩa nghiệp vụ từng trạng thái
- Tất cả dropdown lọc trạng thái đều dùng `Object.entries(RECON_STATUS_META)` → tự động cập nhật nếu thêm trạng thái mới
- **Tab mới "Trạng thái đối soát"** trong `/settings`: hiển thị grid 10 trạng thái với badge màu, mã kỹ thuật, mô tả nghiệp vụ, và hướng xử lý (từ `RESOLUTION_OF`)

### 8.4 Banner thời gian đồng bộ/đối soát lần cuối

**Vấn đề:** Người dùng không biết dữ liệu có thể chưa cập nhật nếu RPA chưa chạy hôm nay.

**Giải pháp:**
- Component `<LastSyncBanner />` thêm vào `ReconShared.jsx`, hiển thị: dữ liệu đến ngày nào, đồng bộ lần cuối, đối soát lần cuối, đồng bộ tiếp theo
- Xuất hiện trên: `SwiftCore`, `NapasCore`, tất cả tab trong `Reconcile`, và `MasterSummary`
- Dữ liệu mock trong `LAST_SYNC_INFO` (`data/reconcile.js`) — production lấy từ API `/api/sync-status`

---

### Quy ước frontend sau cải tiến

| Nguồn | Cột ngày 1 | Cột ngày 2 | Ghi chú |
|-------|-----------|-----------|---------|
| Swift | "Ngày GD (thực tế)" = `txnDate` | "Ngày GN (ghi nhận)" = `date` (hostDate) | Badge T+1 khi lệch |
| NAPAS | "Ngày GD" = `date` | "Ngày giờ GD" = `date + time` (monospace) | — |
| Core  | "Ngày Core" = `date` | — | 1 cột duy nhất |

---

*Tài liệu cập nhật: 2026-05-20*
*Phiên bản ứng dụng: 1.0.0-scaffold*
