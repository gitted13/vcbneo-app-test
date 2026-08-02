// Shared dd/mm/yyyy date parsing/formatting for raw Flex row values.
// Originally built and verified in DataStorage — extracted here so every
// page displaying dates (Kho dữ liệu, Đối soát, ...) renders them the same
// way instead of leaking raw stored formats (YYYYMMDD, MMDD, ISO, etc.).
// Keep this in sync with backend/app/modules/flex/router.py's
// _parse_flex_date_iso() (date-range filter parsing) — same source shapes.

// Parses every raw date shape actually seen across the 6 file types into
// {y, mo, d, h?, mi?, se?}. NAPAS ships "Ngày GD" as MMDD/MDD with no year
// (e.g. "0203") — assumed to be the current year, same convention already
// used by the date-range filter.
export function parseFlexDate(val) {
  const s = String(val ?? '').trim()
  if (!s) return null
  let m
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)))
    return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], se: +m[6] }
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/)))
    return { y: +m[1], mo: +m[2], d: +m[3] }
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)))
    return { y: +m[1], mo: +m[2], d: +m[3] }
  if ((m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)))
    return { y: +m[3], mo: +m[2], d: +m[1] }
  if (/^\d{3,4}$/.test(s)) {
    const padded = s.padStart(4, '0')
    return { y: new Date().getFullYear(), mo: +padded.slice(0, 2), d: +padded.slice(2, 4) }
  }
  return null
}

export function formatDate(val) {
  const p = parseFlexDate(val)
  if (!p) return String(val ?? '')
  const dd = String(p.d).padStart(2, '0'), mm = String(p.mo).padStart(2, '0')
  let out = `${dd}/${mm}/${p.y}`
  if (p.h != null) out += ` ${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}:${String(p.se).padStart(2, '0')}`
  return out
}
