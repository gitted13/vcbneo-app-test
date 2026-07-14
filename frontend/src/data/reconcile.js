/* ── Shared reconcile data ─────────────────────────────────────────────────── */

export const RECON_STATUS_META = {
  KHOP:            { label: 'Khớp',                    desc: 'Giao dịch khớp chính xác trace/số tiền/ngày giữa tất cả nguồn. Không cần xử lý thủ công.',                                              color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  KHOP_LECH_NGAY:  { label: 'Khớp lệch ngày',          desc: 'Khớp trace/số tiền nhưng ngày ghi nhận lệch T±1 do chốt sổ cuối ngày hoặc NAPAS quyết toán QT. Tự động chấp nhận.',                      color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  TIMEOUT_CO_CORE: { label: 'Timeout – Core ghi nhận', desc: 'Swift báo timeout nhưng Core GL và NAPAS đã ghi nhận giao dịch thành công. GD thực sự đã thực hiện — Operator cần review.',                color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  CHI_SWIFT:       { label: 'Chỉ Swift',               desc: 'Giao dịch xuất hiện trên Swift nhưng không có đối ứng ở Core GL hoặc NAPAS. Kiểm tra thủ công.',                                         color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  SWIFT_TIMEOUT:   { label: 'Swift timeout',           desc: 'Swift báo timeout và không có bất kỳ đối ứng nào ở Core hoặc NAPAS. Cần xác nhận hủy giao dịch.',                                        color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  SWIFT_THAT_BAI:  { label: 'Swift thất bại',          desc: 'Swift báo thất bại và NAPAS cũng ghi nhận KTC (không thành công). Cần xác nhận hủy.',                                                     color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  SWIFT_THAT_BAI_CO_CORE: { label: 'Swift thất bại – Core đã ghi nhận', desc: 'Swift và NAPAS đều báo giao dịch thất bại, nhưng Core GL lại có bút toán khớp số tiền. Mâu thuẫn nghiêm trọng — tiền có thể đã chuyển dù cả 2 hệ thống báo lỗi.', color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' },
  NAPAS_THAT_BAI:  { label: 'NAPAS thất bại',          desc: 'Giao dịch có trong file lỗi NAPAS chiều đi (KTC). Cần liên hệ NAPAS tra cứu và hoàn tiền nếu cần.',                                      color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  NAPAS_THAT_BAI_CO_CORE: { label: 'NAPAS thất bại – Core đã ghi nhận', desc: 'NAPAS báo KTC (thất bại) nhưng Core GL lại có bút toán cho giao dịch này. Mâu thuẫn cần tra soát khẩn — có thể tiền đã hạch toán dù NAPAS báo lỗi.', color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' },
  CHI_NAPAS:       { label: 'Chỉ NAPAS',               desc: 'Giao dịch chỉ xuất hiện trên NAPAS, không khớp Swift hoặc Core. Kiểm tra thủ công.',                                                     color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  CHI_CORE:        { label: 'Chỉ Core',                desc: 'Giao dịch chỉ có trên Core GL, không khớp Swift hoặc NAPAS. Thường là batch quyết toán NP_TREO — ít gặp với GD thực.',                    color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  NGOAI_LE:        { label: 'Ngoại lệ',                desc: 'Không thể phân loại tự động (ngày lệch > 2 ngày hoặc dữ liệu bất thường). Cần điều tra và xử lý thủ công.',                               color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
}

/* Thông tin đồng bộ & đối soát lần cuối — dùng để hiển thị banner cảnh báo dữ liệu
   có thể chưa đầy đủ nếu đồng bộ chưa chạy hôm nay. Trong thực tế giá trị này
   lấy từ API /api/sync-status, ở đây dùng mock để scaffold UI. */
export const LAST_SYNC_INFO = {
  syncedAt:  '19/05/2026 06:07',   // lần import dữ liệu gần nhất (RPA/thủ công)
  reconAt:   '19/05/2026 06:14',   // lần chạy đối soát gần nhất
  dataUpTo:  '03/02/2026',         // dữ liệu hiện có đến ngày này
  nextSync:  '20/05/2026 06:00',   // lần đồng bộ tiếp theo theo lịch RPA
}

export const RESOLUTION_OF = {
  KHOP:            { label: 'Tự động',             color: '#059669', needsAction: false },
  KHOP_LECH_NGAY:  { label: 'Tự động (lệch ngày)', color: '#059669', needsAction: false },
  TIMEOUT_CO_CORE: { label: 'Cần review',          color: '#d97706', needsAction: true  },
  CHI_SWIFT:       { label: 'Kiểm tra thủ công',   color: '#dc2626', needsAction: true  },
  SWIFT_TIMEOUT:   { label: 'Xác nhận hủy',        color: '#6b7280', needsAction: true  },
  SWIFT_THAT_BAI:  { label: 'Xác nhận hủy',        color: '#6b7280', needsAction: true  },
  SWIFT_THAT_BAI_CO_CORE: { label: 'Tra soát khẩn', color: '#b91c1c', needsAction: true  },
  NAPAS_THAT_BAI:  { label: 'Liên hệ đối tác',     color: '#7c3aed', needsAction: true  },
  NAPAS_THAT_BAI_CO_CORE: { label: 'Tra soát khẩn', color: '#b91c1c', needsAction: true  },
  CHI_NAPAS:       { label: 'Kiểm tra thủ công',   color: '#dc2626', needsAction: true  },
  CHI_CORE:        { label: 'Kiểm tra thủ công',   color: '#dc2626', needsAction: true  },
  NGOAI_LE:        { label: 'Xử lý ngoại lệ',      color: '#7c3aed', needsAction: true  },
}

/* ── Shared filter helpers ──────────────────────────────────────────────────── */
export const isT1 = r => r.swift?.txnDate !== r.swift?.date
const ymd = s => s.split('/').reverse().join('')  // 'DD/MM/YYYY' → 'YYYYMMDD' (lexicographically comparable)

/* ── Column definitions — dùng chung MasterSummary + 3 trang đối soát ──────────
   SPEC LOCKED tháng 5/2026 — KHÔNG tự đổi nhãn, thêm/bớt cột, hay dùng
   recon_status để phân biệt T vs T+1 trong các cặp NAPAS/Core.

   Quy ước T:
   • Swift:      T = txnDate; T+1 khi txnDate ≠ hostDate (isT1)
   • NAPAS Đi:   T = napas.date; T-1 khi napas.date < core.date (QT overnight)
   • NAPAS Đến:  T = napas.date; Core T-1/T/T+1 so sánh tương đối
   • Core:       T = core.date; NAPAS/Swift so sánh tương đối
   • NAPAS không có timeout — chỉ TC (failed=false) và KTC (failed=true)   ──── */

/* Swift ↔ Core chiều Đi — TC/TO × T/T+1 + Thất bại + Chỉ Swift (THANH_CONG không có Core)
   "Chỉ Swift" = Swift THANH_CONG nhưng Core không ghi nhận — bao gồm cả NAPAS KTC (CHI_SWIFT + NAPAS_THAT_BAI không có Core).
   T = ngày GD thực tế (txnDate); T+1 = Core ghi nhận ngày tiếp theo (isT1) */
export const SWIFT_COLS_DI = [
  { label: 'Thành công – Core ngày T',    color:'#059669', bg:'#f0fdf4', border:'#bbf7d0', filterFn: r => !!r.swift && r.swift.status === 'THANH_CONG' && !isT1(r) && !!r.core },
  { label: 'Thành công – Core ngày T+1',  color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc', filterFn: r => !!r.swift && r.swift.status === 'THANH_CONG' && isT1(r)  && !!r.core },
  { label: 'Timeout – Core ngày T',       color:'#d97706', bg:'#fffbeb', border:'#fde68a', filterFn: r => !!r.swift && r.swift.status === 'TIMEOUT'    && !isT1(r) && !!r.core },
  { label: 'Timeout – Core ngày T+1',     color:'#f59e0b', bg:'#fef9c3', border:'#fde68a', filterFn: r => !!r.swift && r.swift.status === 'TIMEOUT'    && isT1(r)  && !!r.core },
  { label: 'Thất bại – ngày T',           color:'#6b7280', bg:'#f9fafb', border:'#e5e7eb', filterFn: r => !!r.swift && r.swift.status === 'THAT_BAI'   && !isT1(r) },
  { label: 'Thất bại – ngày T+1',         color:'#9ca3af', bg:'#f9fafb', border:'#e5e7eb', filterFn: r => !!r.swift && r.swift.status === 'THAT_BAI'   && isT1(r)  },
  { label: 'Chỉ Swift',                   color:'#dc2626', bg:'#fef2f2', border:'#fecaca', tabOnly: true, filterFn: r => !!r.swift && !r.core && r.swift.status === 'THANH_CONG' },
]

/* Swift ↔ Core chiều Đến — TC/TO × T/T+1 + Thất bại + Chỉ Swift */
export const SWIFT_COLS_DEN = [
  { label: 'Thành công – Core ngày T',    color:'#059669', bg:'#f0fdf4', border:'#bbf7d0', filterFn: r => !!r.swift && r.swift.status === 'THANH_CONG' && !isT1(r) && !!r.core },
  { label: 'Thành công – Core ngày T+1',  color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc', filterFn: r => !!r.swift && r.swift.status === 'THANH_CONG' && isT1(r)  && !!r.core },
  { label: 'Timeout – Core ngày T',       color:'#d97706', bg:'#fffbeb', border:'#fde68a', filterFn: r => !!r.swift && r.swift.status === 'TIMEOUT'    && !isT1(r) && !!r.core },
  { label: 'Timeout – Core ngày T+1',     color:'#f59e0b', bg:'#fef9c3', border:'#fde68a', filterFn: r => !!r.swift && r.swift.status === 'TIMEOUT'    && isT1(r)  && !!r.core },
  { label: 'Thất bại – ngày T',           color:'#6b7280', bg:'#f9fafb', border:'#e5e7eb', filterFn: r => !!r.swift && r.swift.status === 'THAT_BAI'   && !isT1(r) },
  { label: 'Thất bại – ngày T+1',         color:'#9ca3af', bg:'#f9fafb', border:'#e5e7eb', filterFn: r => !!r.swift && r.swift.status === 'THAT_BAI'   && isT1(r)  },
  { label: 'Chỉ Swift',                   color:'#dc2626', bg:'#fef2f2', border:'#fecaca', tabOnly: true, filterFn: r => !!r.swift && !r.core && r.swift.status === 'THANH_CONG' },
]

/* CoreSummary Ghi có — Core là gốc (T), Swift và NAPAS so sánh tương đối.
   "Chỉ có Swift – không có NAPAS" = Core + Swift khớp nhưng không có NAPAS — GD hợp lệ, truy vết được qua Swift. */
export const CORE_COLS_DI = [
  { label: 'Swift ngày T-1 – NAPAS ngày T',       color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc',
    filterFn: r => !!r.core && !!r.swift && !!r.napas && ymd(r.swift.date) < ymd(r.core.date) && r.napas.date === r.core.date },
  { label: 'Swift ngày T – NAPAS ngày T',          color:'#059669', bg:'#f0fdf4', border:'#bbf7d0',
    filterFn: r => !!r.core && !!r.swift && !!r.napas && r.swift.date === r.core.date && r.napas.date === r.core.date },
  { label: 'Swift ngày T – NAPAS ngày T+1',        color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe',
    filterFn: r => !!r.core && !!r.swift && !!r.napas && r.swift.date === r.core.date && ymd(r.napas.date) > ymd(r.core.date) },
  { label: 'Thất bại – không có trên NAPAS',       color:'#d97706', bg:'#fffbeb', border:'#fde68a',
    filterFn: r => !!r.core && !!r.swift && !r.napas },
]

/* CoreSummary Ghi nợ — Core là gốc (T), NAPAS so sánh tương đối. */
export const CORE_COLS_DEN = [
  { label: 'Core ngày T – NAPAS ngày T-1',         color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc',
    filterFn: r => !!r.core && !!r.napas && ymd(r.napas.date) < ymd(r.core.date) },
  { label: 'Core ngày T – NAPAS ngày T',            color:'#059669', bg:'#f0fdf4', border:'#bbf7d0',
    filterFn: r => !!r.core && !!r.napas && r.napas.date === r.core.date },
  { label: 'Core ngày T – NAPAS ngày T+1',          color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe',
    filterFn: r => !!r.core && !!r.napas && ymd(r.napas.date) > ymd(r.core.date) },
  { label: 'Core có – không có NAPAS',              color:'#d97706', bg:'#fffbeb', border:'#fde68a',
    filterFn: r => !!r.core && !!r.swift && !r.napas },
]

/* NAPAS ↔ Core chiều Đi — NAPAS không có timeout, chỉ TC/KTC
   Lệch ngày: NAPAS ghi nhận ngày T-1 (type=QT), Core booking ngày T */
export const NAPAS_COLS_DI = [
  { label: 'Thành công – NAPAS ngày T-1, Core ngày T', color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc',
    filterFn: r => !!r.napas && !r.napas.failed && !!r.core && ymd(r.napas.date) < ymd(r.core.date) },
  { label: 'Thành công – NAPAS ngày T, Core ngày T',   color:'#059669', bg:'#f0fdf4', border:'#bbf7d0',
    filterFn: r => !!r.napas && !r.napas.failed && !!r.core && r.napas.date === r.core.date },
  { label: 'Không thành công (KTC)',                    color:'#dc2626', bg:'#fef2f2', border:'#fecaca',
    filterFn: r => !!r.napas && r.napas.failed },
  { label: 'Chỉ NAPAS TC – không có Core',              color:'#d97706', bg:'#fffbeb', border:'#fde68a',
    filterFn: r => !!r.napas && !r.napas.failed && !r.core },
]

/* NapasCore Đến — NAPAS là gốc (T), Core so sánh tương đối */
export const NAPAS_COLS_DEN = [
  { label: 'Thành công – Core ngày T-1',  color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe',
    filterFn: r => !!r.napas && !r.napas.failed && !!r.core && ymd(r.core.date) < ymd(r.napas.date) },
  { label: 'Thành công – Core ngày T',    color:'#059669', bg:'#f0fdf4', border:'#bbf7d0',
    filterFn: r => !!r.napas && !r.napas.failed && !!r.core && r.core.date === r.napas.date },
  { label: 'Thành công – Core ngày T+1',  color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc',
    filterFn: r => !!r.napas && !r.napas.failed && !!r.core && ymd(r.core.date) > ymd(r.napas.date) },
  { label: 'Chỉ NAPAS TC – không có Core', color:'#d97706', bg:'#fffbeb', border:'#fde68a',
    filterFn: r => !!r.napas && !r.napas.failed && !r.core },
]

/* ── Master data – 30 giao dịch thực tế 01–03/02/2026 ─────────────────────── */
/* swift.date = hostDate (ngày ghi nhận), swift.txnDate = ngày thực tế GD      */
/* napas.time = giờ GD thực tế (HH:MM)                                          */
/* day = ngày của sheet (ngày GD thực tế theo luồng xử lý)                     */
export const INITIAL_ROWS = [
  /* ── 01/02/2026 Đi ─────────────────────────────────────────────────────── */
  { id: 'r001', trace: '775780', sequence: '16366', direction: 'Đi', amount: 10_000_000, day: '01/02/2026',
    swift: { date: '01/02/2026', txnDate: '01/02/2026', status: 'THANH_CONG' },
    core:  { date: '01/02/2026', entry: 'Ghi có' },
    napas: { date: '01/02/2026', time: '10:45', failed: false, type: 'GD' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  { id: 'r002', trace: '775781', sequence: '16367', direction: 'Đi', amount: 140_000, day: '01/02/2026',
    swift: { date: '01/02/2026', txnDate: '01/02/2026', status: 'THANH_CONG' },
    core:  { date: '01/02/2026', entry: 'Ghi có' },
    napas: { date: '01/02/2026', time: '10:45', failed: false, type: 'GD' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  { id: 'r003', trace: '775783', sequence: '16368', direction: 'Đi', amount: 107_000, day: '01/02/2026',
    swift: { date: '01/02/2026', txnDate: '01/02/2026', status: 'THANH_CONG' },
    core:  { date: '01/02/2026', entry: 'Ghi có' },
    napas: { date: '01/02/2026', time: '10:45', failed: false, type: 'GD' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  /* T+1: txnDate=01/02 (late night), hostDate=02/02 — NAPAS QT type */
  { id: 'r004', trace: '777753', sequence: '18263', direction: 'Đi', amount: 4_200_000, day: '01/02/2026',
    swift: { date: '02/02/2026', txnDate: '01/02/2026', status: 'THANH_CONG' },
    core:  { date: '02/02/2026', entry: 'Ghi có' },
    napas: { date: '01/02/2026', time: '23:31', failed: false, type: 'QT' },
    recon_status: 'KHOP_LECH_NGAY', resolved_by: null, resolved_at: null, note: null },

  { id: 'r005', trace: '776110', sequence: '16680', direction: 'Đi', amount: 100_000, day: '01/02/2026',
    swift: { date: '01/02/2026', txnDate: '01/02/2026', status: 'TIMEOUT' },
    core:  { date: '01/02/2026', entry: 'Ghi có' },
    napas: { date: '01/02/2026', time: '12:33', failed: false, type: 'GD' },
    recon_status: 'TIMEOUT_CO_CORE', resolved_by: null, resolved_at: null, note: null },

  /* ── 02/02/2026 Đi ─────────────────────────────────────────────────────── */
  { id: 'r006', trace: '781272', sequence: '21556', direction: 'Đi', amount: 11_000_000, day: '02/02/2026',
    swift: { date: '02/02/2026', txnDate: '02/02/2026', status: 'THANH_CONG' },
    core:  { date: '02/02/2026', entry: 'Ghi có' },
    napas: { date: '02/02/2026', time: '21:21', failed: false, type: 'GD' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  { id: 'r007', trace: '781280', sequence: '21562', direction: 'Đi', amount: 8_000_000, day: '02/02/2026',
    swift: { date: '02/02/2026', txnDate: '02/02/2026', status: 'THANH_CONG' },
    core:  { date: '02/02/2026', entry: 'Ghi có' },
    napas: { date: '02/02/2026', time: '21:24', failed: false, type: 'GD' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  { id: 'r008', trace: '781281', sequence: '21563', direction: 'Đi', amount: 2_000_000, day: '02/02/2026',
    swift: { date: '02/02/2026', txnDate: '02/02/2026', status: 'THANH_CONG' },
    core:  { date: '02/02/2026', entry: 'Ghi có' },
    napas: { date: '02/02/2026', time: '21:24', failed: false, type: 'GD' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  /* T+1: txnDate=02/02 (late night), hostDate=03/02 — NAPAS QT type */
  { id: 'r009', trace: '781471', sequence: '21739', direction: 'Đi', amount: 2_750_000, day: '02/02/2026',
    swift: { date: '03/02/2026', txnDate: '02/02/2026', status: 'THANH_CONG' },
    core:  { date: '03/02/2026', entry: 'Ghi có' },
    napas: { date: '02/02/2026', time: '23:27', failed: false, type: 'QT' },
    recon_status: 'KHOP_LECH_NGAY', resolved_by: null, resolved_at: null, note: null },

  /* Swift timeout – Core không ghi nhận */
  { id: 'r010', trace: '779633', sequence: '20006', direction: 'Đi', amount: 915_333, day: '02/02/2026',
    swift: { date: '02/02/2026', txnDate: '02/02/2026', status: 'TIMEOUT' },
    core:  null,
    napas: { date: '02/02/2026', time: '13:50', failed: false, type: 'GD' },
    recon_status: 'SWIFT_TIMEOUT', resolved_by: null, resolved_at: null, note: null },

  /* ── 03/02/2026 Đi ─────────────────────────────────────────────────────── */
  { id: 'r011', trace: '783312', sequence: '23459', direction: 'Đi', amount: 1_800_000, day: '03/02/2026',
    swift: { date: '03/02/2026', txnDate: '03/02/2026', status: 'THANH_CONG' },
    core:  { date: '03/02/2026', entry: 'Ghi có' },
    napas: { date: '03/02/2026', time: '14:13', failed: false, type: 'GD' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  { id: 'r012', trace: '783314', sequence: '23460', direction: 'Đi', amount: 150_000, day: '03/02/2026',
    swift: { date: '03/02/2026', txnDate: '03/02/2026', status: 'THANH_CONG' },
    core:  { date: '03/02/2026', entry: 'Ghi có' },
    napas: { date: '03/02/2026', time: '14:13', failed: false, type: 'GD' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  { id: 'r013', trace: '783313', sequence: '23461', direction: 'Đi', amount: 10_000, day: '03/02/2026',
    swift: { date: '03/02/2026', txnDate: '03/02/2026', status: 'THANH_CONG' },
    core:  { date: '03/02/2026', entry: 'Ghi có' },
    napas: { date: '03/02/2026', time: '14:14', failed: false, type: 'GD' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  { id: 'r014', trace: '782624', sequence: '22805', direction: 'Đi', amount: 770_000, day: '03/02/2026',
    swift: { date: '03/02/2026', txnDate: '03/02/2026', status: 'TIMEOUT' },
    core:  { date: '03/02/2026', entry: 'Ghi có' },
    napas: { date: '03/02/2026', time: '11:04', failed: false, type: 'GD' },
    recon_status: 'TIMEOUT_CO_CORE', resolved_by: null, resolved_at: null, note: null },

  /* Swift thất bại – Core & NAPAS KTC */
  { id: 'r015', trace: '784811', sequence: '24869', direction: 'Đi', amount: 605_000, day: '03/02/2026',
    swift: { date: '03/02/2026', txnDate: '03/02/2026', status: 'THAT_BAI' },
    core:  null,
    napas: { date: '03/02/2026', time: '21:39', failed: true, type: 'GD' },
    recon_status: 'SWIFT_THAT_BAI', resolved_by: null, resolved_at: null, note: null },

  /* ── 01/02/2026 Đến ─────────────────────────────────────────────────────── */
  /* T+1 overnight: txnDate=01/02, hostDate=02/02 */
  { id: 'r016', trace: '049517', sequence: '99158', direction: 'Đến', amount: 2_000_000, day: '01/02/2026',
    swift: { date: '02/02/2026', txnDate: '01/02/2026', status: 'THANH_CONG' },
    core:  { date: '02/02/2026', entry: 'Ghi nợ' },
    napas: { date: '02/02/2026', time: '00:01', failed: false, type: 'GD' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  { id: 'r017', trace: '635097', sequence: '99143', direction: 'Đến', amount: 2_000_000, day: '01/02/2026',
    swift: { date: '01/02/2026', txnDate: '01/02/2026', status: 'THANH_CONG' },
    core:  { date: '01/02/2026', entry: 'Ghi nợ' },
    napas: { date: '01/02/2026', time: '23:21', failed: false, type: 'QT' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  { id: 'r018', trace: '995397', sequence: '99142', direction: 'Đến', amount: 250_000, day: '01/02/2026',
    swift: { date: '01/02/2026', txnDate: '01/02/2026', status: 'THANH_CONG' },
    core:  { date: '01/02/2026', entry: 'Ghi nợ' },
    napas: { date: '01/02/2026', time: '23:19', failed: false, type: 'QT' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  /* KHOP_LECH_NGAY Đến: NAPAS QT (23:57 ngày 01), Core+Swift ghi nhận ngày 02 */
  { id: 'r019', trace: '205269', sequence: '99157', direction: 'Đến', amount: 17_000_000, day: '01/02/2026',
    swift: { date: '02/02/2026', txnDate: '01/02/2026', status: 'THANH_CONG' },
    core:  { date: '02/02/2026', entry: 'Ghi nợ' },
    napas: { date: '01/02/2026', time: '23:57', failed: false, type: 'QT' },
    recon_status: 'KHOP_LECH_NGAY', resolved_by: null, resolved_at: null, note: null },

  { id: 'r020', trace: '109235', sequence: '99141', direction: 'Đến', amount: 48_066, day: '01/02/2026',
    swift: { date: '01/02/2026', txnDate: '01/02/2026', status: 'THANH_CONG' },
    core:  { date: '01/02/2026', entry: 'Ghi nợ' },
    napas: { date: '01/02/2026', time: '23:14', failed: false, type: 'QT' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  /* ── 02/02/2026 Đến ─────────────────────────────────────────────────────── */
  { id: 'r021', trace: '747454', sequence: '99999', direction: 'Đến', amount: 7_500_000, day: '02/02/2026',
    swift: { date: '02/02/2026', txnDate: '02/02/2026', status: 'THANH_CONG' },
    core:  { date: '02/02/2026', entry: 'Ghi nợ' },
    napas: { date: '02/02/2026', time: '11:13', failed: false, type: 'GD' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  { id: 'r022', trace: '411557', sequence: '99998', direction: 'Đến', amount: 500_000, day: '02/02/2026',
    swift: { date: '02/02/2026', txnDate: '02/02/2026', status: 'THANH_CONG' },
    core:  { date: '02/02/2026', entry: 'Ghi nợ' },
    napas: { date: '02/02/2026', time: '11:12', failed: false, type: 'GD' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  { id: 'r023', trace: '420781', sequence: '99997', direction: 'Đến', amount: 70_000, day: '02/02/2026',
    swift: { date: '02/02/2026', txnDate: '02/02/2026', status: 'THANH_CONG' },
    core:  { date: '02/02/2026', entry: 'Ghi nợ' },
    napas: { date: '02/02/2026', time: '11:12', failed: false, type: 'GD' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  /* CHI_SWIFT – chỉ có Swift, không khớp Core/NAPAS */
  { id: 'r024', trace: '279924', sequence: '1208', direction: 'Đến', amount: 2_000_000, day: '02/02/2026',
    swift: { date: '02/02/2026', txnDate: '02/02/2026', status: 'THANH_CONG' },
    core:  null,
    napas: null,
    recon_status: 'CHI_SWIFT', resolved_by: null, resolved_at: null, note: null },

  { id: 'r025', trace: '803665', sequence: '99996', direction: 'Đến', amount: 1_022_000, day: '02/02/2026',
    swift: { date: '02/02/2026', txnDate: '02/02/2026', status: 'THANH_CONG' },
    core:  { date: '02/02/2026', entry: 'Ghi nợ' },
    napas: { date: '02/02/2026', time: '11:12', failed: false, type: 'GD' },
    recon_status: 'KHOP', resolved_by: null, resolved_at: null, note: null },

  /* ── 03/02/2026 Đến (overnight – Swift hostDate=04/02) ──────────────────── */
  /* Core GL chỉ đến 03/02 → không khớp → CHI_SWIFT                           */
  { id: 'r026', trace: '569169', sequence: '3812', direction: 'Đến', amount: 200_000, day: '03/02/2026',
    swift: { date: '04/02/2026', txnDate: '03/02/2026', status: 'THANH_CONG' },
    core:  null,
    napas: null,
    recon_status: 'CHI_SWIFT', resolved_by: null, resolved_at: null, note: null },

  { id: 'r027', trace: '754572', sequence: '3811', direction: 'Đến', amount: 1_500_000, day: '03/02/2026',
    swift: { date: '04/02/2026', txnDate: '03/02/2026', status: 'THANH_CONG' },
    core:  null,
    napas: null,
    recon_status: 'CHI_SWIFT', resolved_by: null, resolved_at: null, note: null },

  { id: 'r028', trace: '006147', sequence: '3810', direction: 'Đến', amount: 300_000, day: '03/02/2026',
    swift: { date: '04/02/2026', txnDate: '03/02/2026', status: 'THANH_CONG' },
    core:  null,
    napas: null,
    recon_status: 'CHI_SWIFT', resolved_by: null, resolved_at: null, note: null },

  { id: 'r029', trace: '562402', sequence: '3809', direction: 'Đến', amount: 200_000, day: '03/02/2026',
    swift: { date: '04/02/2026', txnDate: '03/02/2026', status: 'THANH_CONG' },
    core:  null,
    napas: null,
    recon_status: 'CHI_SWIFT', resolved_by: null, resolved_at: null, note: null },

  { id: 'r030', trace: '159181', sequence: '3808', direction: 'Đến', amount: 14_000_000, day: '03/02/2026',
    swift: { date: '04/02/2026', txnDate: '03/02/2026', status: 'THANH_CONG' },
    core:  null,
    napas: null,
    recon_status: 'CHI_SWIFT', resolved_by: null, resolved_at: null, note: null },
]
