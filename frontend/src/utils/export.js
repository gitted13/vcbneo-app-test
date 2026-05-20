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
