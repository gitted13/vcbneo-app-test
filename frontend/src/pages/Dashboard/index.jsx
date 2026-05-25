import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../../components/PageShell'
import Button from '../../components/Button'
import { Input } from '../../components/Input'
import { C, radius, shadow, font } from '../../theme'
import { api } from '../../api/client'

const GUIDE_KEY = 'vcbneo_guide_dismissed'

const STEP_STYLES = {
  pre: { badge: '#e0e7ff', badgeText: '#3730a3', border: '1px solid #c7d2fe', text: '#4338ca', bg: '#f5f3ff' },
  act: { badge: '#1d4ed8', badgeText: '#fff',    border: 'none',               text: '#1e40af', bg: 'transparent' },
  opt: { badge: '#059669', badgeText: '#fff',    border: 'none',               text: '#065f46', bg: 'transparent' },
}

/* ── Guide banner ─────────────────────────────────────────────────────────── */
function GuideBanner({ onDismiss, navigate }) {
  const renderStep = (label, badgeText, text, type = 'act') => {
    const s = STEP_STYLES[type]
    return (
      <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'flex-start',
        background: s.bg, borderRadius: 4, padding: type === 'pre' ? '4px 8px' : 0 }}>
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, background: s.badge,
          color: s.badgeText, borderRadius: 3, padding: '1px 6px', marginTop: 1,
          border: s.border, whiteSpace: 'nowrap' }}>
          {badgeText}
        </span>
        <span style={{ fontSize: font.sm, color: s.text, lineHeight: 1.55 }}>{text}</span>
      </div>
    )
  }

  const lk = (label, route) => (
    <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(route)}>{label}</span>
  )

  return (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: radius.lg,
      padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>📋</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: font.md, color: C.primary, marginBottom: 8 }}>
          Quy trình đối soát
        </div>
        {renderStep('Bước 0', 'Bước 0 — đã thiết lập',
          <><b>Cấu hình file</b> — thiết lập loại file và cột dữ liệu tại {lk('Cài đặt loại file', '/file-type-settings')}</>, 'pre')}
        {renderStep('Bước 1', 'Bước 1',
          <><b>Tải lên dữ liệu</b> — 6 loại file (Swift Đi/Đến, Core, NAPAS Đi/Đến/KTC) tại {lk('Tải lên dữ liệu', '/data-input')}</>)}
        {renderStep('Bước 2', 'Bước 2',
          <><b>Kiểm tra kho dữ liệu</b> — xác nhận dữ liệu đã nạp đúng tại {lk('Kho dữ liệu', '/storage')} trước khi đối soát</>)}
        {renderStep('Bước 3', 'Bước 3 — đã thiết lập',
          <><b>Cấu hình đối chiếu / quy tắc xử lý</b> — thiết lập trước, xem lại nếu cần điều chỉnh</>, 'pre')}
        {renderStep('Bước 4', 'Bước 4',
          <><b>Xem kết quả đối soát</b> tại{' '}
            {lk('Swift–Core GL', '/swift-core')} ·{' '}
            {lk('NAPAS–Core GL', '/napas-core')} ·{' '}
            {lk('Core GL Tổng hợp', '/core-summary')}</>)}
        {renderStep('Bước 5', 'Bước 5 — tuỳ chọn',
          <><b>Xuất báo cáo tổng hợp</b> — xem và xuất {lk('Bảng tổng hợp 3 nguồn', '/master')}</>, 'opt')}
      </div>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer',
        color: '#60a5fa', fontSize: 16, flexShrink: 0, lineHeight: 1, padding: 2 }} title="Ẩn">✕</button>
    </div>
  )
}

/* ── KPI card ────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, color, bg, border }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: radius.lg,
      padding: '14px 18px', boxShadow: shadow.sm, flex: '1 1 140px', minWidth: 130 }}>
      <div style={{ fontSize: font.sm, color: C.textMuted, marginBottom: 4, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: font.sm, color: C.textMuted, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

/* ── Quick link ──────────────────────────────────────────────────────────── */
function QuickLink({ label, desc, route, color, navigate }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 16px', borderBottom: `1px solid ${C.neutralBorder}`, gap: 12 }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: font.base, color }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: color, marginRight: 8, verticalAlign: 'middle' }} />
          {label}
        </div>
        <div style={{ fontSize: font.sm, color: C.textMuted, marginTop: 2, paddingLeft: 16 }}>{desc}</div>
      </div>
      <Button variant="ghost" size="sm" onClick={() => navigate(route)}>Xem →</Button>
    </div>
  )
}

/* ── SVG Bar Chart ───────────────────────────────────────────────────────── */
function BarChart({ days, diCounts, denCounts }) {
  const n = days.length
  if (n === 0) return (
    <div style={{ height: 148, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#9ca3af', fontSize: font.sm }}>Không có dữ liệu trong khoảng thời gian này</div>
  )

  const VW = 600, H = 140, padL = 34, padR = 6, padT = 10, padB = 22
  const innerW = VW - padL - padR
  const maxVal = Math.max(...diCounts, ...denCounts, 1)
  const barGroupW = innerW / n
  const barW = Math.max(2, Math.min(16, barGroupW * 0.38))
  const offDi  = barGroupW * 0.12
  const offDen = offDi + barW + 1
  const yFracs = [0, 0.25, 0.5, 0.75, 1]

  return (
    <svg viewBox={`0 0 ${VW} ${H + padT + padB}`} style={{ width: '100%', display: 'block' }}>
      {/* Y grid + labels */}
      {yFracs.map(frac => {
        const y = padT + H * (1 - frac)
        return (
          <g key={frac}>
            <line x1={padL} y1={y} x2={VW - padR} y2={y} stroke={frac === 0 ? '#e5e7eb' : '#f3f4f6'} strokeWidth={frac === 0 ? 1 : 0.8} />
            {frac > 0 && (
              <text x={padL - 4} y={y + 3.5} textAnchor="end" fontSize={8.5} fill="#9ca3af">
                {Math.round(maxVal * frac)}
              </text>
            )}
          </g>
        )
      })}

      {/* Bars + X labels */}
      {days.map((day, i) => {
        const x0 = padL + i * barGroupW
        const diH = Math.max(0, (diCounts[i] / maxVal) * H)
        const denH = Math.max(0, (denCounts[i] / maxVal) * H)
        const mid = x0 + barGroupW / 2
        const labelFS = n > 20 ? 7 : 8.5

        return (
          <g key={day}>
            <rect x={x0 + offDi}  y={padT + H - diH}  width={barW} height={diH}  fill="#3b82f6" rx={1.5} opacity={0.85} />
            <rect x={x0 + offDen} y={padT + H - denH} width={barW} height={denH} fill="#8b5cf6" rx={1.5} opacity={0.85} />
            <text x={mid} y={padT + H + padB - 3} textAnchor="middle" fontSize={labelFS} fill="#9ca3af">
              {day.slice(0, 5)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ── Main ────────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(GUIDE_KEY) === '1')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [chartFrom, setChartFrom] = useState('')
  const [chartTo, setChartTo] = useState('')

  useEffect(() => {
    api.getDbRows()
      .then(res => setRows(res.rows ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleDismiss() { localStorage.setItem(GUIDE_KEY, '1'); setDismissed(true) }
  function handleRestore() { localStorage.removeItem(GUIDE_KEY); setDismissed(false) }

  const dayToISO = s => { const [d, m, y] = s.split('/'); return `${y}-${m}-${d}` }

  /* KPI computation */
  const rowsDi  = rows.filter(r => r.swift && r.direction === 'Đi')
  const rowsDen = rows.filter(r => r.swift && r.direction === 'Đến')
  const matched    = r => r.recon_status === 'KHOP' || r.recon_status === 'KHOP_LECH_NGAY'
  const needAction = r => ['CHI_SWIFT','SWIFT_TIMEOUT','SWIFT_THAT_BAI','NAPAS_THAT_BAI','CHI_NAPAS','CHI_CORE','NGOAI_LE'].includes(r.recon_status) && !r.resolved_by

  const totalDi  = rowsDi.length
  const totalDen = rowsDen.length
  const matchedDi  = rowsDi.filter(matched).length
  const matchedDen = rowsDen.filter(matched).length
  const needDi  = rowsDi.filter(needAction).length
  const needDen = rowsDen.filter(needAction).length
  const matchRateDi  = totalDi  ? Math.round(matchedDi  / totalDi  * 100) : 0
  const matchRateDen = totalDen ? Math.round(matchedDen / totalDen * 100) : 0

  /* Chart data */
  const chartRows = rows.filter(r => {
    if (!r.day) return false
    if (chartFrom && dayToISO(r.day) < chartFrom) return false
    if (chartTo   && dayToISO(r.day) > chartTo)   return false
    return true
  })
  const uniqueDays = [...new Set(chartRows.map(r => r.day))].sort((a, b) => {
    const [da, ma, ya] = a.split('/'); const [db, mb, yb] = b.split('/')
    return `${ya}-${ma}-${da}` < `${yb}-${mb}-${db}` ? -1 : 1
  })
  const diCounts  = uniqueDays.map(d => chartRows.filter(r => r.day === d && r.swift && r.direction === 'Đi').length)
  const denCounts = uniqueDays.map(d => chartRows.filter(r => r.day === d && r.swift && r.direction === 'Đến').length)

  const actions = !dismissed && (
    <Button variant="ghost" size="sm" onClick={handleDismiss}>Ẩn hướng dẫn</Button>
  )

  return (
    <PageShell title="Tổng quan" subtitle="Hệ thống đối soát giao dịch NAPAS" actions={actions}>

      {!dismissed && <GuideBanner onDismiss={handleDismiss} navigate={navigate} />}

      {dismissed && (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="subtle" size="sm" onClick={handleRestore}>📋 Xem lại hướng dẫn</Button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted, fontSize: font.sm }}>Đang tải dữ liệu...</div>
      ) : rows.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg,
          padding: '32px 24px', textAlign: 'center', boxShadow: shadow.sm }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
          <div style={{ fontWeight: 700, fontSize: font.lg, color: C.text, marginBottom: 8 }}>Chưa có dữ liệu</div>
          <div style={{ fontSize: font.base, color: C.textMuted, marginBottom: 16 }}>Tải lên file để bắt đầu đối soát</div>
          <Button variant="primary" onClick={() => navigate('/data-input')}>Đến trang Tải lên</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* KPI — Đi */}
          <div>
            <div style={{ fontSize: font.sm, fontWeight: 700, color: C.textMuted, marginBottom: 8,
              textTransform: 'uppercase', letterSpacing: 0.5 }}>Giao dịch Đi</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <KpiCard label="Tổng GD Đi" value={totalDi.toLocaleString('vi-VN')}
                color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" />
              <KpiCard label="Tỉ lệ khớp" value={`${matchRateDi}%`}
                sub={`${matchedDi.toLocaleString('vi-VN')} / ${totalDi.toLocaleString('vi-VN')} giao dịch`}
                color="#059669" bg="#f0fdf4" border="#bbf7d0" />
              <KpiCard label="Cần xử lý" value={needDi.toLocaleString('vi-VN')} sub="Chưa giải quyết"
                color={needDi > 0 ? '#dc2626' : '#059669'}
                bg={needDi > 0 ? '#fef2f2' : '#f0fdf4'}
                border={needDi > 0 ? '#fecaca' : '#bbf7d0'} />
            </div>
          </div>

          {/* KPI — Đến */}
          <div>
            <div style={{ fontSize: font.sm, fontWeight: 700, color: C.textMuted, marginBottom: 8,
              textTransform: 'uppercase', letterSpacing: 0.5 }}>Giao dịch Đến</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <KpiCard label="Tổng GD Đến" value={totalDen.toLocaleString('vi-VN')}
                color="#7c3aed" bg="#f5f3ff" border="#ddd6fe" />
              <KpiCard label="Tỉ lệ khớp" value={`${matchRateDen}%`}
                sub={`${matchedDen.toLocaleString('vi-VN')} / ${totalDen.toLocaleString('vi-VN')} giao dịch`}
                color="#059669" bg="#f0fdf4" border="#bbf7d0" />
              <KpiCard label="Cần xử lý" value={needDen.toLocaleString('vi-VN')} sub="Chưa giải quyết"
                color={needDen > 0 ? '#dc2626' : '#059669'}
                bg={needDen > 0 ? '#fef2f2' : '#f0fdf4'}
                border={needDen > 0 ? '#fecaca' : '#bbf7d0'} />
            </div>
          </div>

          {/* Chart */}
          <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg,
            boxShadow: shadow.sm, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.cardBorder}`,
              background: C.neutralBg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: font.sm, fontWeight: 700, color: C.textMuted,
                textTransform: 'uppercase', letterSpacing: 0.5 }}>Biểu đồ giao dịch theo ngày</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Input type="date" value={chartFrom} onChange={e => setChartFrom(e.target.value)} style={{ width: 140 }} />
                <span style={{ fontSize: 12, color: C.textMuted }}>–</span>
                <Input type="date" value={chartTo} onChange={e => setChartTo(e.target.value)} style={{ width: 140 }} />
                {(chartFrom || chartTo) && (
                  <Button size="sm" variant="ghost" onClick={() => { setChartFrom(''); setChartTo('') }}>Xoá lọc</Button>
                )}
              </div>
            </div>
            <div style={{ padding: '12px 16px 4px' }}>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#374151' }}>
                  <span style={{ width: 12, height: 12, background: '#3b82f6', borderRadius: 2, display: 'inline-block' }} />
                  Giao dịch Đi
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#374151' }}>
                  <span style={{ width: 12, height: 12, background: '#8b5cf6', borderRadius: 2, display: 'inline-block' }} />
                  Giao dịch Đến
                </span>
              </div>
              <BarChart days={uniqueDays} diCounts={diCounts} denCounts={denCounts} />
            </div>
          </div>

          {/* Quick links */}
          <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg,
            boxShadow: shadow.sm, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.cardBorder}`, background: C.neutralBg }}>
              <span style={{ fontSize: font.sm, fontWeight: 700, color: C.textMuted,
                textTransform: 'uppercase', letterSpacing: 0.5 }}>Trang đối soát</span>
            </div>
            <QuickLink label="Swift – Core GL" desc="Đối soát giao dịch Swift với sổ cái Core Banking"
              route="/swift-core" color="#1e40af" navigate={navigate} />
            <QuickLink label="NAPAS – Core GL" desc="Đối soát giao dịch NAPAS với sổ cái Core Banking"
              route="/napas-core" color="#92400e" navigate={navigate} />
            <QuickLink label="Core GL Tổng hợp" desc="Core GL làm gốc — đối chiếu đồng thời Swift và NAPAS"
              route="/core-summary" color="#166534" navigate={navigate} />
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="subtle" size="sm" onClick={() => navigate('/master')}>Bảng tổng hợp 3 nguồn →</Button>
            </div>
          </div>

        </div>
      )}
    </PageShell>
  )
}
