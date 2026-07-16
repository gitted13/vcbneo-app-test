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

### Ô trống trong file Excel — `_is_empty_cell()`

Đừng tự viết `raw is None` hay `pd.isna(raw)` riêng lẻ để kiểm tra ô trống — dùng `_is_empty_cell(raw)` trong `flex/router.py`. Lý do: tùy phiên bản pandas/openpyxl và việc đọc bằng `dtype=str`, một ô trống có thể tới dưới 3 dạng khác nhau: `None`, `float('nan')`, hoặc **chuỗi ký tự** `"nan"`/`""`/khoảng trắng. `pd.isna()` không bắt được trường hợp đã bị stringify thành `"nan"`. `_is_empty_cell()` xử lý cả 3 dạng, dùng thống nhất trong `_parse_value()`, kiểm tra `required`, và kiểm tra `allowed_values`.

### Nguồn/chiều giao dịch — `source` / `direction` trong `fields_schema` (không hardcode map)

Mỗi loại file trong `uploadedTypes.fields_schema` có thể gắn `"source"` (`Swift`/`Core`/`NAPAS`) và `"direction"` (`Đi`/`Đến`, bỏ qua với Core). Đây là cách **duy nhất** để hệ thống biết loại file nào ứng với nguồn/chiều nào khi đối soát hoặc so khớp trường — **không còn map hardcode `{(source, direction): type_code}`** ở bất cứ đâu trong code (đã xóa `_SOURCE_TYPE_CODE`/`_ROW_FILTER` cũ trong `engine_flex.py`).

- `engine_flex.py`'s `resolve_type_ids(source, direction)` — query `JSON_VALUE(fields_schema,'$.source')`/`'$.direction'`, có cache (`_source_resolve_cache`, xóa qua `clear_type_id_cache()`).
- Core Banking đặc biệt: chỉ cần gắn `source="Core"` (không cần `direction`) — chiều Ghi có/Ghi nợ được xác định **theo từng dòng dữ liệu** (kiểm tra `số_tiền_ghi_có`/`số_tiền_ghi_nợ` có giá trị hay không), không theo loại file. Vì vậy 1 hoặc nhiều loại file Core đều gắn `source="Core"`, hệ thống tự UNION tất cả rồi lọc theo dòng bằng `_CORE_ROW_FILTER` (đây là logic nghiệp vụ hợp lệ, không phải hardcode type_code).
- `unified_db_builder.py`'s `load_by_source(source, direction=None)` dùng `resolve_type_ids` để union rows của mọi type khớp.
- Frontend (`JoinLogic/index.jsx`'s `fieldsForSource()`) cũng resolve theo `fields_schema.source`/`direction` thay vì map hardcode — để hiện đúng danh sách cột khi chọn nguồn/chiều trong modal so khớp trường.
- **Bắt buộc khi thêm loại file mới liên quan đối soát**: vào FileTypeSettings, gán đúng `Nguồn dữ liệu` (và `Chiều giao dịch` nếu không phải Core) cho loại file đó — nếu bỏ trống, đối soát sẽ báo lỗi "Không tìm thấy loại file nào gán Nguồn=... — vào Cấu hình loại file để gán."
- Migration một lần (`migrate_type_source_direction()` trong `seed.py`, chạy khi backend khởi động) tự gắn `source`/`direction` cho 4 loại Swift/NAPAS đã biết rõ (`swift_di`, `swift_den`, `napas_di`, `napas_den`) nếu chưa có — **cố ý không đụng vào Core** vì có thể có nhiều loại file Core Banking đã tồn tại, không rõ loại nào nên gắn, người dùng cần tự gán qua UI.

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
| GET | `/flex/files/{file_id}/row-log` | Chi tiết từng dòng của 1 lần upload (saved/rejected/duplicate/blank) |

### Chi tiết từng dòng upload — `row_log`

Mỗi lần upload, backend ghi lại trạng thái từng dòng Excel (không chỉ tổng số lỗi) vào cột `uploadedFiles.row_log` (JSON), trả về qua `GET /flex/files/{file_id}/row-log` (phân trang `page`/`page_size`, lọc theo `status`). 4 trạng thái mỗi dòng:

| status | Ý nghĩa |
|---|---|
| `saved` | Lưu thành công |
| `duplicate` | Trùng dữ liệu đã có (theo `unique`/khóa trùng đã cấu hình) |
| `rejected` | Thiếu trường bắt buộc (kèm `reason` liệt kê tên field) |
| `blank` | Cả dòng trống hoàn toàn (dòng phân cách/dòng thừa trong Excel) — không tính là lỗi |

**Lưu ý quan trọng khi phân biệt `blank` vs `rejected`:** dòng được coi là `blank` chỉ khi **TẤT CẢ** các trường đều rỗng — không chỉ các trường `required`. Nếu kiểm tra nhầm chỉ dựa vào các trường `required`, một schema chỉ có 1 trường required sẽ luôn coi "thiếu trường required" và "cả dòng trống" là một — dòng có dữ liệu thật (các cột khác có giá trị) nhưng thiếu đúng field required đó sẽ bị xếp nhầm thành `blank` (bỏ qua âm thầm) thay vì `rejected` (báo lỗi rõ ràng). Xem `frontend/src/pages/DataInput/index.jsx`'s `RowLogModal` để xem trực quan.

Frontend: nút "Xem chi tiết" trên mỗi dòng lịch sử upload (`DataInput`'s History tab) mở `RowLogModal`, phân trang qua `Pagination` chung, lọc theo status bằng chip.

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

### Pagination — hard rule cho mọi bảng dữ liệu

Mọi `<table>` hiển thị danh sách bản ghi (upload, giao dịch, kết quả đối soát, người dùng, v.v.) **bắt buộc** dùng component `frontend/src/components/Pagination.jsx`:

```jsx
import Pagination from '../../components/Pagination'

const [page, setPage]         = useState(1)
const [pageSize, setPageSize] = useState(20)   // chọn 10/20/30/50 tùy độ "nặng" của bảng
const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)
// render pageRows trong <tbody>, KHÔNG render filtered/rows trực tiếp

<Pagination
  total={filtered.length}
  page={page}
  pageSize={pageSize}
  onPage={setPage}
  onPageSize={setPageSize}
  itemLabel="dòng"   // hoặc "bản ghi" / "giao dịch" / "người dùng" — danh từ khớp ngữ cảnh
/>
```

- Page size cố định `[10, 20, 30, 50, 75, 100]` (`PAGE_SIZE_OPTIONS` trong Pagination.jsx) — không tự chế danh sách khác.
- Component tự có ô nhập số trang (nhảy thẳng tới trang bất kỳ), không cần tự làm lại.
- Bất cứ khi nào search/filter thay đổi, phải `setPage(1)` kèm theo — nếu không trang hiện tại có thể trống dù còn dữ liệu ở trang 1.
- **Ngoại lệ có chủ đích** — bảng cấu hình kích thước cố định nhỏ (≤ ~20 dòng theo thiết kế, không phải danh sách bản ghi tăng dần) không cần phân trang vì chỉ gây rối UI mà không có lợi ích gì: bảng cột trong `FileTypeSettings`, bảng điều kiện trạng thái trong `DateRules`, bảng KPI 2 dòng trong `Reports`. Nếu một bảng "cố định nhỏ" sau này đổi sang hiển thị danh sách có thể tăng không giới hạn, phải thêm `Pagination` ngay khi đổi.
- **"Lazy loading" (giảm thời gian tải)** — 3 chiến lược khác nhau tùy đặc điểm endpoint, không phải một khuôn mẫu duy nhất:
  1. **Server-side pagination + search** (`GET /flex/rows`, `GET /flex/files`) — dùng khi filter là so sánh field/value đơn giản, portable sang backend an toàn. Client gọi `api.flex.getRows(typeId, {page, pageSize, search, dateField, dateFrom, dateTo})` / `api.flex.getFiles(typeId, {page, pageSize, search, status})`, nhận về `{rows, total, ...}` — chỉ `page_size` dòng qua wire, không phải toàn bộ dataset. Ô tìm kiếm debounce 350ms trước khi gọi API. Đây là **mẫu chuẩn** khi thêm phân trang server-side cho bảng mới có filter đơn giản.
  2. **Server-side result caching** (`GET /reconcile/db-rows`, dùng bởi `Đối soát` — thực ra dùng bởi `CoreSummary`/`NapasCore`/`SwiftCore`/`MasterSummary`) — **KHÔNG** dùng pagination vì lý do kiến trúc: 4 trang này lọc theo `filterFn` — closure JS tùy ý định nghĩa trong `frontend/src/data/reconcile.js`, phụ thuộc `recon_status`/trạng thái resolve — không portable sang backend mà không nhân đôi logic phân loại nghiệp vụ cốt lõi (rủi ro sai lệch số liệu đối soát nếu 2 bản logic lệch nhau). Chi phí thật của endpoint này là **tính toán** (join lại toàn bộ 6 loại file trong `_build_from_db()`, ~1.7s với ~15k dòng), không phải kích thước payload — nên phương án đúng là cache kết quả tính (`unified_db_builder._db_rows_cache`), xóa cache ở **mọi** điểm ghi dữ liệu ảnh hưởng tới join (upload/purge/xóa file/sửa schema loại file/sửa-tạo-xóa join config — xem toàn bộ lệnh gọi `clear_db_rows_cache()` trong `flex/router.py` và `reconciliation/router.py`). Đã đo thực tế: 1.73s (cache miss) → ~0.52s (cache hit), và xác nhận cache tự xóa đúng khi patch 1 join config.
  3. **Chưa xử lý, để nguyên client-side** — `GET /reconcile/flex-results` (trang `Đối soát`, `ResultsPanel`). Dataset bị giới hạn theo (config_id, run_date) — một cặp nguồn, một ngày — nên nhỏ hơn nhiều so với 2 endpoint trên (không phải toàn bộ lịch sử). Việc chuyển sang server-side sẽ đụng vào luồng ghi chú/resolve (`onPatch`) đang gắn chặt với state `results` ở component cha `Reconcile`, rủi ro cao hơn lợi ích đo được — quyết định có chủ đích, không phải bỏ sót.

---

## Phân loại trạng thái đối soát (DateRules) — reconcileStatusRules

Trang **Phân loại trạng thái đối soát** (`/date-rules`) cấu hình điều kiện để `engine_flex.py`'s `run_flex_reconcile()` gán trạng thái (KHỚP, LỆCH NGÀY, THẤT BẠI, ...) cho từng dòng khi chạy đối soát (nút "Chạy" ở trang **Đối soát**). Đây là hệ thống RIÊNG, khác với `recon_status` mà `CoreSummary`/`NapasCore`/`SwiftCore`/`MasterSummary` dùng (logic Python cố định trong `unified_db_builder._infer_recon_status`, không cấu hình qua UI được).

**Cấu trúc `reconcileStatusRules.rules_json`** (mỗi `cond_key` = SWIFT_DI/SWIFT_DEN/NAPAS_DI/NAPAS_DEN/CORE_DI/CORE_DEN, tương ứng 1 tab trên trang DateRules):

```json
{
  "SWIFT_DI": [
    { "id": "swift_di_0", "label": "Thành công – Core ngày T", "color": "#059669",
      "groups": [
        [ { "f": "TT Swift", "op": "=", "v": "Thành công" }, { "f": "Ngày GD", "op": "=", "v": "Ngày GN" }, { "f": "Core", "op": "ne", "v": "null" } ]
      ]
    }
  ]
}
```

- Mỗi **rule** tự chứa `label`/`color`/`groups` — không còn khớp theo vị trí mảng với bất kỳ nơi nào khác (trước đây từng khớp theo index với 3 mảng riêng biệt: mã trạng thái hardcode trong backend, nhãn/màu trong `frontend/src/data/reconcile.js` — rất dễ lệch, không thể thêm/xóa trạng thái an toàn). Xóa/thêm rule tự do qua trang DateRules, không cần sửa code.
- **`groups`**: các nhóm nối bằng **HOẶC** (OR); trong 1 nhóm, mọi điều kiện (chip) phải đúng cùng lúc (**VÀ** / AND). Rule khớp nếu ≥1 nhóm khớp hoàn toàn.
- **`status` trả về từ `_classify()` chính là `label`** (text tiếng Việt do người cấu hình đặt) — không còn mã nội bộ riêng (`TC_KHOP` kiểu cũ). `reconcileResults.status`, `flex-summary` breakdown, v.v. đều dùng trực tiếp label này.
- **Field code** (`f`) là tên trừu tượng ("TT Swift", "Ngày GD", "Core"...) được `engine_flex.py`'s `_FIELD_ALIASES` map sang tên cột thật trong dữ liệu. Nhãn hiển thị tiếng Việt cho các field/operator/value này nằm ở `frontend/src/data/dateRulesVocab.js` (KHÔNG phải `data/reconcile.js` — file đó dùng cho hệ KPI của CoreSummary/NapasCore/SwiftCore, không liên quan). Thêm field mới phải thêm ở **cả hai nơi**: `_FIELD_ALIASES` (backend, để engine đọc được giá trị) và `FIELD_LABELS`/`fieldKind()` (frontend, để hiển thị đúng loại input — ngày / trạng thái / có-không dữ liệu tương ứng).
- **So sánh không phân biệt dấu/hoa-thường** ở tầng engine (`_norm()`) — không cần lo giá trị gõ có dấu hay không khớp với dữ liệu thô không dấu.
- Dữ liệu cũ (mảng chip trần, không có `label`/`color`/`groups`) được `migrate_status_rules()` tự nâng cấp khi đọc (`GET /status-rules` hoặc khi chạy đối soát) — an toàn, giữ nguyên điều kiện đã lưu, chỉ bọc thêm `label`/`color`/`id`.

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
