import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../../components/PageShell'
import Button from '../../components/Button'
import { C, radius, shadow, font } from '../../theme'

const GUIDE_KEY = 'vcbneo_guide_dismissed'

// ── Step colours ─────────────────────────────────────────────────────────────
const STEP_COLORS = {
  1: { bg: '#eff6ff', border: '#bfdbfe', num: C.primary },
  2: { bg: '#f0fdf4', border: '#bbf7d0', num: '#059669' },
  3: { bg: '#fafafa', border: '#e5e7eb', num: C.textMuted },
}

// ── Sub-components ────────────────────────────────────────────────────────────
function InfoBanner({ children }) {
  return (
    <div style={{
      background: C.primaryLight,
      border: `1px solid ${C.primaryBorder}`,
      borderRadius: radius.md,
      padding: '12px 16px',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      fontSize: font.base,
      color: C.primary,
      lineHeight: 1.55,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>ℹ</span>
      <span>{children}</span>
    </div>
  )
}

function StepNumber({ n }) {
  const col = STEP_COLORS[n]
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: col.num, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: font.md, flexShrink: 0,
    }}>
      {n}
    </div>
  )
}

function StepCard({ step, title, children }) {
  const col = STEP_COLORS[step]
  return (
    <div style={{
      background: col.bg,
      border: `1px solid ${col.border}`,
      borderRadius: radius.lg,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <StepNumber n={step} />
        <span style={{ fontWeight: 700, fontSize: font.lg, color: C.text }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

function ResultPageRow({ label, description, route, navigate }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, padding: '10px 0',
      borderBottom: `1px solid ${C.neutralBorder}`,
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: font.base, color: C.text }}>{label}</div>
        <div style={{ fontSize: font.sm, color: C.textMuted, marginTop: 2 }}>{description}</div>
      </div>
      <Button variant="ghost" size="sm" onClick={() => navigate(route)}>
        Xem
      </Button>
    </div>
  )
}

// ── File type pill list ───────────────────────────────────────────────────────
const FILE_TYPES = [
  'Swift Đi',
  'Swift Đến',
  'Core Banking',
  'NAPAS Đi',
  'NAPAS Đến',
  'NAPAS Đi KTC',
]

function FileTypePills() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {FILE_TYPES.map((name) => (
        <span key={name} style={{
          background: '#fff',
          border: `1px solid ${C.primaryBorder}`,
          color: C.primary,
          borderRadius: radius.sm,
          padding: '3px 10px',
          fontSize: font.sm,
          fontWeight: 500,
        }}>
          {name}
        </span>
      ))}
    </div>
  )
}

// ── Collapsed summary (after dismiss) ────────────────────────────────────────
function DismissedSummary({ onRestore, navigate }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.cardBorder}`,
      borderRadius: radius.lg,
      padding: '20px 24px',
      boxShadow: shadow.sm,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: font.md, color: C.text }}>
          Quy trình đối soát nhanh
        </div>
        <div style={{ fontSize: font.sm, color: C.textMuted, marginTop: 4 }}>
          Tải file → Chạy đối soát → Xem kết quả trên 3 trang báo cáo
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="subtle" size="sm" onClick={onRestore}>
          Xem lại hướng dẫn
        </Button>
        <Button variant="primary" size="sm" onClick={() => navigate('/data-input')}>
          Đến trang Tải lên
        </Button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(GUIDE_KEY) === '1'
  )

  function handleDismiss() {
    localStorage.setItem(GUIDE_KEY, '1')
    setDismissed(true)
  }

  function handleRestore() {
    localStorage.removeItem(GUIDE_KEY)
    setDismissed(false)
  }

  const actions = dismissed ? null : (
    <Button variant="ghost" size="sm" onClick={handleDismiss}>
      Bỏ qua, vào hệ thống
    </Button>
  )

  return (
    <PageShell
      title="Tổng quan"
      subtitle="Hệ thống đối soát giao dịch NAPAS"
      actions={actions}
    >
      {dismissed ? (
        <DismissedSummary onRestore={handleRestore} navigate={navigate} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 780 }}>

          {/* Welcome heading */}
          <div style={{
            background: C.card,
            border: `1px solid ${C.cardBorder}`,
            borderRadius: radius.lg,
            padding: '24px 28px',
            boxShadow: shadow.sm,
          }}>
            <h2 style={{ margin: '0 0 6px', fontSize: font.xl, fontWeight: 700, color: C.text }}>
              Chào mừng đến VCBNeo — Hệ thống Đối soát NAPAS
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: font.base, color: C.textMuted, lineHeight: 1.6 }}>
              Làm theo 2 bước đơn giản dưới đây để hoàn thành đối soát hàng ngày.
            </p>
            <InfoBanner>
              Cấu hình file và quy tắc đối soát đã được thiết lập sẵn. Bạn có thể tùy chỉnh
              trong phần <strong>Cấu hình</strong>, nhưng hãy tập trung vào quy trình đối soát
              với cài đặt mặc định trước.
            </InfoBanner>
          </div>

          {/* Step 1 */}
          <StepCard step={1} title="Tải lên dữ liệu">
            <p style={{ margin: 0, fontSize: font.base, color: C.neutral, lineHeight: 1.6 }}>
              Tải lên đủ <strong>6 loại file</strong> nhận từ các hệ thống Swift, Core Banking
              và NAPAS trong ngày cần đối soát.
            </p>
            <FileTypePills />
            <div>
              <Button variant="primary" onClick={() => navigate('/data-input')}>
                Đến trang Tải lên
              </Button>
            </div>
          </StepCard>

          {/* Step 2 */}
          <StepCard step={2} title="Xem kết quả đối soát">
            <p style={{ margin: 0, fontSize: font.base, color: C.neutral, lineHeight: 1.6 }}>
              Sau khi tải file, xem kết quả chi tiết trên 3 trang báo cáo bên dưới.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <ResultPageRow
                label="Swift – Core GL"
                description="Đối soát giao dịch Swift với sổ cái Core Banking"
                route="/swift-core"
                navigate={navigate}
              />
              <ResultPageRow
                label="NAPAS – Core GL"
                description="Đối soát giao dịch NAPAS với sổ cái Core Banking"
                route="/napas-core"
                navigate={navigate}
              />
              <div style={{ padding: '10px 0' }}>
                <ResultPageRow
                  label="Core GL Tổng hợp"
                  description="Tổng hợp toàn bộ giao dịch Core Banking theo ngày"
                  route="/core-summary"
                  navigate={navigate}
                />
              </div>
            </div>
          </StepCard>

          {/* Step 3 — optional, smaller */}
          <StepCard step={3} title="Báo cáo tổng hợp (tuỳ chọn)">
            <p style={{ margin: 0, fontSize: font.sm, color: C.textMuted, lineHeight: 1.6 }}>
              Nếu cần báo cáo tổng hợp từ cả 3 nguồn Swift, NAPAS và Core, vào trang{' '}
              <strong>Bảng tổng hợp</strong> để xem và xuất file.
            </p>
            <div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/master')}>
                Đến Bảng tổng hợp
              </Button>
            </div>
          </StepCard>

        </div>
      )}
    </PageShell>
  )
}
