import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MODULE_DEFS, ROLES, homeRoute } from '../../config/permissions'
import { useAuth } from '../../context/AuthContext'
import './design-reference.css'

const ROLE_ORDER = [ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER]

const ROLE_NOTES = {
  [ROLES.ADMIN]: {
    title: 'Kiến trúc vận hành',
    summary: 'Admin cần nhìn toàn cảnh hệ thống, cấu hình được luồng xử lý và vẫn bám sát ngoại lệ đang mở.',
    bullets: [
      'Ưu tiên cấu hình file, logic, người dùng và health-check hệ thống.',
      'Vẫn cần thấy hàng chờ đối soát để nắm rủi ro trong ngày.',
      'UI nên thể hiện rõ thao tác nguy hiểm và audit trail.',
    ],
  },
  [ROLES.OPERATOR]: {
    title: 'Bàn điều hành trong ngày',
    summary: 'Operator là vai trò trung tâm của sản phẩm. Giao diện nên tối ưu cho upload, chạy so khớp và xử lý ngoại lệ.',
    bullets: [
      'Màn mở đầu nên đi thẳng vào dữ liệu đang chờ xử lý.',
      'Các CTA phải rõ: tải file, chạy logic, xác nhận ngoại lệ, xuất kết quả.',
      'Bảng dữ liệu phải luôn đi kèm bộ lọc, trạng thái và bối cảnh.',
    ],
  },
  [ROLES.VIEWER]: {
    title: 'Quan sát và kiểm tra',
    summary: 'Viewer không cần thao tác dày. Họ cần nhìn được bức tranh, tra cứu evidence và đọc đúng trạng thái xử lý.',
    bullets: [
      'Màn mặc định nên là kho dữ liệu hoặc báo cáo tổng hợp.',
      'Ẩn các CTA tạo, sửa, xóa để giao diện nhẹ hơn.',
      'Nên ưu tiên biểu đồ, snapshot và audit history hơn form cấu hình.',
    ],
  },
}

const MODULE_META = {
  'file-settings': {
    accent: '#175c58',
    soft: '#edf7f5',
    stage: 'Foundation',
    focus: 'Schema mapping + test file',
    verdict: 'Đúng module, nên có cảm giác control tower cho dữ liệu đầu vào.',
    preview: ['Cấu hình cột bắt buộc', 'Test file mẫu ngay trong màn'],
    icon: SchemaIcon,
  },
  'data-input': {
    accent: '#1d5f8b',
    soft: '#eef6fb',
    stage: 'Operations',
    focus: 'Upload queue + validation',
    verdict: 'Rất ổn cho MVP. Nên là nơi thao tác đầu tiên của Operator.',
    preview: ['Dropzone nhiều slot', 'Lịch sử lô tải lên'],
    icon: UploadIcon,
  },
  storage: {
    accent: '#27414a',
    soft: '#eef3f4',
    stage: 'Evidence Desk',
    focus: 'Raw / matched / master tabs',
    verdict: 'Cực quan trọng nhưng dễ nặng. Phải ưu tiên điều hướng và ngữ cảnh.',
    preview: ['Tóm tắt theo bảng', 'Chuyển tab không mất filter'],
    icon: EvidenceIcon,
  },
  'join-logic': {
    accent: '#9a6a2f',
    soft: '#faf4ea',
    stage: 'Rule Engine',
    focus: 'Rule composer + run history',
    verdict: 'Hợp lý cho Admin và Operator. Nên kỹ thuật hơn, ít trang trí hơn.',
    preview: ['Mapping field trực quan', 'Run log và sample result'],
    icon: LogicIcon,
  },
  reconcile: {
    accent: '#0f6c5b',
    soft: '#ebf8f4',
    stage: 'Frontline',
    focus: 'KPI + queue ngoại lệ + quyết định',
    verdict: 'Đây phải là module mạnh nhất toàn hệ thống.',
    preview: ['Snapshot đầu ngày', 'Decision trail cho từng ngoại lệ'],
    icon: ReconcileIcon,
  },
  reports: {
    accent: '#915f1c',
    soft: '#fbf3e7',
    stage: 'Executive',
    focus: 'Dashboard + export templates',
    verdict: 'Module đúng, nhưng nên tách lớp quản trị và lớp báo cáo điều hành.',
    preview: ['Snapshot cho lãnh đạo', 'Template xuất file cho vận hành'],
    icon: ReportIcon,
  },
  settings: {
    accent: '#5b6168',
    soft: '#f1f3f5',
    stage: 'Backoffice',
    focus: 'Users + connectors + system health',
    verdict: 'Cần cụ thể hóa phạm vi hơn để tránh cảm giác chung chung.',
    preview: ['Quản lý người dùng', 'Kết nối RPA và trạng thái hệ thống'],
    icon: SettingsIcon,
  },
}

const DESIGN_PRIORITIES = [
  {
    title: 'Đối soát là trung tâm',
    text: 'Màn này nên mở bằng KPI, phân loại ngoại lệ và hàng chờ hành động. Bảng đầy đủ chỉ nên đến sau khi người dùng đã có bối cảnh.',
  },
  {
    title: 'Kho dữ liệu là evidence desk',
    text: 'Đừng để nó thành một bảng rất dài. Tách raw, matched, master và giữ bộ lọc ổn định giữa các tab.',
  },
  {
    title: 'Báo cáo tách 2 lớp',
    text: 'Một lớp dành cho lãnh đạo xem snapshot. Một lớp dành cho vận hành quản lý mẫu xuất và đối chiếu file.',
  },
]

const WORKFLOW = [
  {
    title: '01. Intake',
    note: '06:00 - 08:30',
    text: 'Nhận file từ RPA hoặc tải thủ công, kiểm tra schema, chốt trạng thái từng lô.',
  },
  {
    title: '02. Match',
    note: '08:30 - 09:00',
    text: 'Chạy logic so khớp theo cặp, sinh bảng kết quả và cờ ngoại lệ ngay trong phiên làm việc.',
  },
  {
    title: '03. Reconcile',
    note: '09:00 - 11:30',
    text: 'Ưu tiên nhóm timeout, chỉ-Swift, chỉ-NAPAS và lưu lại quyết định xử lý có giải thích.',
  },
  {
    title: '04. Report',
    note: 'Cuối phiên',
    text: 'Đẩy snapshot điều hành, xuất file mẫu và lưu audit trail cho lần rà soát sau.',
  },
]

const ACTION_QUEUE = [
  {
    title: '31 giao dịch chờ xác nhận',
    label: 'Ngoại lệ đang mở',
    text: 'Nhóm Swift Đến vs NAPAS Đến nên được ưu tiên hiển thị đầu vì ảnh hưởng trực tiếp tới quyết toán trong ngày.',
  },
  {
    title: '3 logic chưa có run log gần nhất',
    label: 'Rủi ro cấu hình',
    text: 'Join Logic nên có block riêng cho trạng thái chạy gần nhất, tránh phải mở sâu vào từng rule để kiểm tra.',
  },
  {
    title: '2 mẫu báo cáo sẵn sàng xuất',
    label: 'Xuất file',
    text: 'Báo cáo không chỉ là biểu đồ. Phần template export nên giữ vai trò rõ và dễ truy cập cuối quy trình.',
  },
]

function buildModules() {
  return MODULE_DEFS.flatMap(group =>
    group.items.map(item => ({
      ...item,
      group: group.group,
      ...MODULE_META[item.key],
    })),
  )
}

export default function DesignReference() {
  const { user } = useAuth()
  const [activeRole, setActiveRole] = useState(user?.role ?? ROLES.ADMIN)

  const modules = buildModules()
  const activeModules = modules.filter(module => module.roles.includes(activeRole))
  const landingRoute = homeRoute(activeRole)
  const landingModule = modules.find(module => module.route === landingRoute)
  const roleNote = ROLE_NOTES[activeRole]
  const comparisonRoute = user ? homeRoute(user.role) : '/login'

  const heroMetrics = [
    {
      label: 'Module mở',
      value: String(activeModules.length).padStart(2, '0'),
      note: `trên tổng ${modules.length} module cho vai trò ${activeRole}`,
    },
    {
      label: 'Màn mở đầu',
      value: landingModule?.label ?? 'Kho dữ liệu',
      note: 'đi thẳng vào công việc đầu tiên trong ngày',
    },
    {
      label: 'Ưu tiên polish',
      value: 'Đối soát',
      note: 'sau đó tới Kho dữ liệu và Báo cáo',
    },
    {
      label: 'Tinh thần giao diện',
      value: 'Calm / Dense',
      note: 'summary trước, bảng và thao tác sau',
    },
  ]

  return (
    <div className="dr-page">
      <div className="dr-layout">
        <aside className="dr-sidebar">
          <div className="dr-brand">
            <div className="dr-brand-mark">
              <span />
              <span />
              <span />
            </div>
            <div>
              <div className="dr-brand-title">VCBNeo Reference</div>
              <div className="dr-brand-subtitle">Concept cho command center đối soát</div>
            </div>
          </div>

          <div className="dr-nav-shell">
            {MODULE_DEFS.map(group => (
              <section key={group.group} className="dr-nav-group">
                <div className="dr-nav-label">{group.group}</div>
                {group.items.map(item => {
                  const isOpen = item.roles.includes(activeRole)
                  const isHome = item.route === landingRoute
                  return (
                    <div
                      key={item.key}
                      className={`dr-nav-item ${isOpen ? 'is-open' : 'is-locked'} ${isHome ? 'is-home' : ''}`}
                    >
                      <span>{item.label}</span>
                      <small>{isHome ? 'Default' : isOpen ? 'Mở' : 'Ẩn'}</small>
                    </div>
                  )
                })}
              </section>
            ))}
          </div>

          <div className="dr-sidebar-card">
            <div className="dr-sidebar-card-title">Tại sao concept này?</div>
            <p>
              Tôi giữ tinh thần enterprise nhưng giảm cảm giác “demo card rời rạc”.
              Hướng này gom toàn bộ nhịp làm việc vào một shell nhất quán: tĩnh, sạch,
              nhiều ngữ cảnh và rõ quyền.
            </p>
          </div>
        </aside>

        <main className="dr-main">
          <header className="dr-topbar">
            <div>
              <div className="dr-eyebrow">Design Reference</div>
              <h1>Hướng giao diện nên đi theo</h1>
              <p className="dr-topbar-copy">
                Tập trung vào module, vai trò và nhịp vận hành hằng ngày thay vì chỉ xếp page theo chức năng.
              </p>
            </div>

            <div className="dr-topbar-actions">
              <div className="dr-role-switch" role="tablist" aria-label="Chọn vai trò tham chiếu">
                {ROLE_ORDER.map(role => (
                  <button
                    key={role}
                    type="button"
                    className={`dr-role-button ${activeRole === role ? 'is-active' : ''}`}
                    onClick={() => setActiveRole(role)}
                  >
                    {role}
                  </button>
                ))}
              </div>

              <Link className="dr-button dr-button--ghost" to="/login">
                Màn đăng nhập
              </Link>
              <Link className="dr-button" to={comparisonRoute}>
                So sánh với bản đang có
              </Link>
            </div>
          </header>

          <section className="dr-panel dr-hero">
            <div className="dr-hero-copy">
              <div className="dr-eyebrow">UI Direction</div>
              <h2>VCBNeo nên có cảm giác của một command center chuyên nghiệp.</h2>
              <p>
                Không cần làm quá “marketing”. Chỉ cần chắc, tĩnh, nhiều tín hiệu
                vận hành, ưu tiên ngoại lệ và thể hiện phân quyền bằng chính giao diện.
              </p>

              <div className="dr-tag-row">
                <span className="dr-tag">Enterprise first</span>
                <span className="dr-tag">Permission aware</span>
                <span className="dr-tag">Summary before table</span>
                <span className="dr-tag">Audit-friendly</span>
              </div>
            </div>

            <div className="dr-metric-grid">
              {heroMetrics.map(metric => (
                <div key={metric.label} className="dr-metric-card">
                  <div className="dr-metric-label">{metric.label}</div>
                  <div className="dr-metric-value">{metric.value}</div>
                  <div className="dr-metric-note">{metric.note}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="dr-content-grid">
            <div className="dr-panel">
              <div className="dr-section-head">
                <div>
                  <div className="dr-eyebrow">Modules</div>
                  <h2>Module hiện tại là đúng hướng</h2>
                </div>
                <p className="dr-section-note">
                  Về mặt sản phẩm, bạn không thiếu module. Phần cần nâng lên là độ hoàn chỉnh
                  của từng module và thứ bậc trải nghiệm giữa các màn.
                </p>
              </div>

              <div className="dr-module-grid">
                {modules.map(module => (
                  <ModuleCard
                    key={module.key}
                    activeRole={activeRole}
                    isLanding={module.route === landingRoute}
                    module={module}
                  />
                ))}
              </div>
            </div>

            <div className="dr-side-stack">
              <section className="dr-panel">
                <div className="dr-section-head dr-section-head--tight">
                  <div>
                    <div className="dr-eyebrow">Permissions</div>
                    <h2>Phân quyền hiện tại là ổn cho MVP</h2>
                  </div>
                </div>

                <div className={`dr-role-banner role-${activeRole.toLowerCase()}`}>
                  <div>
                    <div className="dr-role-banner-label">{roleNote.title}</div>
                    <div className="dr-role-banner-role">{activeRole}</div>
                    <p>{roleNote.summary}</p>
                  </div>
                  <div className="dr-role-banner-count">{activeModules.length}</div>
                </div>

                <div className="dr-role-points">
                  {roleNote.bullets.map(line => (
                    <div key={line} className="dr-role-point">
                      <span className="dr-role-point-dot" />
                      <span>{line}</span>
                    </div>
                  ))}
                </div>

                <div className="dr-matrix">
                  <div className="dr-matrix-row dr-matrix-row--head">
                    <span>Module</span>
                    {ROLE_ORDER.map(role => (
                      <span key={role}>{role.slice(0, 3)}</span>
                    ))}
                  </div>
                  {modules.map(module => (
                    <div key={module.key} className="dr-matrix-row">
                      <span>{module.label}</span>
                      {ROLE_ORDER.map(role => (
                        <span
                          key={`${module.key}-${role}`}
                          className={`dr-matrix-cell ${module.roles.includes(role) ? 'is-on' : 'is-off'} ${role === activeRole ? 'is-current' : ''}`}
                        >
                          {module.roles.includes(role) ? '•' : '–'}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </section>

              <section className="dr-panel">
                <div className="dr-section-head dr-section-head--tight">
                  <div>
                    <div className="dr-eyebrow">Priority</div>
                    <h2>Nên hoàn thiện theo thứ tự này</h2>
                  </div>
                </div>

                <div className="dr-priority-list">
                  {DESIGN_PRIORITIES.map(item => (
                    <div key={item.title} className="dr-priority-item">
                      <div className="dr-priority-title">{item.title}</div>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>

          <section className="dr-bottom-grid">
            <section className="dr-panel">
              <div className="dr-section-head dr-section-head--tight">
                <div>
                  <div className="dr-eyebrow">Daily Flow</div>
                  <h2>Luồng làm việc nên nhìn thấy ngay</h2>
                </div>
              </div>

              <div className="dr-stage-grid">
                {WORKFLOW.map(step => (
                  <div key={step.title} className="dr-stage-card">
                    <div className="dr-stage-note">{step.note}</div>
                    <div className="dr-stage-title">{step.title}</div>
                    <p>{step.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="dr-panel">
              <div className="dr-section-head dr-section-head--tight">
                <div>
                  <div className="dr-eyebrow">Signals</div>
                  <h2>Những khối nên có trên giao diện hoàn chỉnh</h2>
                </div>
              </div>

              <div className="dr-queue-list">
                {ACTION_QUEUE.map(item => (
                  <div key={item.title} className="dr-queue-item">
                    <div className="dr-queue-label">{item.label}</div>
                    <div className="dr-queue-title">{item.title}</div>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
            </section>
          </section>
        </main>
      </div>
    </div>
  )
}

function ModuleCard({ module, activeRole, isLanding }) {
  const Icon = module.icon
  const isOpen = module.roles.includes(activeRole)

  return (
    <article
      className={`dr-module-card ${isOpen ? 'is-open' : 'is-locked'} ${isLanding ? 'is-landing' : ''}`}
      style={{ '--dr-accent': module.accent, '--dr-soft': module.soft }}
    >
      <div className="dr-module-head">
        <div className="dr-module-icon">
          <Icon />
        </div>

        <div className="dr-module-head-copy">
          <div className="dr-module-group">{module.group}</div>
          <h3>{module.label}</h3>
        </div>

        <div className={`dr-module-badge ${isOpen ? 'is-open' : 'is-locked'}`}>
          {isLanding ? 'Landing' : isOpen ? 'Visible' : 'Hidden'}
        </div>
      </div>

      <div className="dr-module-stage">{module.stage}</div>
      <p className="dr-module-description">{module.description}</p>
      <p className="dr-module-verdict">{module.verdict}</p>

      <div className="dr-module-focus">
        <span>Tập trung giao diện</span>
        <strong>{module.focus}</strong>
      </div>

      <div className="dr-module-preview">
        {module.preview.map(line => (
          <div key={line} className="dr-module-preview-line">
            <span className="dr-module-preview-dot" />
            <span>{line}</span>
          </div>
        ))}
      </div>

      <div className="dr-role-chip-row">
        {ROLE_ORDER.map(role => (
          <span
            key={role}
            className={`dr-role-chip ${module.roles.includes(role) ? 'is-on' : 'is-off'} ${role === activeRole ? 'is-current' : ''}`}
          >
            {role}
          </span>
        ))}
      </div>
    </article>
  )
}

function SchemaIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4h12v5H6zM6 15h12v5H6zM12 9v6M8 12h8" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V4M8 8l4-4 4 4M4 18v2h16v-2" />
    </svg>
  )
}

function EvidenceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
    </svg>
  )
}

function LogicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6h4v4H7zM13 14h4v4h-4zM11 8h2a3 3 0 013 3v3" />
    </svg>
  )
}

function ReconcileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3zM9 12l2 2 4-4" />
    </svg>
  )
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 19V5M10 19V10M15 19V7M20 19V13" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8a4 4 0 100 8 4 4 0 000-8zm0-5v3m0 12v3M4.9 4.9l2.1 2.1m9.9 9.9 2.1 2.1M3 12h3m12 0h3M4.9 19.1 7 17m9.9-9.9 2.1-2.1" />
    </svg>
  )
}
