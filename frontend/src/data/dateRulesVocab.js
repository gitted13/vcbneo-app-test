/* ── Human-readable vocabulary for DateRules condition chips ─────────────────
 * Translates the abstract f/op/v codes the backend engine understands
 * (see backend/app/modules/reconciliation/engine_flex.py: _eval_chip,
 * _FIELD_ALIASES, _DATE_FIELDS_NORM) into Vietnamese sentences an operator
 * can read without knowing the internal field names. Keep in sync with
 * engine_flex.py's _FIELD_ALIASES keys — every key here must exist there too,
 * or a condition an admin builds in the UI will silently never match.
 */

export const FIELD_LABELS = {
  'TT Swift':      'Trạng thái phản hồi Swift',
  'TC/KTC':        'Trạng thái NAPAS (Thành công / Không thành công)',
  'Ngày GD':       'Ngày giao dịch (Swift)',
  'Ngày GN':       'Ngày Core ghi nhận (Swift)',
  'Ngày NAPAS':    'Ngày giao dịch (NAPAS)',
  'Ngày Core':     'Ngày Core ghi nhận',
  'Ngày Swift':    'Ngày Swift ghi nhận',
  'Swift':         'Dữ liệu Swift',
  'NAPAS':         'Dữ liệu NAPAS',
  'Core':          'Dữ liệu Core',
  'Swift & NAPAS': 'Dữ liệu Swift và NAPAS',
}

export const DATE_FIELDS = ['Ngày GD', 'Ngày GN', 'Ngày NAPAS', 'Ngày Core', 'Ngày Swift']
export const PRESENCE_FIELDS = ['Swift', 'NAPAS', 'Core', 'Swift & NAPAS']
export const STATUS_FIELDS = ['TT Swift', 'TC/KTC']

// Known values per status-type field, with human labels — shown as a
// dropdown so users pick from what the engine actually recognizes instead
// of typing free text that might not match real data.
export const STATUS_VALUE_OPTIONS = {
  'TT Swift': [
    { value: 'Thành công', label: 'Thành công' },
    { value: 'Timeout',    label: 'Timeout (hết thời gian chờ)' },
    { value: 'Thất bại',   label: 'Thất bại' },
  ],
  'TC/KTC': [
    { value: 'TC',  label: 'Thành công (TC)' },
    { value: 'KTC', label: 'Không thành công (KTC)' },
  ],
}

// Which other field a date field is most commonly compared against —
// just a sensible default for a new condition, not a restriction.
export const DATE_FIELD_DEFAULT_COMPARE = {
  'Ngày GD': 'Ngày GN', 'Ngày GN': 'Ngày GD',
  'Ngày NAPAS': 'Ngày Core', 'Ngày Core': 'Ngày NAPAS',
  'Ngày Swift': 'Ngày Core',
}

export function fieldKind(field) {
  if (PRESENCE_FIELDS.includes(field)) return 'presence'
  if (DATE_FIELDS.includes(field)) return 'date'
  return 'status'
}

export function fieldLabel(field) {
  return FIELD_LABELS[field] || field
}

function valueLabel(field, value) {
  if (DATE_FIELDS.includes(value)) return fieldLabel(value)
  const known = STATUS_VALUE_OPTIONS[field]?.find(o => o.value === value)
  return known ? known.label : value
}

const DATE_OP_WORDS = { '=': 'bằng', 'ne': 'khác', '≠': 'khác', '<': 'trước', '>': 'sau' }
const STATUS_OP_WORDS = { '=': 'là', 'ne': 'khác', '≠': 'khác' }

/** Human sentence for one condition chip, e.g. "Trạng thái phản hồi Swift là Thành công". */
export function describeChip(chip) {
  const { f, op, v } = chip
  const kind = fieldKind(f)
  if (kind === 'presence' || v === 'null') {
    const has = op === '=' ? false : true
    return `${fieldLabel(f)}: ${has ? 'Có tương ứng' : 'Không có tương ứng'}`
  }
  if (kind === 'date') {
    return `${fieldLabel(f)} ${DATE_OP_WORDS[op] || op} ${valueLabel(f, v)}`
  }
  return `${fieldLabel(f)} ${STATUS_OP_WORDS[op] || op} ${valueLabel(f, v)}`
}

/** Human sentence for one AND-group, e.g. "A và B và C". */
export function describeGroup(group) {
  if (!group || group.length === 0) return '(trống)'
  return group.map(describeChip).join(' VÀ ')
}

/** Human sentence for a full rule (groups OR'd together). */
export function describeRule(groups) {
  if (!groups || groups.length === 0) return 'Chưa có điều kiện'
  return groups.map(describeGroup).join('  HOẶC  ')
}

export const FIELD_OPTIONS = [...STATUS_FIELDS, ...DATE_FIELDS, ...PRESENCE_FIELDS]
