/* ── Excel export utility — uses xlsx-js-style for styled workbooks ──────── */

const BANK_NAME = 'NGÂN HÀNG TMCP NGOẠI THƯƠNG VN'

function triggerDownload(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 100)
}

/* Convert #RRGGBB → 'RRGGBB' for xlsx-js-style */
const rgb = h => (h || '').replace('#', '').toUpperCase() || '000000'

/* Encode cell ref, handles multi-letter columns (A, Z, AA, …) */
function cellRef(r, c) {
  let col = ''
  let n = c
  do {
    col = String.fromCharCode(65 + (n % 26)) + col
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return col + (r + 1)
}

function thin(color = 'D1D5DB') {
  const b = { style: 'thin', color: { rgb: color } }
  return { top: b, bottom: b, left: b, right: b }
}

function cs(ws, r, c, style) {
  const ref = cellRef(r, c)
  if (!ws[ref]) ws[ref] = { v: '', t: 's' }
  ws[ref].s = style
}

function csRow(ws, r, fromC, toC, style) {
  for (let c = fromC; c <= toC; c++) cs(ws, r, c, style)
}

/* ── Detail page export (SwiftCore / NapasCore / CoreSummary) ────────────── */
export async function downloadDetailXlsx({ title, dir, filterFrom, filterTo, headers, rows, headerBg, filename }) {
  const XLSX = await import('xlsx-js-style')

  const dateStr = filterFrom || filterTo
    ? `Từ: ${filterFrom ? filterFrom.split('-').reverse().join('/') : '—'}  đến  ${filterTo ? filterTo.split('-').reverse().join('/') : '—'}`
    : 'Tất cả ngày'
  const printDate = new Date().toLocaleDateString('vi-VN')
  const nCols = headers.length
  const lastC = nCols - 1

  const aoa = [
    /* Row 0 */ [BANK_NAME, ...Array(lastC - 1).fill(''), `Ngày in: ${printDate}`],
    /* Row 1 */ [title, ...Array(lastC).fill('')],
    /* Row 2 */ [`Chiều: ${dir}     ${dateStr}`, ...Array(lastC).fill('')],
    /* Row 3 */ Array(nCols).fill(''),
    /* Row 4 */ headers,
    ...rows,
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastC - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastC } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastC } },
  ]

  /* Intro styles */
  cs(ws, 0, 0, { font: { bold: true, sz: 11, color: { rgb: '1E3A8A' } } })
  cs(ws, 0, lastC, { font: { sz: 9, color: { rgb: '6B7280' } }, alignment: { horizontal: 'right' } })
  cs(ws, 1, 0, { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } })
  cs(ws, 2, 0, { font: { sz: 10, color: { rgb: '374151' } } })

  /* Table header row (row 4) */
  const hBg = rgb(headerBg || '#1E40AF')
  csRow(ws, 4, 0, lastC, {
    font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: hBg } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: thin(),
  })

  /* Data rows — light borders */
  for (let r = 5; r < aoa.length; r++) {
    for (let c = 0; c < nCols; c++) {
      const ref = cellRef(r, c)
      if (ws[ref]) {
        const isAmt = headers[c] && String(headers[c]).includes('VNĐ')
        ws[ref].s = {
          font: { sz: 10 },
          alignment: { horizontal: isAmt ? 'right' : 'left' },
          border: thin('E5E7EB'),
        }
        /* Format amount cells as number */
        if (isAmt && typeof ws[ref].v === 'number') {
          ws[ref].t = 'n'
          ws[ref].z = '#,##0'
        }
      }
    }
  }

  /* Column widths */
  ws['!cols'] = headers.map(h => ({ wch: Math.max(String(h).length + 2, 12) }))

  /* Row heights */
  ws['!rows'] = [
    { hpt: 18 }, { hpt: 26 }, { hpt: 14 }, { hpt: 6 }, { hpt: 40 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, dir.slice(0, 31))
  triggerDownload(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), filename + '.xlsx')
}

/* ── Template export — khớp cấu trúc file TONG HOP THANG 2.xls ───────────
   Sheet 1: ĐI- ĐỐI CHIẾU NAPAS   (Đi, Swift làm gốc)
   Sheet 2: ĐẾN -ĐỐI CHIEU NAPAS  (Đến, Swift làm gốc)
   Sheet 3: DOI CHIEU CORE VA NAPAS (Core vs NAPAS tổng hợp)

   Header 3 cấp (rows 6-8, 0-indexed), data từ row 9.
   Mỗi cột số liệu gồm 2 sub-col: Số món | Số tiền. ─────────────────────── */

function buildTemplateSheet(XLSX, filteredDays, dirRows, colDefs, titleRow3, titleRow4, label) {
  /* colDefs: [{ name, fn }] — fn(dayRows) → [count, amount] */
  const N_DATA = colDefs.length   /* number of data col-pairs */
  const TOTAL  = 2 + N_DATA * 2  /* date + label + N*2 */

  const dateStr = new Date().toLocaleDateString('vi-VN')

  /* ── Row 0-5: header block ── */
  const blank = Array(TOTAL).fill('')
  const r0 = [BANK_NAME, ...blank.slice(1)]
  const r1 = ['ĐƠN VỊ: TTTT', ...blank.slice(1)]
  const r2 = [...blank]
  const r3 = [titleRow3, ...blank.slice(1)]
  const r4 = [...blank]
  const r5 = [...blank]

  /* ── Row 6: col-group row (Ngày, Nội dung, group names) ── */
  const r6 = ['Ngày ', 'Nội dung']
  colDefs.forEach(cd => { r6.push(cd.group ?? cd.name, ...Array(1).fill('')) })

  /* ── Row 7: sub-group row ── */
  const r7 = ['', '']
  colDefs.forEach(cd => { r7.push(cd.name, '') })

  /* ── Row 8: leaf row (Số món / Số tiền) ── */
  const r8 = ['', '']
  colDefs.forEach(() => { r8.push('Số món', 'Số tiền') })

  /* ── Data rows ── */
  const dataRows = filteredDays.map(day => {
    const dayRows = dirRows.filter(r => r.day === day)
    const row = [day, label]
    colDefs.forEach(cd => {
      const [cnt, amt] = cd.fn(dayRows)
      row.push(cnt, amt)
    })
    return row
  })

  /* ── Total row ── */
  const totalRow = ['TỔNG CỘNG', '']
  colDefs.forEach(cd => {
    const [cnt, amt] = cd.fn(dirRows.filter(r => filteredDays.includes(r.day)))
    totalRow.push(cnt, amt)
  })

  const aoa = [r0, r1, r2, r3, r4, r5, r6, r7, r8, ...dataRows, totalRow]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  /* Merges: date + label span rows 6-8, each col-pair spans row 7 */
  const merges = [
    { s:{r:6,c:0}, e:{r:8,c:0} },  /* Ngày spans 3 rows */
    { s:{r:6,c:1}, e:{r:8,c:1} },  /* Nội dung spans 3 rows */
    { s:{r:0,c:0}, e:{r:0,c:TOTAL-1} },
    { s:{r:1,c:0}, e:{r:1,c:TOTAL-1} },
    { s:{r:3,c:0}, e:{r:3,c:TOTAL-1} },
  ]
  colDefs.forEach((cd, ci) => {
    const c = 2 + ci * 2
    /* group label spans row 6 (2 cols) */
    merges.push({ s:{r:6,c}, e:{r:6,c:c+1} })
    /* sub-group label spans row 7 (2 cols) */
    merges.push({ s:{r:7,c}, e:{r:7,c:c+1} })
  })
  ws['!merges'] = merges

  /* Styles */
  cs(ws, 0, 0, { font:{bold:true, sz:11, color:{rgb:'1E3A8A'}} })
  cs(ws, 3, 0, { font:{bold:true, sz:13}, alignment:{horizontal:'center'} })

  const hStyle = (bgHex, colorHex) => ({
    font:{bold:true, sz:10, color:{rgb:rgb(colorHex||'#374151')}},
    fill:{fgColor:{rgb:rgb(bgHex||'#F3F4F6')}},
    alignment:{horizontal:'center', vertical:'center', wrapText:true},
    border:thin(),
  })

  /* Row 6 header */
  cs(ws, 6, 0, hStyle('#E2E8F0'))
  cs(ws, 6, 1, hStyle('#E2E8F0'))
  colDefs.forEach((cd, ci) => {
    const c = 2 + ci * 2
    cs(ws, 6, c,   hStyle(cd.bg ?? '#DBEAFE', cd.color ?? '#1E3A8A'))
    cs(ws, 6, c+1, hStyle(cd.bg ?? '#DBEAFE', cd.color ?? '#1E3A8A'))
  })

  /* Row 7 + 8 headers */
  for (let hr = 7; hr <= 8; hr++) {
    cs(ws, hr, 0, hStyle('#F3F4F6'))
    cs(ws, hr, 1, hStyle('#F3F4F6'))
    colDefs.forEach((cd, ci) => {
      const c = 2 + ci * 2
      cs(ws, hr, c,   hStyle(cd.bg ?? '#EFF6FF', cd.color ?? '#1E40AF'))
      cs(ws, hr, c+1, hStyle(cd.bg ?? '#EFF6FF', cd.color ?? '#1E40AF'))
    })
  }

  /* Data rows */
  const amtCols = new Set()
  colDefs.forEach((_, ci) => amtCols.add(2 + ci * 2 + 1))

  for (let ri = 9; ri < aoa.length - 1; ri++) {
    for (let ci = 0; ci < TOTAL; ci++) {
      const ref = cellRef(ri, ci)
      if (!ws[ref]) continue
      ws[ref].s = { font:{sz:10}, border:thin('E5E7EB'), alignment:{horizontal: amtCols.has(ci) ? 'right' : 'center'} }
      if (amtCols.has(ci) && typeof ws[ref].v === 'number') { ws[ref].t = 'n'; ws[ref].z = '#,##0' }
    }
  }
  /* Day col: left-aligned */
  for (let ri = 9; ri < aoa.length; ri++) {
    const ref = cellRef(ri, 0)
    if (ws[ref]) ws[ref].s = { font:{sz:10}, border:thin('E5E7EB'), alignment:{horizontal:'left'} }
  }

  /* Total row */
  const tIdx = aoa.length - 1
  for (let ci = 0; ci < TOTAL; ci++) {
    const ref = cellRef(tIdx, ci)
    if (!ws[ref]) ws[ref] = {v:'', t:'s'}
    ws[ref].s = { font:{bold:true,sz:10}, fill:{fgColor:{rgb:'E2E8F0'}}, border:thin('94A3B8'), alignment:{horizontal: amtCols.has(ci) ? 'right' : 'center'} }
    if (amtCols.has(ci) && typeof ws[ref].v === 'number') { ws[ref].t = 'n'; ws[ref].z = '#,##0' }
  }

  /* Column widths */
  ws['!cols'] = [
    {wch:14}, {wch:28},
    ...colDefs.flatMap(() => [{wch:9},{wch:20}]),
  ]

  ws['!rows'] = [
    {hpt:16},{hpt:14},{hpt:6},{hpt:22},{hpt:6},{hpt:6},
    {hpt:28},{hpt:28},{hpt:16},
  ]

  return ws
}

export async function downloadTemplateXlsx({ filteredDays, allRows, filterFrom, filterTo, sumAmt, isT1fn }) {
  const XLSX = await import('xlsx-js-style')

  const di  = allRows.filter(r => r.swift && r.direction === 'Đi')
  const den = allRows.filter(r => r.swift && r.direction === 'Đến')

  /* Helper */
  const calc = (fn) => (dayRows) => {
    const rs = dayRows.filter(fn)
    return [rs.length, sumAmt(rs)]
  }
  const add2 = (a, b) => (dayRows) => {
    const [c1, a1] = a(dayRows); const [c2, a2] = b(dayRows)
    return [c1+c2, a1+a2]
  }
  const add3 = (a, b, c) => (dayRows) => {
    const [c1,a1]=a(dayRows); const [c2,a2]=b(dayRows); const [c3,a3]=c(dayRows)
    return [c1+c2+c3, a1+a2+a3]
  }

  /* Đi direction col defs */
  const swiftDi = calc(r => !!r.swift)
  const tcT     = calc(r => !!r.swift && r.swift.status==='THANH_CONG' && !isT1fn(r) && !!r.core)
  const toT     = calc(r => !!r.swift && r.swift.status==='TIMEOUT'    && !isT1fn(r) && !!r.core)
  const tbT     = calc(r => !!r.swift && r.swift.status==='THAT_BAI'   && !isT1fn(r))
  const totT    = add3(tcT, toT, tbT)
  const tcT1    = calc(r => !!r.swift && r.swift.status==='THANH_CONG' && isT1fn(r) && !!r.core)
  const tbT1    = calc(r => !!r.swift && r.swift.status==='THAT_BAI'   && isT1fn(r))
  const totT1   = add2(tcT1, tbT1)
  const coreAll = calc(r => !!r.swift && !!r.core)
  const chiSwift= calc(r => !!r.swift && !r.core && r.swift.status==='THANH_CONG')

  const colsDi = [
    { name:'Tổng cộng',             group:'Tổng phát sinh trên Swift',   fn:swiftDi, bg:'#BFDBFE', color:'#1E3A8A' },
    { name:'Trạng thái Thành công', group:'Ghi nhận Core ngày T',        fn:tcT,     bg:'#DCFCE7', color:'#166534' },
    { name:'Trạng thái Timeout',    group:'Ghi nhận Core ngày T',        fn:toT,     bg:'#FEF9C3', color:'#854D0E' },
    { name:'Trạng thái Thất bại',   group:'Ghi nhận Core ngày T',        fn:tbT,     bg:'#FEE2E2', color:'#991B1B' },
    { name:'Tổng cộng T',           group:'Ghi nhận Core ngày T',        fn:totT,    bg:'#E0F2FE', color:'#0369A1' },
    { name:'Thành công T+1',        group:'Ghi nhận Core ngày T+1',      fn:tcT1,    bg:'#ECFDF5', color:'#065F46' },
    { name:'Thất bại T+1',          group:'Ghi nhận Core ngày T+1',      fn:tbT1,    bg:'#FEF2F2', color:'#991B1B' },
    { name:'Tổng cộng T+1',         group:'Ghi nhận Core ngày T+1',      fn:totT1,   bg:'#E0F2FE', color:'#0369A1' },
    { name:'Tổng số',               group:'Số phát sinh tài khoản GL ngày T', fn:coreAll, bg:'#F3F4F6', color:'#374151' },
    { name:'Chỉ Swift',             group:'Số phát sinh tài khoản GL ngày T', fn:chiSwift, bg:'#FEF2F2', color:'#991B1B' },
  ]

  /* Đến direction col defs */
  const swiftDen = calc(r => !!r.swift)
  const tcTd     = calc(r => !!r.swift && r.swift.status==='THANH_CONG' && !isT1fn(r) && !!r.core)
  const tbTd     = calc(r => !!r.swift && r.swift.status==='THAT_BAI'   && !isT1fn(r))
  const totTd    = add2(tcTd, tbTd)
  const tcT1d    = calc(r => !!r.swift && r.swift.status==='THANH_CONG' && isT1fn(r) && !!r.core)
  const tbT1d    = calc(r => !!r.swift && r.swift.status==='THAT_BAI'   && isT1fn(r))
  const totT1d   = add2(tcT1d, tbT1d)
  const coreAlld = calc(r => !!r.swift && !!r.core)
  const chiSwiftd= calc(r => !!r.swift && !r.core && r.swift.status==='THANH_CONG')

  const colsDen = [
    { name:'Tổng cộng',             group:'Tổng phát sinh trên Swift',   fn:swiftDen, bg:'#BFDBFE', color:'#1E3A8A' },
    { name:'Trạng thái Thành công', group:'Ghi nhận Core ngày T',        fn:tcTd,     bg:'#DCFCE7', color:'#166534' },
    { name:'Trạng thái Thất bại',   group:'Ghi nhận Core ngày T',        fn:tbTd,     bg:'#FEE2E2', color:'#991B1B' },
    { name:'Tổng cộng T',           group:'Ghi nhận Core ngày T',        fn:totTd,    bg:'#E0F2FE', color:'#0369A1' },
    { name:'Thành công T+1',        group:'Ghi nhận Core ngày T+1',      fn:tcT1d,    bg:'#ECFDF5', color:'#065F46' },
    { name:'Thất bại T+1',          group:'Ghi nhận Core ngày T+1',      fn:tbT1d,    bg:'#FEF2F2', color:'#991B1B' },
    { name:'Tổng cộng T+1',         group:'Ghi nhận Core ngày T+1',      fn:totT1d,   bg:'#E0F2FE', color:'#0369A1' },
    { name:'Tổng số',               group:'Số phát sinh tài khoản GL ngày T', fn:coreAlld, bg:'#F3F4F6', color:'#374151' },
    { name:'Chỉ Swift',             group:'Số phát sinh tài khoản GL ngày T', fn:chiSwiftd, bg:'#FEF2F2', color:'#991B1B' },
  ]

  /* Sheet 3: Core vs NAPAS tổng hợp */
  const coreVsNapas = () => {
    const coreDi  = allRows.filter(r => r.core && r.direction==='Đi')
    const coreDen = allRows.filter(r => r.core && r.direction==='Đến')
    const napasTcDi  = allRows.filter(r => r.napas && !r.napas.failed && r.direction==='Đi')
    const napasTcDen = allRows.filter(r => r.napas && !r.napas.failed && r.direction==='Đến')
    const aoa3 = [
      [BANK_NAME],
      ['ĐƠN VỊ: TTTT'],
      [],
      ['BẢNG TỔNG HỢP THEO DÕI GIAO DỊCH QUA KÊNH NAPAS'],
      [], [],
      ['Ngày ', 'Nội dung', 'Tài khoản', 'Ghi nợ/có', 'Số liệu trên cân đối', '', 'Số liệu trên bảng quyết toán thành công Napas', '', 'Chênh lệch', '', 'Nguyên nhân/ghi chú'],
      ['', '', '', '', 'Số lượng giao dịch', 'Tổng số tiền', 'Số lượng giao dịch', 'Tổng số tiền', 'Số lượng giao dịch', 'Số tiền', ''],
      ['', 'Giao dịch chuyển tiền đi 24/7', '270411311', 'Nợ', coreDi.length, sumAmt(coreDi), napasTcDi.length, sumAmt(napasTcDi), coreDi.length-napasTcDi.length, sumAmt(coreDi)-sumAmt(napasTcDi), ''],
      ['', 'Giao dịch chuyển tiền đến 24/7', '270411311', 'Có', coreDen.length, sumAmt(coreDen), napasTcDen.length, sumAmt(napasTcDen), coreDen.length-napasTcDen.length, sumAmt(coreDen)-sumAmt(napasTcDen), ''],
    ]
    const ws3 = XLSX.utils.aoa_to_sheet(aoa3)
    ws3['!merges'] = [
      {s:{r:0,c:0},e:{r:0,c:10}},
      {s:{r:3,c:0},e:{r:3,c:10}},
      {s:{r:6,c:4},e:{r:6,c:5}},
      {s:{r:6,c:6},e:{r:6,c:7}},
      {s:{r:6,c:8},e:{r:6,c:9}},
    ]
    cs(ws3, 3, 0, {font:{bold:true,sz:13}, alignment:{horizontal:'center'}})
    ws3['!cols'] = [{wch:12},{wch:30},{wch:14},{wch:10},{wch:16},{wch:20},{wch:16},{wch:20},{wch:14},{wch:18},{wch:30}]
    return ws3
  }

  const wb = XLSX.utils.book_new()
  const wsDi  = buildTemplateSheet(XLSX, filteredDays, di,  colsDi,  'BẢNG TỔNG HỢP THEO DÕI GIAO DỊCH ĐI QUA KÊNH NAPAS',  '', 'Giao dịch chuyển tiền đi 24/7')
  const wsDen = buildTemplateSheet(XLSX, filteredDays, den, colsDen, 'BẢNG TỔNG HỢP THEO DÕI GIAO DỊCH ĐẾN QUA KÊNH NAPAS', '', 'Giao dịch chuyển tiền đến 24/7')
  const wsCore = coreVsNapas()

  XLSX.utils.book_append_sheet(wb, wsDi,  'ĐI- ĐỐI CHIẾU NAPAS')
  XLSX.utils.book_append_sheet(wb, wsDen, 'ĐẾN -ĐỐI CHIEU NAPAS')
  XLSX.utils.book_append_sheet(wb, wsCore,'DOI CHIEU CORE VA NAPAS')

  const dateFilename = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')
  triggerDownload(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `TongHop_${dateFilename}.xlsx`)
}

/* ── MasterSummary export ─────────────────────────────────────────────────── */
export async function downloadMasterXlsx({ dir, visSections, filteredDays, allRows, filteredRows, sumAmt, filterFrom, filterTo }) {
  const XLSX = await import('xlsx-js-style')

  const INTRO = 4   /* intro rows before table headers */

  /* --- Build column position map --- */
  let colPos = 1    /* col 0 = Ngày GD */
  const secInfos = []
  const merges = []

  /* Ngày GD spans all 3 header rows */
  merges.push({ s: { r: INTRO, c: 0 }, e: { r: INTRO + 2, c: 0 } })

  for (const s of visSections) {
    const secStart = colPos
    const colGroups = []

    /* Section total: 2 cols */
    colGroups.push({ type: 'total', start: colPos })
    merges.push({ s: { r: INTRO + 1, c: colPos }, e: { r: INTRO + 1, c: colPos + 1 } })
    colPos += 2

    /* Each subcol: 2 cols */
    for (const col of s.cols) {
      colGroups.push({ type: 'col', col, start: colPos })
      merges.push({ s: { r: INTRO + 1, c: colPos }, e: { r: INTRO + 1, c: colPos + 1 } })
      colPos += 2
    }

    const secEnd = colPos - 1
    merges.push({ s: { r: INTRO, c: secStart }, e: { r: INTRO, c: secEnd } })
    secInfos.push({ s, secStart, secEnd, colGroups })
  }

  const totalCols = colPos
  const lastC = totalCols - 1

  /* --- Build AOA --- */
  const dateStr = filterFrom || filterTo
    ? `Từ: ${filterFrom ? filterFrom.split('-').reverse().join('/') : '—'}  đến  ${filterTo ? filterTo.split('-').reverse().join('/') : '—'}`
    : 'Tất cả ngày'
  const printDate = new Date().toLocaleDateString('vi-VN')

  const hdr0 = ['NGÀY GD']
  const hdr1 = ['']
  const hdr2 = ['']
  for (const { s } of secInfos) {
    hdr0.push(s.label, ...Array(1 + 2 * s.cols.length).fill(''))
    hdr1.push('Tổng', '', ...s.cols.flatMap(col => [col.label, '']))
    hdr2.push('Số GD', 'Số tiền (VNĐ)', ...s.cols.flatMap(() => ['Số GD', 'Số tiền (VNĐ)']))
  }

  const dataRows = filteredDays.map(day => {
    const dayRows = allRows.filter(r => r.day === day)
    const row = [day]
    for (const { s } of secInfos) {
      const sr = dayRows.filter(s.totalFn)
      row.push(sr.length, sumAmt(sr))
      for (const col of s.cols) {
        const cr = dayRows.filter(col.filterFn)
        row.push(cr.length, sumAmt(cr))
      }
    }
    return row
  })

  const totalRow = ['TỔNG CỘNG']
  for (const { s } of secInfos) {
    const sr = filteredRows.filter(s.totalFn)
    totalRow.push(sr.length, sumAmt(sr))
    for (const col of s.cols) {
      const cr = filteredRows.filter(col.filterFn)
      totalRow.push(cr.length, sumAmt(cr))
    }
  }

  const aoa = [
    [BANK_NAME, ...Array(totalCols - 2).fill(''), `Ngày in: ${printDate}`],
    ['BÁO CÁO TỔNG HỢP ĐỐI CHIẾU 3 NGUỒN', ...Array(lastC).fill('')],
    [`Chiều: ${dir}     ${dateStr}`, ...Array(lastC).fill('')],
    Array(totalCols).fill(''),
    hdr0, hdr1, hdr2,
    ...dataRows,
    totalRow,
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  /* Intro merges */
  merges.push(
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastC } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastC } },
  )
  ws['!merges'] = merges

  /* --- Apply styles --- */

  /* Intro rows */
  cs(ws, 0, 0, { font: { bold: true, sz: 11, color: { rgb: '1E3A8A' } } })
  cs(ws, 0, lastC, { font: { sz: 9, color: { rgb: '6B7280' } }, alignment: { horizontal: 'right' } })
  cs(ws, 1, 0, { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } })
  cs(ws, 2, 0, { font: { sz: 10, color: { rgb: '374151' } } })

  /* Table header row 0 (INTRO) — section groups */
  cs(ws, INTRO, 0, {
    font: { bold: true, sz: 10, color: { rgb: '374151' } },
    fill: { fgColor: { rgb: 'F3F4F6' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thin(),
  })
  for (const { s, secStart, secEnd } of secInfos) {
    for (let c = secStart; c <= secEnd; c++) {
      cs(ws, INTRO, c, {
        font: { bold: true, sz: 11, color: { rgb: rgb(s.color) } },
        fill: { fgColor: { rgb: rgb(s.bg) } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thin(rgb(s.border)),
      })
    }
  }

  /* Table header row 1 (INTRO+1) — col group labels */
  cs(ws, INTRO + 1, 0, { fill: { fgColor: { rgb: 'F3F4F6' } }, border: thin() })
  for (const { s, colGroups } of secInfos) {
    for (const cg of colGroups) {
      const bg = cg.type === 'total' ? rgb(s.bg) : rgb(cg.col.bg)
      const co = cg.type === 'total' ? rgb(s.color) : rgb(cg.col.color)
      const bd = cg.type === 'total' ? rgb(s.border) : rgb(cg.col.border)
      for (let c = cg.start; c < cg.start + 2; c++) {
        cs(ws, INTRO + 1, c, {
          font: { bold: true, sz: 10, color: { rgb: co } },
          fill: { fgColor: { rgb: bg } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: thin(bd),
        })
      }
    }
  }

  /* Table header row 2 (INTRO+2) — GD / Tiền leaf labels */
  cs(ws, INTRO + 2, 0, { fill: { fgColor: { rgb: 'F3F4F6' } }, border: thin() })
  for (const { s, colGroups } of secInfos) {
    for (const cg of colGroups) {
      const bg = cg.type === 'total' ? rgb(s.bg) : rgb(cg.col.bg)
      const co = cg.type === 'total' ? rgb(s.color) : rgb(cg.col.color)
      for (let c = cg.start; c < cg.start + 2; c++) {
        cs(ws, INTRO + 2, c, {
          font: { bold: true, sz: 9, color: { rgb: co } },
          fill: { fgColor: { rgb: bg } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: thin(),
        })
      }
    }
  }

  /* Data rows — light border + number format for amount cols */
  const amtColSet = new Set()
  for (const { colGroups } of secInfos) {
    for (const cg of colGroups) {
      amtColSet.add(cg.start + 1)  /* odd offset = amount col */
    }
  }
  for (let r = INTRO + 3; r < aoa.length - 1; r++) {
    for (let c = 0; c < totalCols; c++) {
      const ref = cellRef(r, c)
      if (ws[ref]) {
        ws[ref].s = { font: { sz: 10 }, border: thin('E5E7EB'), alignment: { horizontal: amtColSet.has(c) ? 'right' : 'center' } }
        if (amtColSet.has(c) && typeof ws[ref].v === 'number') { ws[ref].t = 'n'; ws[ref].z = '#,##0' }
      }
    }
  }

  /* Grand total row */
  const totalRowIdx = aoa.length - 1
  for (let c = 0; c < totalCols; c++) {
    const ref = cellRef(totalRowIdx, c)
    const style = {
      font: { bold: true, sz: 10 },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      border: thin('94A3B8'),
      alignment: { horizontal: amtColSet.has(c) ? 'right' : 'center' },
    }
    if (!ws[ref]) ws[ref] = { v: '', t: 's' }
    ws[ref].s = style
    if (amtColSet.has(c) && typeof ws[ref].v === 'number') { ws[ref].t = 'n'; ws[ref].z = '#,##0' }
  }

  /* Column widths */
  ws['!cols'] = [
    { wch: 14 },
    ...secInfos.flatMap(({ s }) => [
      { wch: 8 }, { wch: 18 },
      ...s.cols.flatMap(() => [{ wch: 8 }, { wch: 18 }]),
    ]),
  ]

  /* Row heights */
  ws['!rows'] = [
    { hpt: 18 }, { hpt: 26 }, { hpt: 14 }, { hpt: 6 },
    { hpt: 28 }, { hpt: 42 }, { hpt: 18 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Tong hop ${dir}`.slice(0, 31))
  const dateFilename = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')
  triggerDownload(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `TongHop_${dir}_${dateFilename}.xlsx`)
}
