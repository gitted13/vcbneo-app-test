# Agent working notes — VCBNeo

> Running dev log for AI agents working on this repo, distinct from `docs/handover.md`
> (that one is the business/domain handover doc to the receiving team — still accurate,
> don't overwrite it). This file tracks *engineering session* progress: what got fixed,
> what's pending, what's known-broken but untouched. Keep entries dated and append —
> don't delete prior entries unless they're fully superseded.

**Repo:** `vcbneo-app` · **Branch:** `main` · **Remote:** `origin` (`gitted13/vcbneo-app-test`)
**Deploy:** Ubuntu server via `bash deploy.sh` (git pull → `docker compose build --pull` → `docker compose up -d`). Local dev is Windows, separate MSSQL instance (`DESKTOP-HD3AQVG\Test_JSONTypeDB`) from the deployed server's containerized SQL Server — don't assume data parity between the two, but schema is identical (both seeded from `backend/app/db/seed.py`).

---

## 2026-07-15 session — data wipe, upload sync, compare-rule config, date display

### Context
User asked for 5 things: (1) a way to wipe uploaded data from the frontend, (2) make sure the upload screen reflects FileTypeSettings config correctly, (3) fix the compare-rule ("Cấu hình đối chiếu" / JoinLogic page) settings screen which appeared to load wrong data, (4) find the missing "create new rule" button, (5) generalize the NAPAS hour-display hack into a proper date/time display rule.

### Done and pushed (commit `6f7a621`)

1. **Purge endpoint bug** — `backend/app/modules/flex/router.py`, `DELETE /flex/purge?type_id=`. The scoped branch queried `uploadedFileRows WHERE file_id IN (...)` but the real column is `upload_file_id` (see `uploadedFileRows` schema in `seed.py:332-340`) — scoped purge threw a SQL error; only whole-DB purge worked. Fixed the column name.
2. **Wipe-data UI** (new), Admin-role gated (`user.role === 'Admin'`, see `AuthContext.jsx`):
   - `frontend/src/pages/DataInput/index.jsx` — 🗑 icon on each upload card (Tải lên thủ công tab) → `api.flex.purge(typeId)`, scoped to that file type.
   - Same file, History tab (Lịch sử tải lên) — "Xóa toàn bộ dữ liệu" button (calls `api.flex.purge()`, no `type_id`, wipes everything) + a 🗑 per row (soft-delete via `DELETE /flex/files/{id}`, previously defined on the backend but never wired to any UI or exposed in `api/client.js`).
   - **Confirmed via code trace**: the destructive call only fires inside the confirm-dialog's "Xác nhận" click (`ConfirmDialog.jsx`, mounted globally in `App.jsx`) — the initial button click only opens the dialog. If a user says "I clicked and nothing seemed to happen but data was gone", they clicked through the dialog + missed the toast; it's not silently deleting on first click. **Open item**: user was open to hardening the *global* wipe with a type-to-confirm step (e.g. type "XÓA") given how easy it is to blow through the current one-click confirm — not yet implemented, no explicit go-ahead given either.
3. **DataInput ↔ FileTypeSettings sync** — investigated thoroughly, was already correct (fresh fetch every mount, no stale cache, no hardcoded columns). Real gaps closed: `allowed_values` configured per column now displays on the upload card; added a "Làm mới cấu hình" refresh button so a schema edit in another tab/session doesn't require a full page reload to show up.
4. **JoinLogic (Cấu hình đối chiếu) stale-form bug** — `frontend/src/pages/JoinLogic/index.jsx`, `LogicFormModal`. Root cause: `useState(() => { if (open) setForm(editing ?? blank) })` — a `useState` lazy initializer only runs on first mount, so editing any rule after the first always showed stale data from whatever was edited first. Fixed to `useEffect(..., [open, editing])`.
5. **JoinLogic delete always reported failure** — backend `DELETE /join-configs/{id}` returns `204 No Content`; the shared `request()` helper in `frontend/src/api/client.js` unconditionally called `.json()`, which throws on an empty body. Delete actually succeeded but the UI always showed the error toast and never removed the row locally. Fixed `request()` to short-circuit on `res.status === 204`.
6. **"+ Tạo rule mới" button** — exists (`JoinLogic/index.jsx:139`), gated to Admin role. **Not a bug** — user confirmed keep Admin-only. If it's not visible, the logged-in user isn't Admin (mock login: `admin`/`admin123`, `operator`/`op123`, `viewer`/`view123`, see `AuthContext.jsx`).
7. **Date/time display generalization** — `frontend/src/pages/DataStorage/index.jsx` ("Kho dữ liệu" raw-data view). Pulled real stored values from the DB across all 6 file types to design this instead of guessing:

   | Field | Schema says | Real value | Was displaying |
   |---|---|---|---|
   | swift_di.hostdate | date | `"20260203"` | ✅ correct |
   | swift_di.pctime | date | `"111106"` (HHMMSS) | ❌ raw |
   | swift_den.host_date | date | `"2026-02-03"` | ❌ raw |
   | swift_den.pctime | date | `"000358"` (HHMMSS) | ❌ raw |
   | swift_den.thời_gian | datetime | `"2026-02-03 00:03:28"` | ❌ raw |
   | core_banking.ngày_giao_dịch | date | `"20260203"` | ✅ correct |
   | napas_*.ngày_gd | date | `"0203"` (MMDD, no year) | ❌ raw — the "0629" case user reported |
   | napas_*.giờ_gd | integer | `215932` (HHMMSS) | ✅ already had a one-off hack |

   Per explicit user direction ("keep the NAPAS hour rule as-is, only 1-2 rules needed for date, check consistency across tables" — declined the bigger option of adding a formal `time` data type / structured per-column format field): extended the existing `isTimeField` field-name allowlist from `['giờ_gd']` to `['giờ_gd', 'pctime']`, and reordered `CellValue()` to check `isTimeField` before `isDateType` (pctime is schema'd `date` so `isDateType` was winning the dispatch and never letting the time check run). Rewrote `formatDate()`/added `parseFlexDate()` to handle every format actually seen above, replacing the old 8-digit-only regex; `toISO()` (date-range filter) now shares the same parser instead of its own separate hardcoded-year logic, so filtering and display can no longer disagree on what date a raw value represents. Verified with a standalone Node run reproducing every real sample above — all correct, including `formatDate('0629') → '29/06/2026'`.
   Also fixed a real latent bug found along the way: the date-range-filter's `dateCol` picker (`allCols.find(c => c.data_type === 'date' ...)`) would pick whichever date-typed column appears first in schema order — for `swift_di` that's `pctime` (a time value), not `hostdate`. Now excludes time-fields from that pick.

### Done, NOT yet committed (working tree only)

8. **JoinLogic match-field inputs were free text** — user flagged this from a screenshot: the "Sửa rule so khớp" modal let you type any string into the left/right match-field boxes, no dropdown of real column names, no visibility into data type. Fixed in `frontend/src/pages/JoinLogic/index.jsx`:
   - Added `SOURCE_DIRECTION_TYPE_CODE` (mirrors backend `_SOURCE_TYPE_CODE` in `engine_flex.py:20-28` exactly — must stay in sync if that mapping ever changes) and `fieldsForSource(types, source, direction)` to resolve the actual `fields_schema.columns` for whichever (source, direction) pair is selected.
   - `LogicFormModal` now fetches `types` (passed down from the parent, which calls `api.flex.getTypes('reconcile')` alongside its existing join-configs fetch) and renders `<Select>` dropdowns populated with real `field_name`s + `(data_type)` for both sides, with a warning line if the two selected fields have mismatched data types (still allowed to save — comparison is string-based — just surfaced).
   - Known gap, handled gracefully not silently: Swift/NAPAS + direction "Cả hai" has no single schema (Đi/Đến are separate tables with different columns for those two sources — only Core has one table for both directions). That combo falls back to the old free-text input with an explicit on-screen warning instead of silently offering an empty/wrong dropdown.
   - Build-verified (`npx vite build`), and cross-checked that all *existing* seeded join configs' match fields (e.g. `trace_number`/`số_trace`, `seq`/`sequence`, `số_tiền_ghi_có`/`số_tiền`) do exist in their respective schemas so they'll show up correctly pre-selected, not blank.

9. **Real, currently-live classification bug in engine_flex.py** — found while double-checking the DateRules ("Phân loại trạng thái đối soát") page per user request, NOT something already suspected going in. `backend/app/db/seed.py`'s `_STATUS_RULES` (used to seed `reconcileStatusRules` the very first time the table is empty) writes field names **without** Vietnamese diacritics — `"Ngay GD"`, `"Ngay GN"` — while `engine_flex.py`'s `_FIELD_ALIASES` dict and its date-field membership check both keyed on the **accented** form, `"Ngày GD"` / `"Ngày GN"`. Confirmed live against the actual deployed DB's `reconcileStatusRules` row (still has the ASCII seed values) and real `uploadedFileRows` data: every "same day" classification chip (`{"f":"Ngay GD","op":"=","v":"Ngay GN"}`) was **silently always evaluating False**, and the "different day" chip was always True — meaning Swift transactions that genuinely matched Core same-day were being bucketed into "lệch ngày" (day-mismatch) statuses instead of the correct same-day match status, for every SWIFT_DI/SWIFT_DEN row currently classified.
   Also found the same class of bug would trigger for status **values**, not just field names: DateRules' own UI suggests accented text (`'Thành công'`) in its dropdown (`DateRules/index.jsx:67`), but real `phản_hồi` data is unaccented (`'THANH CONG'`) — so using the page exactly as designed would silently break a rule.
   Fixed in `engine_flex.py`: added `_norm()` (NFD-decompose + strip combining marks + lowercase), `_FIELD_ALIASES_NORM` / `_DATE_FIELDS_NORM` derived from it, and `_resolve_field()` / `_eval_chip()` now fall back to normalized comparison for both field-name resolution and status-value string comparison. No DB migration needed — normalization happens at read time, so it transparently fixes both the already-seeded (ASCII) DB rows and any future accented ones from the UI. Verified with a standalone script reproducing the exact live DB rule + a real row: same-day case now correctly returns `True`/`True`/`True` across all 3 chips (was `False` for the day-match chip before), different-day case correctly returns `False` for that chip. Compile-checked (`py_compile`).
   **This changes actual reconciliation output.** Re-running reconcile after this deploys will likely reclassify some historically-misclassified rows from "lệch ngày" to same-day "khớp" — `reconcileResults` rows created before this fix don't get auto-flagged `is_stale` (that only happens on schema/config changes, not engine logic changes), so already-computed results won't self-correct; they'd need a manual re-run to pick up the fix.

### Currently open / not yet resolved (what the user said they want to work on)

- **Commit + push items 8 and 9 above** — asked the user "want me to commit and push?" after finding the diacritics bug; no answer yet before they asked for this handoff. Working tree currently has `backend/app/modules/reconciliation/engine_flex.py` and `frontend/src/pages/JoinLogic/index.jsx` modified but uncommitted. Check with the user before committing/pushing if picking this up.
- **Global wipe button hardening** — offered to add a type-to-confirm (e.g. type "XÓA") step specifically to the "Xóa toàn bộ dữ liệu" button given how destructive/irreversible it is; not actioned, no decision from user yet.
- **`example/Core.xlsx` and `example/Swift report đi.xlsx`** — showing modified in `git status` since before this session started; not touched by any agent work so far. Investigate what changed and whether it's intentional (sample data update?) before doing anything with them — don't assume they're safe to discard or commit blindly.
- **Deploy cadence reminder**: the user is running this on a separate Ubuntu server via `bash deploy.sh`, NOT auto-deployed. Every commit pushed to `origin/main` needs that script run on the server before it's live — confusion already happened once this session (user saw old UI, thought a feature was missing, it just hadn't been deployed yet).
- Consider re-running reconciliation for affected historical dates once the diacritics fix (item 9) is deployed, per the note above — not yet discussed with the user, flagging as a likely next ask.
