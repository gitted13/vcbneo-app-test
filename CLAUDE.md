# VCBNeo – Hệ thống Đối soát NAPAS

Ứng dụng tự động hóa đối soát giao dịch thanh toán liên ngân hàng giữa 3 hệ thống: **Swift**, **Core Banking**, **NAPAS** — thay thế quy trình thủ công Excel mất 3+ giờ/ngày.

---

## Khởi chạy

```bash
# Backend  (thư mục backend/)
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Frontend  (thư mục frontend/)
npm run dev          # http://localhost:5173
```

Khi backend khởi động, `seed_flex()` tự chạy để UPSERT 6 loại file mặc định vào DB (idempotent, an toàn khi chạy lại).

---

## Stack

| Tầng | Công nghệ |
|---|---|
| Frontend | React 18 + Vite, inline styles (không dùng CSS framework) |
| Backend | FastAPI (Python 3.12), uvicorn |
| Database | MSSQL — `DESKTOP-HD3AQVG / Test_JSONTypeDB`, Windows Authentication |
| DB driver | `pyodbc` + ODBC Driver 17 for SQL Server |
| File parsing | `pandas` + `openpyxl` |

Vite proxy: `/api` → `http://127.0.0.1:8000` (cấu hình trong `frontend/vite.config.js`).

---

## Kết nối Database

```python
# backend/app/db/connection.py
_CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=DESKTOP-HD3AQVG;"
    "DATABASE=Test_JSONTypeDB;"
    "Trusted_Connection=yes;"
)
```

Dùng context manager `db_cursor()` — tự commit/rollback, luôn đóng connection:

```python
with db_cursor() as cur:
    cur.execute("SELECT ...", param)
    rows = cur.fetchall()
```

**Quan trọng:** Dùng `OUTPUT INSERTED.id` thay vì `SCOPE_IDENTITY()` vì pyodbc không trả về giá trị từ `SCOPE_IDENTITY()`.

```sql
INSERT INTO uploadedTypes (...) OUTPUT INSERTED.id VALUES (...)
```

---

## Hệ thống Flex (thiết kế cốt lõi)

Đây là phần quan trọng nhất được xây dựng trong project. Thay vì tạo bảng riêng cho từng loại file, toàn bộ cấu hình và dữ liệu được lưu dạng JSON trong 5 bảng dùng chung.

### Bảng DB

| Bảng | Mục đích |
|---|---|
| `systemCollection` | Nhóm hệ thống (hiện chỉ có `reconcile`) |
| `uploadedFileTypes` | Loại file hỗ trợ (hiện chỉ có `Excel`) |
| `uploadedTypes` | Cấu hình từng loại file (schema, tên, trạng thái) |
| `uploadedFiles` | Lịch sử mỗi lần upload (metadata, lỗi) |
| `uploadedFileRows` | Dữ liệu đã parse — **toàn bộ rows trong 1 JSON blob** |

### Cấu trúc `fields_schema` (lưu trong `uploadedTypes.fields_schema`)

```json
{
  "type_code": "swift_di",
  "description": "Báo cáo giao dịch chuyển tiền đi qua Swift",
  "columns": [
    {
      "field_name": "direction",
      "data_type": "string",
      "fixed_value": "DI",
      "required": false,
      "allowed_values": [],
      "note": ""
    },
    {
      "col_name": "TRACE NUMBER",
      "field_name": "trace",
      "data_type": "integer",
      "required": true,
      "allowed_values": [],
      "note": ""
    }
  ]
}
```

**Hai loại cột:**
- `col_name` có giá trị → đọc từ file, map theo header (case-insensitive)
- `fixed_value` có giá trị → tự điền cho mọi dòng, không đọc từ file

### Luồng upload file

1. Frontend gửi `multipart/form-data` với `type_id` + `file` tới `POST /api/v1/flex/upload`
2. Backend tra `uploadedTypes` lấy `fields_schema`
3. `pandas` parse Excel, map cột theo `col_name` (case-insensitive)
4. Với mỗi dòng: điền `fixed_value` trước, rồi đọc từ file, validate `required` và `allowed_values`
5. Insert `uploadedFiles` (metadata) + `uploadedFileRows` (JSON blob chứa tất cả rows)

### Kiểu dữ liệu hỗ trợ

`string` | `integer` | `number` | `date` | `datetime` | `boolean`

---

## API Endpoints

Base URL: `/api/v1`

### Flex module (`/flex`)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/flex/systems` | Danh sách hệ thống |
| GET | `/flex/types?system_code=reconcile` | Danh sách loại file (kèm fields_schema parsed) |
| POST | `/flex/types` | Tạo loại file mới |
| PATCH | `/flex/types/{id}` | Cập nhật tên/schema |
| GET | `/flex/files?type_id=` | Lịch sử upload |
| POST | `/flex/upload` | Upload file (multipart: type_id + file) |
| POST | `/flex/scan-file` | Quét header file mẫu, trả về cột + suggested_type |
| GET | `/flex/rows?type_id=` | Lấy dữ liệu đã parse |

### Scan File — tự động phát hiện header và infer kiểu dữ liệu

`POST /flex/scan-file` nhận file Excel, **không lưu dữ liệu**, chỉ trả về danh sách cột:

```json
{
  "columns": [
    { "col_name": "SEQ", "suggested_type": "integer" },
    { "col_name": "SỐ TIỀN", "suggested_type": "number" },
    { "col_name": "HOSTDATE", "suggested_type": "date" }
  ],
  "header_row": 3
}
```

**Thuật toán phát hiện header:** Đọc 40 hàng đầu không chỉ định header, tính "điểm text" cho mỗi hàng (số cell không phải số và không rỗng). Hàng điểm cao nhất = header.

**Thuật toán infer kiểu dữ liệu** (ưu tiên từ trên xuống):
1. Pattern `datetime` — khớp `YYYY-MM-DD HH:MM` hoặc `DD/MM/YYYY HH:MM`
2. Pattern `date` — khớp `YYYY-MM-DD`, `DD/MM/YYYY`
3. `YYYYMMDD` — số 8 chữ số, tháng 01–12, ngày 01–31, dải 1900–2100
4. Keyword tên cột → `number` nếu chứa `tiền/amount/giá/phí/balance`
5. Keyword tên cột → `date` nếu chứa `ngày/date/hostdate/time`
6. Toàn số nguyên → `integer`; toàn số thực → `number`; mặc định → `string`

---

## Seed dữ liệu mặc định

6 loại file mặc định trong `backend/app/db/seed.py`:

| upload_name | type_code | Mô tả |
|---|---|---|
| Swift Report Đi | swift_di | Giao dịch chuyển tiền đi qua Swift |
| Swift Report Đến | swift_den | Giao dịch chuyển tiền đến qua Swift |
| Core (Ghi có / Ghi nợ) | core | Dữ liệu từ Core Banking |
| Napas Đi | napas_di | Chuyển tiền đi qua NAPAS |
| Napas Đến | napas_den | Chuyển tiền đến qua NAPAS |
| Napas Đi Không thành công | napas_di_fail | Giao dịch đi thất bại (KTC) |

Seed chạy mỗi lần backend khởi động — UPSERT: nếu đã tồn tại thì UPDATE fields_schema, chưa có thì INSERT.

---

## Frontend — Trang chính

| Trang | Route | Mô tả |
|---|---|---|
| DataInput | `/data-input` | Upload file theo loại, xem lịch sử |
| FileTypeSettings | `/file-type-settings` | Cấu hình cột cho từng loại file |
| MasterSummary | `/master-summary` | Bảng tổng hợp đối soát |
| Reconcile | `/reconcile` | Chạy đối soát thủ công |
| History | `/history` | Lịch sử xử lý |

### FileTypeSettings — Luồng cấu hình

1. Load `GET /flex/types?system_code=reconcile`
2. Hiển thị danh sách TypeCard, mỗi card có bảng cột (read-only)
3. **"Quét file mẫu"** → `ScanFileModal`: upload file → scan → bảng cột auto-detect → user cấu hình field_name/type/required/note → thêm batch
4. **"Thêm cột thủ công"** → `ColFormModal` (thêm mới)
5. **"Sửa"** trên từng cột → `ColFormModal` (edit, col_name bị lock)
6. **"Lưu thay đổi"** → `PATCH /flex/types/{id}` với toàn bộ fields_schema

### State mapping Frontend ↔ Backend

```js
// DB → local state (dbToLocal)
{ _dbId, _dirty, type_code, name, description, columns: [...] }

// local → schema JSON gửi về backend (localToSchema)
// Cột từ file:    { field_name, data_type, required, allowed_values, note, col_name }
// Cột tự điền:   { field_name, data_type, required, allowed_values, note, fixed_value }
```

`_dirty = true` khi có thay đổi chưa lưu → hiện badge "Chưa lưu" màu vàng.

---

## Frontend — Conventions

- Inline styles toàn bộ, dùng token từ `frontend/src/theme.js` (`C`, `radius`, `shadow`)
- Không dùng CSS framework
- API calls qua `frontend/src/api/client.js` → namespace `api.flex.*`
- Components dùng chung: `Modal`, `Button`, `Input`, `Select`, `FormRow`, `Badge`, `PageShell`

---

## Quy trình vận hành hàng ngày

1. Nhận file từ các hệ thống (Swift, Core, NAPAS)
2. Vào **Nhập dữ liệu** → chọn đúng loại file → upload
3. Hệ thống tự validate và lưu (xem lỗi nếu có trong tab Lịch sử)
4. Vào **Đối soát** → chạy đối soát cho ngày cần
5. Xem kết quả ở **Bảng tổng hợp**, xuất Excel nếu cần

---

## Điểm cần lưu ý khi mở rộng

- **Thêm loại file mới:** Vào FileTypeSettings → "Thêm loại file" → quét file mẫu → cấu hình → lưu. Không cần sửa code.
- **Thêm kiểu dữ liệu:** Cập nhật `DATA_TYPES` trong `FileTypeSettings/index.jsx` và thêm case trong `_parse_value()` ở `flex/router.py`.
- **Đổi DB server:** Sửa `_CONN_STR` trong `backend/app/db/connection.py`.
- **Schema cột có thể thay đổi tự do** vì dữ liệu lưu dạng JSON — không cần migration.
- Khi thêm endpoint mới vào backend, **phải restart uvicorn** để endpoint có hiệu lực.
