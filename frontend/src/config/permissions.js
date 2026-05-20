export const ROLES = {
  ADMIN:    'Admin',
  OPERATOR: 'Operator',
  VIEWER:   'Viewer',
}

export const ALL_ROLES = [ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER]

/*
 * MODULE_DEFS – source of truth for all frontend modules.
 *
 * group    : navigation section label
 * key      : unique identifier (matches route segment)
 * route    : React Router path
 * label    : nav & page display name
 * description : shown in admin docs / permission auditing
 * roles    : which roles can access this module
 * homeFor  : role lands here after login (first match wins)
 *
 * Permission matrix:
 * ┌──────────────────────┬──────────┬──────────┬────────┐
 * │ Module               │ Admin    │ Operator │ Viewer │
 * ├──────────────────────┼──────────┼──────────┼────────┤
 * │ Cấu hình file        │ R/W      │ –        │ –      │
 * │ Tải lên dữ liệu      │ R/W      │ R/W      │ –      │
 * │ Kho dữ liệu          │ R        │ R        │ R      │
 * │ Quy tắc so khớp      │ R/W/Run  │ Run      │ –      │
 * │ Đối soát             │ R/W      │ R/W      │ R      │
 * │ Báo cáo              │ R        │ R        │ R      │
 * │ Cài đặt              │ R/W      │ –        │ –      │
 * └──────────────────────┴──────────┴──────────┴────────┘
 *
 * Notes:
 * - Operator can run so-khop logic but cannot create/edit/delete rules (enforced inside the page).
 * - Viewer sees Đối soát in read-only mode (canResolve = false).
 */
export const MODULE_DEFS = [
  {
    group: 'CẤU HÌNH',
    items: [
      {
        key:         'file-settings',
        route:       '/file-settings',
        label:       'Cấu hình file',
        description: 'Cấu hình dạng file tải lên: định dạng chấp nhận, cột bắt buộc, kiểu dữ liệu',
        roles:       [ROLES.ADMIN],
        homeFor:     [ROLES.ADMIN],
      },
    ],
  },
  {
    group: 'DỮ LIỆU',
    items: [
      {
        key:         'data-input',
        route:       '/data-input',
        label:       'Tải lên dữ liệu',
        description: 'Tải file thủ công, xem lịch sử nạp dữ liệu và kết quả trích xuất',
        roles:       [ROLES.ADMIN, ROLES.OPERATOR],
        homeFor:     [ROLES.OPERATOR],
      },
      {
        key:         'storage',
        route:       '/storage',
        label:       'Kho dữ liệu',
        description: 'Xem dữ liệu thô (3 bảng), kết quả so khớp theo cặp, và bảng master giao dịch',
        roles:       ALL_ROLES,
        homeFor:     [ROLES.VIEWER],
      },
    ],
  },
  {
    group: 'XỬ LÝ',
    items: [
      {
        key:         'join-logic',
        route:       '/join-logic',
        label:       'Quy tắc so khớp',
        description: 'Cấu hình logic so khớp giữa các cặp bảng dữ liệu thô (Admin: full CRUD; Operator: chỉ chạy)',
        roles:       [ROLES.ADMIN, ROLES.OPERATOR],
      },
      {
        key:         'reconcile',
        route:       '/reconcile',
        label:       'Đối soát',
        description: 'Xem kết quả đối soát và xử lý ngoại lệ (Viewer: chỉ xem)',
        roles:       ALL_ROLES,
      },
      {
        key:         'reports',
        route:       '/reports',
        label:       'Báo cáo',
        description: 'Báo cáo tổng hợp và biểu đồ trực quan theo kỳ đối soát',
        roles:       ALL_ROLES,
      },
    ],
  },
  {
    group: 'QUẢN TRỊ',
    items: [
      {
        key:         'settings',
        route:       '/settings',
        label:       'Cài đặt',
        description: 'Quản lý người dùng, kết nối RPA và cấu hình hệ thống',
        roles:       [ROLES.ADMIN],
      },
    ],
  },
]

/** Returns true if `role` can access the module identified by `moduleKey`. */
export function canAccess(role, moduleKey) {
  for (const group of MODULE_DEFS) {
    const item = group.items.find(i => i.key === moduleKey)
    if (item) return item.roles.includes(role)
  }
  return false
}

/** Returns the default landing route for `role` after login. */
export function homeRoute(role) {
  for (const group of MODULE_DEFS) {
    for (const item of group.items) {
      if (item.homeFor?.includes(role)) return item.route
    }
  }
  return '/storage'
}
