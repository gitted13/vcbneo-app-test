# Tài liệu chuyển giao – Hệ thống đối soát NAPAS (VCBNeo)

> **Phiên bản:** 1.0 · **Ngày:** 18/05/2026  
> **Đội bàn giao:** FoxAI  
> **Đội tiếp nhận:** *(điền tên đội)*

---

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Từ điển dữ liệu](#4-từ-điển-dữ liệu)
5. [Quyết định thiết kế (ADR)](#5-quyết-định-thiết-kế-adr)
6. [Runbook vận hành hàng ngày](#6-runbook-vận-hành-hàng-ngày)
7. [Xử lý sự cố](#7-xử-lý-sự-cố)
8. [Test cases theo trạng thái](#8-test-cases-theo-trạng-thái)
9. [Điểm chú ý khi mở rộng](#9-điểm-chú-ý-khi-mở-rộng)

---

## 1. Tổng quan dự án

### Bài toán

Ngân hàng TMCP Xây dựng Việt Nam (VietBank) xử lý thanh toán liên ngân hàng qua hệ thống NAPAS. Mỗi ngày có hàng nghìn giao dịch đi qua 3 hệ thống độc lập:

| Hệ thống | Vai trò | File/API |
|---|---|---|
| **Swift** | Cổng khởi tạo lệnh chuyển tiền | Excel xuất từ hệ thống Swift |
| **Core Banking** | Hạch toán kế toán nội bộ | Excel xuất từ Core (sổ cái GL) |
| **NAPAS** | Thanh toán bù trừ liên ngân hàng | Excel nhận từ NAPAS cuối ngày |

Hiện tại đối soát được thực hiện **thủ công** bằng Excel hàng ngày, mất 2–3 giờ/người và dễ xảy ra sai sót. Hệ thống này tự động hóa quá trình đó.

### Phạm vi

- Đối soát giao dịch **chiều Đi** (ngân hàng gửi tiền ra) và **chiều Đến** (ngân hàng nhận tiền vào)
- Phân loại tự động thành 10 trạng thái đối soát
- Giao diện web cho 3 vai trò: Admin, Operator, Viewer
- Xuất báo cáo Excel định kỳ

### Trạng thái hiện tại *(tính đến bàn giao)*

| Hạng mục | Trạng thái |
|---|---|
| Frontend UI | ✅ Hoàn thành prototype |
| Spec kỹ thuật backend | ✅ `docs/reconcile-spec.md` |
| Backend API | 🔲 Chưa implement |
| Kết nối dữ liệu thực | 🔲 Chưa implement |
| UAT với VCB | 🔲 Chưa thực hiện |

---

## 2. Kiến trúc hệ thống

### Luồng dữ liệu

```
                    ┌─────────────┐
        File Excel  │             │  File Excel
  Swift ──────────► │  Backend    │ ◄────────── Core GL
  NAPAS ──────────► │  (Python /  │
                    │   Node)     │
                    └──────┬──────┘
                           │ REST API
                    ┌──────▼──────┐
                    │  Frontend   │
                    │  (React 18) │
                    └─────────────┘
```

### Luồng nghiệp vụ

```
Giao dịch ĐI:   Swift đi ──► NAPAS đi TC ──► Core Ghi có
Giao dịch ĐẾN:  Core Ghi nợ ──► NAPAS đến TC ──► Swift đến
```

- **Swift** là nguồn gốc của giao dịch Đi, **Core** là nguồn gốc của giao dịch Đến
- **NAPAS** xác nhận việc bù trừ đã thực hiện
- Cả 3 nguồn phải khớp để giao dịch được coi là hoàn thành

### Các cặp so khớp

| Cặp | Key so khớp | Ghi chú |
|---|---|---|
| Swift Đi ↔ NAPAS Đi TC | `trace` + `amount` | File ISS_TRB_TC |
| Swift Đến ↔ NAPAS Đến TC | `trace` + `amount` | File BNB_TRB_TC |
| Swift Đi ↔ Core Ghi có | `seq` + `amount` | Parse từ DIỄN GIẢI |
| Swift Đến ↔ Core Ghi nợ | `seq` + `amount` | Parse từ DIỄN GIẢI |
| Core ↔ NAPAS Đi (cross-check) | `trace` + `amount` | Trace cuối DIỄN GIẢI |
| Core ↔ NAPAS Đến (cross-check) | `trace` + `amount` | Trace cuối DIỄN GIẢI |
| Swift Đi ↔ NAPAS Đi KTC | `trace` (xác nhận amount) | File ISS_TRB_KTC |

---

## 3. Cấu trúc thư mục

```
vcbneo-app/
├── frontend/                   # React 18 + Vite 5
│   └── src/
│       ├── pages/
│       │   ├── Login/          # Đăng nhập
│       │   ├── DataStorage/    # Xem dữ liệu thô 3 nguồn
│       │   ├── Reconcile/      # Master giao dịch + đối soát (trang chính)
│       │   ├── Reports/        # Báo cáo tổng hợp + xuất file
│       │   ├── History/        # Lịch sử đối soát
│       │   ├── JoinLogic/      # Cấu hình logic ghép nối
│       │   ├── FileTypeSettings/ # Cấu hình mapping file
│       │   └── AppSettings/    # Cài đặt hệ thống
│       ├── components/         # UI components dùng chung
│       ├── context/
│       │   ├── AuthContext.jsx # useAuth() → { user, login, logout }
│       │   └── AppContext.jsx  # useApp() → { toast, showConfirm }
│       └── theme.js            # C (colors), radius, shadow
├── docs/
│   ├── reconcile-spec.md       # Spec kỹ thuật backend (nguồn sự thật)
│   └── handover.md             # File này
└── example/                    # File Excel mẫu từ VCB (Feb 2026)
    ├── Swift_di_01.02.xlsx
    ├── Swift_den_01.02.xlsx
    ├── Core_01.02.xlsx
    ├── NAPAS_ISS_TRB_TC_01.02.xlsx
    ├── NAPAS_ISS_TRB_KTC_01.02.xlsx
    └── NAPAS_BNB_TRB_TC_01.02.xlsx
```

### Tech stack frontend

| Thư viện | Version | Mục đích |
|---|---|---|
| React | 18 | UI framework |
| Vite | 5 | Build tool |
| (không có) | — | **Không dùng** CSS framework, Tailwind, UI library |
| (không có) | — | **Không dùng** Redux/Zustand; state local + Context |

> **Quy tắc quan trọng:** Toàn bộ style dùng **inline style** qua `theme.js`. Không thêm CSS files hoặc CSS-in-JS library.

---

## 4. Từ điển dữ liệu

### 4.1 Các trường chung

| Trường | Nguồn | Kiểu | Mô tả |
|---|---|---|---|
| `trace` | Swift, NAPAS, Core | string 6 số | Mã định danh giao dịch tại NAPAS. Dùng làm key ghép Swift↔NAPAS và Core↔NAPAS |
| `seq` | Swift, Core | string 5 số | Số thứ tự giao dịch trong ngày của ngân hàng. Dùng làm key ghép Swift↔Core |
| `amount` | cả 3 | số nguyên (VND) | Số tiền gốc. **Không** bao gồm phí dịch vụ NAPAS (1,100 VND) |
| `hostdate` | Swift | YYYYMMDD (đi) / YYYY-MM-DD (đến) | Ngày xử lý theo hệ thống ngân hàng. **Hai format khác nhau** — xem ADR-003 |
| `ngay_gd` | NAPAS | YYYYMMDD | Ngày giao dịch theo NAPAS. Có thể là T-1 so với Core |
| `teller` | Core | string số | Mã giao dịch viên, là phần tử thứ 2 trong DIỄN GIẢI |
| `dien_giai` | Core | string | Diễn giải hạch toán. Chứa cả `seq` và `trace` — xem 4.2 |

### 4.2 Cấu trúc DIỄN GIẢI Core

Đây là trường quan trọng nhất để parse. Format đầy đủ:

```
"06800-5071-16366 TRANSFER CREDMBNEO.8165321.775780
 └─────┘ └───┘ └─────┘                  └───────┘ └─────┘
  bank  teller  SEQ                     internal   TRACE
```

**Regex:** `/^"?(\d+)-(\d+)-(\d+)\s+TRANSFER\s+CREDMBNEO\.(\d+)\.(\d+)/`

Các nhóm:
1. `bank_code` — mã ngân hàng (06800)
2. `teller` — mã giao dịch viên
3. `seq` — dùng ghép với Swift
4. `internal_id` — mã nội bộ Core (không dùng để ghép)
5. `trace` — dùng ghép với NAPAS

> **Lưu ý:** Các entry không khớp regex này (NP_TREO, NGCP batch...) bị loại tự nhiên — không cần filter thủ công.

### 4.3 Các loại file NAPAS

| Tên file | Loại | Chiều | Ý nghĩa |
|---|---|---|---|
| `ISS_TRB_TC_*.xls` | TC (Thành Công) | Đi | Giao dịch đi đã bù trừ thành công |
| `ISS_TRB_KTC_*.xls` | KTC (Không Thành Công) | Đi | Giao dịch đi bị từ chối bởi NAPAS |
| `BNB_TRB_TC_*.xls` | TC | Đến | Giao dịch đến đã bù trừ thành công |

> **Lưu ý:** Không có file KTC cho chiều Đến. Giao dịch đến thất bại được xử lý theo cơ chế riêng của NAPAS.

### 4.4 Offset ngày T

| Nguồn | Ngày chuẩn | Có thể lệch |
|---|---|---|
| **Core** | **T** (ngày tham chiếu) | Không lệch |
| Swift | T hoặc T+1 | Giao dịch cuối ngày (23:xx) HOSTDATE = ngày hôm sau |
| NAPAS | T hoặc T-1 | Giao dịch qua đêm file NAPAS chứa entry ngày hôm trước |

### 4.5 Khóa ghép tổng hợp SEQ

SEQ trong Swift và Core **không unique theo ngày** vì counter reset theo ca hoặc theo teller. Khóa tổng hợp an toàn:

```
composite_key = (ngay_giao_dich, teller, seq)
```

---

## 5. Quyết định thiết kế (ADR)

### ADR-001: Core làm nguồn gốc Đến, không phải Swift

**Quyết định:** Với giao dịch Đến, Core GL là nguồn khởi đầu. Swift chỉ xác nhận.

**Lý do:** Ngân hàng **nhận** tiền — Core ghi nợ tài khoản NOSTRO trước, Swift nhận confirm sau. Nếu dùng Swift làm gốc sẽ miss các giao dịch NAPAS gửi đến nhưng Swift chưa xử lý kịp.

**Hệ quả:** Giao dịch `CHI_NAPAS` (chỉ có trong NAPAS, không có Swift/Core) vẫn phải hiện trong master — đây là giao dịch hợp lệ, không phải lỗi dữ liệu.

---

### ADR-002: Không filter thủ công NP_TREO

**Quyết định:** Không cần code logic lọc NP_TREO/NGCP batch khỏi Core.

**Lý do:** Regex parse DIỄN GIẢI `/^"?(\d+)-(\d+)-(\d+)\s+TRANSFER\s+CREDMBNEO\./` chỉ match entry giao dịch thực (`TLR.XXXXX`). Batch settlement (`NGCP.XXXXXXXX`, `NP_TREO`) không có cấu trúc này nên tự động bị bỏ qua.

**Hệ quả:** Nếu Core thay đổi format DIỄN GIẢI cho giao dịch thực, regex cần cập nhật. Cần test lại mỗi khi nâng cấp Core Banking.

---

### ADR-003: HOSTDATE Swift Đi và Đến có format khác nhau

**Quyết định:** Parse riêng hai format ngày.

| File | Cột | Format | Ví dụ |
|---|---|---|---|
| Swift Đi | `HOSTDATE` | `YYYYMMDD` (số nguyên) | `20260201` |
| Swift Đến | `HOST DATE` | `YYYY-MM-DD` (string) | `2026-02-01` |

**Lý do:** Đây là đặc điểm của hệ thống Swift hiện tại của VCB, không phải lỗi. Hai file export từ 2 module khác nhau của Swift.

**Hệ quả:** Code backend phải detect/normalize format trước khi so sánh ngày.

---

### ADR-004: So khớp amount chỉ theo số tiền gốc

**Quyết định:** Loại `Phí dịch vụ` (cột riêng trong NAPAS, thường 1,100 VND) khỏi so khớp.

**Lý do:** Swift và Core không ghi phí NAPAS vào cùng entry giao dịch. Nếu match tổng amount sẽ luôn lệch 1,100 VND với mọi giao dịch NAPAS.

**Hệ quả:** Khi import file NAPAS phải chọn đúng cột `Số tiền GD` chứ không phải `Tổng tiền thanh toán`.

---

### ADR-005: Trạng thái TIMEOUT_CO_CORE vẫn là giao dịch thành công

**Quyết định:** Nếu Swift status = TIMEOUT nhưng Core và NAPAS đều có entry → phân loại `TIMEOUT_CO_CORE`, hướng xử lý "Cần review" nhưng **không** yêu cầu hoàn tiền.

**Lý do:** Giao dịch đã thực sự chạy qua NAPAS và được Core hạch toán. Swift timeout chỉ là vấn đề confirm message, không ảnh hưởng tới dòng tiền thực tế.

**Hệ quả:** Operator cần xác nhận và đóng case. Không được tự động hủy hay hoàn tiền.

---

### ADR-006: SEQ trong Core dùng composite key

**Quyết định:** Khóa ghép Swift↔Core là `(ngay_giao_dich, teller, seq)` thay vì chỉ `seq`.

**Lý do:** SEQ counter trong thực tế bị reset theo ca hoặc theo teller, dẫn đến trùng lặp nếu so khớp qua nhiều ngày (ví dụ: Swift ngày T+1 có HOSTDATE khác ngày nhưng SEQ trùng với ngày T).

**Hệ quả:** Khi index dữ liệu backend, composite key phải được tạo trước khi hash map.

---

## 6. Runbook vận hành hàng ngày

### Lịch vận hành chuẩn

| Thời gian | Sự kiện | Người thực hiện |
|---|---|---|
| 06:00 | Core Banking xuất file GL | Tự động |
| 06:30 | NAPAS gửi file TC/KTC ngày T | Tự động (nhận email/SFTP) |
| 07:00 | Operator nhận file Swift | Thủ công hoặc tự động |
| 07:30 | Upload 3 bộ file vào hệ thống | **Operator** |
| 08:00 | Hệ thống chạy đối soát | Tự động |
| 08:30 | Operator review kết quả, xử lý exception | **Operator** |
| 09:00 | Xuất báo cáo tổng hợp | **Operator** / **Admin** |
| 09:30 | Gửi báo cáo lên cấp trên | **Admin** |

### Quy trình upload file

1. Vào trang **DataInput** (hoặc API endpoint upload)
2. Chọn ngày đối soát
3. Upload theo thứ tự: Swift Đi → Swift Đến → Core → NAPAS Đi TC → NAPAS Đến TC → NAPAS Đi KTC
4. Hệ thống tự validate format và báo lỗi nếu thiếu cột / sai format ngày
5. Xác nhận → trigger engine đối soát

### Xử lý exception thủ công

Các giao dịch cần xử lý thủ công được lọc trong trang **Đối soát → filter "Cần xử lý"**:

| Trạng thái | Hành động cần làm | Ai làm |
|---|---|---|
| `TIMEOUT_CO_CORE` | Xác nhận giao dịch đã hoàn thành, đóng case | Operator |
| `CHI_SWIFT` | Kiểm tra Core + NAPAS thủ công; nếu không tìm thấy → liên hệ NAPAS | Operator |
| `SWIFT_TIMEOUT` | Xác nhận đã hủy lệnh, không cần hoàn tiền | Operator |
| `SWIFT_THAT_BAI` | Xác nhận đã hủy, ghi chú lý do | Operator |
| `NAPAS_THAT_BAI` | Liên hệ ngân hàng đối tác hoặc NAPAS để tra soát | Operator |
| `CHI_NAPAS` | Kiểm tra có phải GD ngày T-1 trong file hôm sau không; nếu có → đóng KHOP_LECH_NGAY | Operator |
| `NGOAI_LE` | Tra soát thủ công cả 3 nguồn, leo thang lên Supervisor nếu không giải thích được | Operator → Admin |

---

## 7. Xử lý sự cố

### Lỗi thường gặp

#### "Không parse được DIỄN GIẢI Core"
- **Nguyên nhân:** Core Banking export thêm ký tự đặc biệt hoặc thay đổi format dòng đầu
- **Kiểm tra:** Mở file Core, xem thử một dòng `TLR.XXXXX` — nếu cột DIỄN GIẢI không bắt đầu bằng `"06800-` thì format đã thay đổi
- **Xử lý:** Cập nhật regex trong `FileTypeSettings` hoặc config backend; không sửa file Core

#### "Số lượng NAPAS > Swift rất nhiều (>5%)"
- **Nguyên nhân thường gặp:** File NAPAS chứa cả giao dịch T-1 của ngày hôm trước (bình thường), hoặc đang dùng file nhầm ngày
- **Kiểm tra:** So sánh cột `Ngày GD` trong file NAPAS; nếu >10% entries có ngày hôm qua thì nghi ngờ file sai
- **Xử lý bình thường:** Cho phép lệch ngày, hệ thống tự gán `KHOP_LECH_NGAY`

#### "Trace trùng trong cùng một ngày"
- **Nguyên nhân:** NAPAS tái sử dụng trace sau 1,000,000 giao dịch (hiếm nhưng có thể xảy ra)
- **Kiểm tra:** Tìm 2 entries cùng trace khác amount → đây là trace thật sự trùng
- **Xử lý:** Escalate lên team backend để xử lý collision manually; ghi vào log NGOAI_LE

#### "Tất cả giao dịch ngày X bị CHI_SWIFT"
- **Nguyên nhân:** File NAPAS ngày X chưa về hoặc upload nhầm file ngày khác
- **Kiểm tra:** Vào DataStorage → NAPAS Đi, xem ngày GD có khớp với ngày đối soát không
- **Xử lý:** Upload lại file NAPAS đúng ngày, chạy lại đối soát

#### "CHI_CORE xuất hiện nhiều (>10 records)"
- **Nguyên nhân:** Thường là batch settlement NP_TREO lọt qua regex — regex đã bị lỗi
- **Kiểm tra:** Xem DIỄN GIẢI của các entry CHI_CORE; nếu chứa "NP_TREO" hay "NGCP" thì regex đang fail
- **Xử lý:** Kiểm tra và fix regex; CHI_CORE thực sự rất hiếm trong thực tế

---

## 8. Test cases theo trạng thái

Dùng data mẫu trong thư mục `example/` (file Feb 2026 từ VCB).

| Trạng thái | Trace mẫu | Ngày | Điều kiện kiểm tra |
|---|---|---|---|
| `KHOP` | 775780 | 01/02 | Swift TC + Core + NAPAS cùng ngày, amount khớp |
| `KHOP_LECH_NGAY` | 049517 | 01/02 | Swift HOST DATE = 02/02 (T+1), NAPAS ngày 01/02 |
| `KHOP_LECH_NGAY` | 768974 | 01/02 | Swift + Core ngày 01/02, NAPAS Ngày GD = 31/01 (T-1) |
| `KHOP_LECH_NGAY` | 784930 | 03/02 | Swift HOSTDATE = 20260204 (T+1) |
| `TIMEOUT_CO_CORE` | 777779 | 02/02 | Swift TIMEOUT, Core + NAPAS đều có |
| `TIMEOUT_CO_CORE` | 781475 | 03/02 | Swift TIMEOUT, Core + NAPAS đều có |
| `CHI_SWIFT` | 781481 | 03/02 | Swift TC, Core = null, NAPAS = null |
| `SWIFT_TIMEOUT` | 774976 | 01/02 | Swift TIMEOUT, Core = null, NAPAS = null |
| `SWIFT_THAT_BAI` | 777988 | 02/02 | Swift THAT BAI, Core = null, NAPAS = null |
| `NAPAS_THAT_BAI` | 141135 | 01/02 | Swift TC, Core = null, NAPAS trong file KTC |
| `NAPAS_THAT_BAI` | 469702 | 02/02 | Swift TC, Core = null, NAPAS trong file KTC 02/02 |
| `CHI_NAPAS` | 786548 | 02/02 | NAPAS có entry, Swift = null, Core = null |
| `NGOAI_LE` | 465211 | 03/02 | Swift TIMEOUT + Core có entry + NAPAS failed (mâu thuẫn) |

---

## 9. Điểm chú ý khi mở rộng

### Thêm ngân hàng mới (tái sử dụng)

Các tham số **phải cấu hình lại** cho mỗi ngân hàng:

| Tham số | VCB hiện tại | Cần cấu hình |
|---|---|---|
| Mã ngân hàng trong DIỄN GIẢI | `06800` | Thay bằng mã ngân hàng mới |
| Regex DIỄN GIẢI | `/^"?(\d+)-(\d+)-(\d+)\s+TRANSFER\s+CREDMBNEO\./` | Khác nhau theo Core Banking |
| Format HOSTDATE Swift Đi | `YYYYMMDD` số nguyên | Có thể khác nhau |
| Format HOST DATE Swift Đến | `YYYY-MM-DD` string | Có thể khác nhau |
| Số dòng skip trong Excel | 8 (Swift), 0 (NAPAS) | Phụ thuộc vào template |
| Tên cột các file | Xem `docs/reconcile-spec.md` §3 | Khác nhau theo từng ngân hàng |
| Offset ngày T | Swift±1 / NAPAS±1 | Cần xác nhận với ngân hàng mới |

### Khi Core Banking nâng cấp

- Kiểm tra lại format DIỄN GIẢI ngay sau mỗi release Core
- Test với file thực trước khi chạy production
- Không giả định format ổn định — luôn log raw DIỄN GIẢI khi parse fail

### Khi NAPAS thay đổi file format

- NAPAS có thể thêm/bớt cột mà không báo trước
- Nên có validation tên cột khi import, không dùng index cột cố định
- Lưu file gốc (archive) ít nhất 90 ngày để có thể re-process nếu cần
