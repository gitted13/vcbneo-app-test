import { useState, useRef, useEffect } from 'react'
import PageShell from '../../components/PageShell'
import Button from '../../components/Button'
import { Input } from '../../components/Input'
import { useAuth } from '../../context/AuthContext'
import { C, radius, shadow } from '../../theme'

/* ── Role-based access configuration ──────────────────────────────────────── */
const ROLE_CONFIG = {
  Admin: {
    label: 'Quản trị viên',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
    scopes: [
      { label: 'Giao dịch',            detail: 'Đọc + ghi, xử lý ngoại lệ', ok: true },
      { label: 'Cấu hình hệ thống',    detail: 'Xem và sửa logic đối soát',  ok: true },
      { label: 'Quản lý người dùng',   detail: 'Tạo / sửa / xóa tài khoản', ok: true },
      { label: 'Xuất báo cáo',         detail: 'Tất cả mẫu báo cáo',         ok: true },
      { label: 'Nhật ký kiểm toán',    detail: 'Toàn bộ lịch sử hành động', ok: true },
    ],
    suggestedQueries: [
      'Hôm nay có bao nhiêu giao dịch cần xử lý?',
      'Liệt kê giao dịch Timeout chưa được xử lý.',
      'Tổng số tiền Swift Đi trong tháng 2/2026?',
      'Ai đã đăng nhập vào hệ thống trong 24 giờ qua?',
    ],
  },
  Operator: {
    label: 'Nhân viên vận hành',
    color: '#059669',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    scopes: [
      { label: 'Giao dịch',          detail: 'Đọc + xử lý ngoại lệ',     ok: true  },
      { label: 'Xuất báo cáo',       detail: 'Báo cáo đối soát',          ok: true  },
      { label: 'Cấu hình hệ thống',  detail: 'Không có quyền truy cập',   ok: false },
      { label: 'Quản lý người dùng', detail: 'Không có quyền truy cập',   ok: false },
      { label: 'Nhật ký kiểm toán',  detail: 'Chỉ xem log của bản thân',  ok: false },
    ],
    suggestedQueries: [
      'Giao dịch nào đang Timeout cần xử lý?',
      'Xuất danh sách GD lệch ngày tuần này.',
      'Trace 775780 trạng thái đối soát là gì?',
    ],
  },
  Viewer: {
    label: 'Người xem',
    color: '#6b7280',
    bg: '#f9fafb',
    border: '#e5e7eb',
    scopes: [
      { label: 'Giao dịch',          detail: 'Chỉ đọc, không sửa',       ok: true  },
      { label: 'Báo cáo',            detail: 'Chỉ xem, không xuất',       ok: true  },
      { label: 'Cấu hình',           detail: 'Không có quyền truy cập',   ok: false },
      { label: 'Quản lý người dùng', detail: 'Không có quyền truy cập',   ok: false },
      { label: 'Xử lý giao dịch',    detail: 'Không có quyền truy cập',   ok: false },
    ],
    suggestedQueries: [
      'Tổng quan đối soát ngày 03/02/2026?',
      'NAPAS Đi có bao nhiêu giao dịch thành công?',
    ],
  },
}

/* ── Simulated bot responses ───────────────────────────────────────────────── */
function buildBotResponse(msg, role) {
  const lower = msg.toLowerCase()

  if (role !== 'Admin') {
    if (lower.includes('cấu hình') || lower.includes('config'))
      return { text: 'Xin lỗi, tài khoản của bạn không có quyền truy cập thông tin cấu hình hệ thống. Vui lòng liên hệ quản trị viên.', blocked: true }
    if (lower.includes('người dùng') || lower.includes('user') || lower.includes('tài khoản'))
      return { text: 'Tài khoản của bạn không có quyền xem thông tin quản lý người dùng.', blocked: true }
  }
  if (role === 'Viewer') {
    if (lower.includes('xử lý') || lower.includes('xuất') || lower.includes('export'))
      return { text: 'Tài khoản Viewer chỉ có quyền đọc dữ liệu. Để thực hiện thao tác này vui lòng liên hệ Operator hoặc Admin.', blocked: true }
  }

  if (lower.includes('timeout'))
    return { text: 'Tìm thấy **2 giao dịch Timeout – Core ghi nhận** chưa xử lý:\n• Trace 776110 · 01/02/2026 · 100.000 ₫ · Core và NAPAS đã ghi nhận thành công\n• Trace 782624 · 03/02/2026 · 770.000 ₫ · Core và NAPAS đã ghi nhận thành công\n\nCả hai cần Operator review và xác nhận.' }

  if (lower.includes('tổng quan') || lower.includes('dashboard') || lower.includes('tóm tắt'))
    return { text: 'Tổng quan đối soát 01–03/02/2026:\n• **30 giao dịch** (15 Đi · 15 Đến)\n• **Khớp đúng ngày**: 18 giao dịch\n• **Khớp lệch ngày**: 4 giao dịch (NAPAS QT qua đêm)\n• **Cần xử lý**: 5 giao dịch\n• **Thất bại**: 1 giao dịch (Trace 784811)' }

  if (lower.includes('775780') || (lower.includes('trace') && lower.includes('775')))
    return { text: 'Giao dịch Trace **775780**:\n• Ngày: 01/02/2026 · Chiều: Đi · Số tiền: 10.000.000 ₫\n• Swift: Thành công · Core: Ghi có ngày T\n• NAPAS: Thành công · Loại GD · 10:45\n• **Kết quả: KHỚP** ✓' }

  if (lower.includes('napas') && (lower.includes('thành công') || lower.includes('tc')))
    return { text: 'NAPAS Đi (01–03/02/2026):\n• **Thành công – Core ngày T**: 10 giao dịch\n• **Thành công – Core ngày T-1** (QT): 3 giao dịch\n• **Không thành công**: 1 giao dịch (Trace 784811)\nTổng: 14 giao dịch.' }

  if (lower.includes('lệch ngày') || lower.includes('lech ngay') || lower.includes('t+1') || lower.includes('qua đêm'))
    return { text: 'Có **4 giao dịch lệch ngày** (NAPAS QT – qua đêm):\n• r004 · Trace 777753 · 01/02/2026 · 4.200.000 ₫\n• r009 · Trace 781471 · 02/02/2026 · 2.750.000 ₫\n• r016 · Trace 049517 · 01/02/2026 · 2.000.000 ₫\n• r019 · Trace 205269 · 01/02/2026 · 17.000.000 ₫\n\nTất cả đều tự động chấp nhận (Khớp lệch ngày).' }

  if (lower.includes('đăng nhập') || lower.includes('audit') || lower.includes('log'))
    return role === 'Admin'
      ? { text: 'Nhật ký đăng nhập 24 giờ qua:\n• admin · 20/05/2026 06:02 · Chrome/Windows\n• operator1 · 20/05/2026 07:15 · Chrome/Windows\n• viewer1 · 20/05/2026 08:30 · Edge/Windows\n\nTổng: 3 phiên đăng nhập.' }
      : { text: 'Tài khoản của bạn không có quyền xem nhật ký kiểm toán toàn hệ thống.', blocked: true }

  const defaults = {
    Admin:    'Tôi đã phân tích yêu cầu. Với quyền Admin, tôi có thể truy vấn toàn bộ giao dịch, cấu hình và nhật ký. Bạn muốn hỏi chi tiết gì hơn?',
    Operator: 'Tôi đã ghi nhận yêu cầu. Tôi có thể truy vấn dữ liệu giao dịch và kết quả đối soát trong phạm vi Operator. Bạn muốn tìm giao dịch cụ thể không?',
    Viewer:   'Tôi đã ghi nhận câu hỏi. Trong phạm vi quyền Viewer, tôi có thể cung cấp thông tin đọc từ dữ liệu giao dịch. Tôi không thể thực hiện thay đổi.',
  }
  return { text: defaults[role] ?? defaults.Viewer }
}

/* ── Message bubble ────────────────────────────────────────────────────────── */
function Bubble({ msg }) {
  const isUser = msg.from === 'user'
  const parts = msg.text.split('**')
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 14, alignItems: 'flex-start', gap: 8 }}>
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 2 }}>AI</div>
      )}
      <div style={{
        maxWidth: '74%', padding: '10px 14px', fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-line',
        borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
        background: isUser ? C.primary : (msg.blocked ? '#fff7ed' : C.neutralBg),
        color: isUser ? '#fff' : (msg.blocked ? '#c2410c' : C.text),
        border: msg.blocked ? '1px solid #fed7aa' : 'none',
      }}>
        {parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)}
      </div>
    </div>
  )
}

/* ── Thinking dots ─────────────────────────────────────────────────────────── */
function ThinkingDots() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 14, alignItems: 'flex-start', gap: 8 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>AI</div>
      <div style={{ padding: '12px 16px', borderRadius: '4px 14px 14px 14px', background: C.neutralBg, display: 'flex', gap: 5, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: C.textMuted, animation: 'vcbDot 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  )
}

/* ── Main component ────────────────────────────────────────────────────────── */
export default function Chatbot() {
  const { user } = useAuth()
  const role = user?.role ?? 'Viewer'
  const cfg  = ROLE_CONFIG[role] ?? ROLE_CONFIG.Viewer

  const [messages, setMessages] = useState([
    { id: 1, from: 'bot', text: `Xin chào **${user?.name ?? 'bạn'}**! Tôi là trợ lý AI của VCBNeo.\n\nTôi có thể giúp truy vấn dữ liệu đối soát, tìm giao dịch, và phân tích kết quả — trong phạm vi quyền **${cfg.label}** của tài khoản bạn.\n\nBạn muốn hỏi gì?` },
  ])
  const [input, setInput]     = useState('')
  const [thinking, setThink]  = useState(false)
  const bottomRef             = useRef()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])

  const send = async (text) => {
    if (!text.trim() || thinking) return
    setMessages(prev => [...prev, { id: Date.now(), from: 'user', text: text.trim() }])
    setInput('')
    setThink(true)
    await new Promise(r => setTimeout(r, 800 + Math.random() * 500))
    const resp = buildBotResponse(text, role)
    setMessages(prev => [...prev, { id: Date.now() + 1, from: 'bot', text: resp.text, blocked: resp.blocked }])
    setThink(false)
  }

  return (
    <PageShell
      title="Trợ lý AI"
      subtitle="Đặt câu hỏi về dữ liệu đối soát bằng ngôn ngữ tự nhiên · Phạm vi truy cập phụ thuộc vào vai trò người dùng"
    >
      <style>{`@keyframes vcbDot { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1.1)} }`}</style>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 272px', gap: 18, height: 'calc(100vh - 230px)', minHeight: 480 }}>

        {/* ── Chat panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>
            {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}
            {thinking && <ThinkingDots />}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.cardBorder}`, background: C.neutralBg, display: 'flex', gap: 10 }}>
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
              placeholder="Nhập câu hỏi về dữ liệu đối soát..."
              style={{ flex: 1 }}
              disabled={thinking}
            />
            <Button variant="primary" onClick={() => send(input)} disabled={!input.trim() || thinking}>Gửi</Button>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>

          {/* Access scope */}
          <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, padding: '16px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.7 }}>Quyền truy cập dữ liệu</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '5px 10px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {cfg.scopes.map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 12, color: s.ok ? '#059669' : '#dc2626', flexShrink: 0, marginTop: 1, fontWeight: 700 }}>{s.ok ? '✓' : '✕'}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: s.ok ? C.text : C.textMuted }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: C.textLight, lineHeight: 1.3 }}>{s.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Suggested queries */}
          <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, padding: '16px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.7 }}>Gợi ý câu hỏi</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cfg.suggestedQueries.map((q, i) => (
                <button
                  key={i}
                  onClick={() => send(q)}
                  disabled={thinking}
                  style={{
                    textAlign: 'left', padding: '8px 10px', borderRadius: 6,
                    border: `1px solid ${C.cardBorder}`, background: C.neutralBg,
                    cursor: thinking ? 'not-allowed' : 'pointer',
                    fontSize: 12, color: C.text, fontFamily: 'inherit',
                    lineHeight: 1.4, transition: 'background 0.12s',
                  }}
                >{q}</button>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{ padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: radius.md, fontSize: 11, color: '#92400e', lineHeight: 1.5 }}>
            Trợ lý đang chạy trong chế độ mô phỏng với dữ liệu mẫu. Trong môi trường thực tế, AI kết nối trực tiếp với Core GL và database ngân hàng.
          </div>
        </div>
      </div>
    </PageShell>
  )
}
