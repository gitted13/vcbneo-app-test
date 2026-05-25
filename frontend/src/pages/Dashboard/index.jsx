import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../../components/PageShell'
import Button from '../../components/Button'
import { C, radius, shadow, font } from '../../theme'
import { api } from '../../api/client'
import { SWIFT_COLS_DI, SWIFT_COLS_DEN } from '../../data/reconcile'

const GUIDE_KEY = 'vcbneo_guide_dismissed'

/* ── Guide banner (dismissible) ─────────────────────────────────────────── */
function GuideBanner({ onDismiss, navigate }) {
  return (
    <div style={{
      background: '#eff6ff',
      border: '1px solid #bfdbfe',
      borderRadius: radius.lg,
      padding: '16px 20px',
      marginBottom: 20,
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start',
    }}>
      <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>📋</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: font.md, color: C.primary, marginBottom: 6 }}>
          Hướng dẫn quy trình đối soát
        </div>
        <div style={{ fontSize: font.sm, color: '#1e40af', lineHeight: 1.7 }}>
          <div style={{ marginBottom: 4 }}>
            <b>Bước 1:</b> Tải lên 6 loại file (Swift Đi/Đến, Core, NAPAS Đi/Đến/KTC) tại{' '}
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/data-input')}>Tải lên dữ liệu</span>
          </div>
          <div style={{ marginBottom: 4 }}>
            <b>Bước 2:</b> Kiểm tra dữ liệu đã nạp đúng tại{' '}
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/storage')}>Kho dữ liệu</span>
            {' '}trước khi xem kết quả đối soát
          </div>
          <div style={{ marginBottom: 4 }}>
            <b>Bước 3:</b> Xem kết quả đối soát tại{' '}
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/swift-core')}>Swift–Core GL</span>
            {' '}·{' '}
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/napas-core')}>NAPAS–Core GL</span>
            {' '}·{' '}
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/core-summary')}>Core GL Tổng hợp</span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <b>Bước 4 (tuỳ chọn):</b> Xem và xuất{' '}
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/master')}>Bảng tổng hợp 3 nguồn</span>
          </div>
          <div style={{ fontSize: 11, color: '#3730a3', background: '#e0e7ff', borderRadius: 4, padding: '4px 8px', display: 'inline-block' }}>
            ℹ Cấu hình file và quy tắc đối soát (Bước 0) đã được thiết lập sẵn — tập trung vào Bước 1–3 trước.
          </div>
        </div>
      </div>
      <button onClick={onDismiss} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#60a5fa', fontSize: 18, flexShrink: 0, lineHeight: 1,
        padding: 2,
      }} title="Ẩn hướng dẫn">✕</button>
    </div>
  )
}

/* ── KPI card ────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, color, bg, border, onClick, active }) {
  return (
    <div onClick={onClick} style={{
      background: active ? bg : '#fff',
      border: `1px solid ${active ? border : C.cardBorder}`,
      borderRadius: radius.lg,
      padding: '16px 20px',
      boxShadow: shadow.sm,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.12s',
      flex: '1 1 160px',
      minWidth: 150,
    }}>
      <div style={{ fontSize: font.sm, color: C.textMuted, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: active ? color : C.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: font.sm, color: C.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

/* ── Quick link row ──────────────────────────────────────────────────────── */
function QuickLink({ label, desc, route, color, bg, border, navigate }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: `1px solid ${C.neutralBorder}`,
      gap: 12,
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: font.base, color }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 8, verticalAlign: 'middle' }} />
          {label}
        </div>
        <div style={{ fontSize: font.sm, color: C.textMuted, marginTop: 2, paddingLeft: 18 }}>{desc}</div>
      </div>
      <Button variant="ghost" size="sm" onClick={() => navigate(route)}>Xem →</Button>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(GUIDE_KEY) === '1')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDbRows()
      .then(res => setRows(res.rows ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleDismiss() { localStorage.setItem(GUIDE_KEY, '1'); setDismissed(true) }
  function handleRestore() { localStorage.removeItem(GUIDE_KEY); setDismissed(false) }

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

  const actions = !dismissed && (
    <Button variant="ghost" size="sm" onClick={handleDismiss}>Ẩn hướng dẫn</Button>
  )

  return (
    <PageShell
      title="Tổng quan"
      subtitle="Hệ thống đối soát giao dịch NAPAS"
      actions={actions}
    >
      {!dismissed && <GuideBanner onDismiss={handleDismiss} navigate={navigate} />}

      {dismissed && (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="subtle" size="sm" onClick={handleRestore}>📋 Xem lại hướng dẫn</Button>
        </div>
      )}

      {/* KPI section */}
      {loading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: C.textMuted, fontSize: font.sm }}>Đang tải dữ liệu...</div>
      ) : rows.length === 0 ? (
        <div style={{
          background: C.card, border: `1px solid ${C.cardBorder}`,
          borderRadius: radius.lg, padding: '32px 24px',
          textAlign: 'center', boxShadow: shadow.sm,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
          <div style={{ fontWeight: 700, fontSize: font.lg, color: C.text, marginBottom: 8 }}>Chưa có dữ liệu</div>
          <div style={{ fontSize: font.base, color: C.textMuted, marginBottom: 16 }}>
            Tải lên file để bắt đầu đối soát
          </div>
          <Button variant="primary" onClick={() => navigate('/data-input')}>Đến trang Tải lên</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* KPI cards — Đi */}
          <div>
            <div style={{ fontSize: font.sm, fontWeight: 700, color: C.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Giao dịch Đi
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <KpiCard label="Tổng GD Đi" value={totalDi.toLocaleString('vi-VN')}
                color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" />
              <KpiCard label="Tỉ lệ khớp" value={`${matchRateDi}%`}
                sub={`${matchedDi.toLocaleString('vi-VN')} / ${totalDi.toLocaleString('vi-VN')} giao dịch`}
                color="#059669" bg="#f0fdf4" border="#bbf7d0" />
              <KpiCard label="Cần xử lý" value={needDi.toLocaleString('vi-VN')}
                sub="Chưa giải quyết"
                color={needDi > 0 ? '#dc2626' : '#059669'}
                bg={needDi > 0 ? '#fef2f2' : '#f0fdf4'}
                border={needDi > 0 ? '#fecaca' : '#bbf7d0'} />
            </div>
          </div>

          {/* KPI cards — Đến */}
          <div>
            <div style={{ fontSize: font.sm, fontWeight: 700, color: C.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Giao dịch Đến
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <KpiCard label="Tổng GD Đến" value={totalDen.toLocaleString('vi-VN')}
                color="#7c3aed" bg="#f5f3ff" border="#ddd6fe" />
              <KpiCard label="Tỉ lệ khớp" value={`${matchRateDen}%`}
                sub={`${matchedDen.toLocaleString('vi-VN')} / ${totalDen.toLocaleString('vi-VN')} giao dịch`}
                color="#059669" bg="#f0fdf4" border="#bbf7d0" />
              <KpiCard label="Cần xử lý" value={needDen.toLocaleString('vi-VN')}
                sub="Chưa giải quyết"
                color={needDen > 0 ? '#dc2626' : '#059669'}
                bg={needDen > 0 ? '#fef2f2' : '#f0fdf4'}
                border={needDen > 0 ? '#fecaca' : '#bbf7d0'} />
            </div>
          </div>

          {/* Quick links */}
          <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.cardBorder}`, background: C.neutralBg }}>
              <span style={{ fontSize: font.sm, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Trang đối soát</span>
            </div>
            <QuickLink label="Swift – Core GL" desc="Đối soát giao dịch Swift với sổ cái Core Banking" route="/swift-core" color="#1e40af" bg="#eff6ff" border="#bfdbfe" navigate={navigate} />
            <QuickLink label="NAPAS – Core GL" desc="Đối soát giao dịch NAPAS với sổ cái Core Banking" route="/napas-core" color="#92400e" bg="#fefce8" border="#fde68a" navigate={navigate} />
            <QuickLink label="Core GL Tổng hợp" desc="Core làm gốc — đối chiếu đồng thời Swift và NAPAS" route="/core-summary" color="#166534" bg="#dcfce7" border="#bbf7d0" navigate={navigate} />
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="subtle" size="sm" onClick={() => navigate('/master')}>Bảng tổng hợp 3 nguồn →</Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
