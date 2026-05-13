# 3MA-CRM — Chat Log

Context handoff for another coding agent picking up this work mid-stream.

- **Repo:** `Booman008/3MA-CRM`
- **Working branch:** `claude/agitated-dewdney-440175`
- **Worktree path (Windows):** `C:\Users\Henry\Desktop\AI Coding Projects\3MA-CRM\.claude\worktrees\agitated-dewdney-440175`
- **Deploy:** Render with `autoDeploy: true` from `main` (see `render.yaml`)
- **Stack:** React 18 client built with esbuild (`scripts/build-client.js`), Express 4 server, Postgres (pg), JWT auth, R2 for attachments
- **User:** Henry Crisler (henrycrisler@gmail.com) — Executive Director of the Mississippi Medical Marijuana Association (3MA)

---

## Session timeline

### 1. Feature request: sortable tables + CSV mass import

User requested:

1. **Sort features** — sort Members/Leads tables by Renewal Date, Owner, etc.
2. **Mass Import** — bulk-import licenses from a 369-row CSV (`3MA Member Mastersheet 2026 - 2026 Master Sheet.csv`) and route rows into Members vs Leads by the Status column (colors in the original sheet correspond to Status values: `Member`, `Not pursuing`, `Possible Member`, `Closed / NA`, `Cannot Afford / Not interested`, `FireCraft`, `In Pipeline`).

**Decisions taken (via AskUserQuestion):**

- Routing UI: "Let me pick per-status at import time" (3-step modal: pick file → review by Status with route dropdown → confirm).
- Sortable columns: "All of the above + Leads table too" (Business, Owner, County, Type, Tier, Dues, Renewal on Members; Business, Owner, License #, County, Stage, Priority, Next Contact on Leads).

**Implementation (PR #1, merged):**

- `client/src/format.js`: added `sortRecords(records, sortBy, sortDir)`, `nextSortDir(currentBy, currentDir, key)`, `parseCSV(text)` (state-machine quoted-field parser), `parseFlexibleDate(s)` (handles `m/d/yyyy`, `mm-dd-yyyy`, ISO).
- `client/src/pages/Members.jsx`: added sort state + click-to-sort `<SortTh>` headers, "Import CSV" button.
- `client/src/pages/Leads.jsx`: same sort treatment for the table view (Kanban unchanged).
- `client/src/components/ImportModal.jsx` (new): 3-step modal. Auto-maps CSV headers via aliases (`License No.`, `Business Name`, `Business Type`, `Status`, `County`, `Expiration`, `License Issue Date`, `Owner Name`, `Phone`, `Email`, `Physical Address`, `Mailing Address`, `DBA`, `Last Touch`). Dates normalize to ISO. License # stored in the existing multi-license JSON shape (`JSON.stringify([{number, type}])`). Physical/mailing/DBA collapse into Notes. Leads get `Source: <status>` prepended.
- `server/routes/members.js` + `server/routes/leads.js`: added `POST /bulk` endpoints.

---

### 2. Feature request: track non-pursuing licenses without cluttering pipeline

User concern: "Companies that are not interested in membership or 'Not Pursuing' aren't really Leads, but I still want them tracked for marketplace coverage math."

**Clarifying exchange:** "FireCraft" = a co-op/distribution company. Licenses tagged FireCraft are too small to sell their own products, so unlikely full members — but still treated as **active** leads. Other rejection statuses (Not Pursuing, Closed/NA, Cannot Afford) should be **archived**.

**Implementation (PR #2, merged):**

- `client/src/stages.js` (new) — single source of truth:
  - `ACTIVE_STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost', 'FireCraft']`
  - `ARCHIVED_STAGES = ['Not Pursuing', 'Closed/NA', 'Cannot Afford']`
  - `ALL_STAGES`, `STAGES` (alias), `isArchivedStage(stage)`, `stageColor`, `stageHeaderBg`.
- `client/src/pages/Leads.jsx`:
  - Imports stages from `../stages.js` (re-exports `STAGES`, `stageColor` for backward compat).
  - `showArchived` state + "Show archived (N)" checkbox in the toolbar.
  - Kanban only renders `visibleKanbanStages` (active by default, all when toggle on).
  - Filtered out archived rows from both kanban and table view unless toggle on OR `stageFilter` is explicitly an archived stage.
  - Stage filter dropdown uses `<optgroup>` "Active" / "Archived". Form stage dropdown and per-row table stage `<select>` likewise.
- `client/src/pages/Dashboard.jsx`:
  - New **Marketplace Coverage** card at top of dashboard: stacked bar (Members / Active pipeline / Archived) with percentages and per-archived-stage breakdown line.
  - "Lead Pipeline" panel scoped to active stages only.
- `client/src/components/ImportModal.jsx`:
  - 4 route options per status: `Import as Members` / `Import as Active Leads` / `Import as Archived` / `Skip`.
  - `stageForStatus(status)` maps source CSV status → archived stage name (e.g. "Not Pursuing" CSV value writes lead with `stage: "Not Pursuing"`).
  - Default routes: Member→Members, Possible Member/In Pipeline/FireCraft→Active Leads, Not Pursuing/Closed/Cannot Afford→Archived, others→Skip.

---

### 3. Bug: silent import failure

User tried to import the 369-row CSV — modal displayed "Import failed:" with **no message after the colon**.

**Diagnosis:** request body exceeded Express's default 100 KB JSON limit. Render's HTTP/2 strips `statusText`, leaving the client's `new Error(message)` empty.

**Fix (PR #3, currently open — see below):**

- `server/index.js`: `app.use(express.json({ limit: '10mb' }))`.
- `server/routes/members.js` + `server/routes/leads.js`: bulk endpoints now insert **row-by-row** (no transaction wrapping the whole batch). Each failure is collected with `{index, businessName, error: pgError.message}` and returned in response payload.
- `client/src/api.js`: read response body as text first, attempt JSON parse, fall back to status text, **always** append `(status N)` so error messages can never be blank again.
- `client/src/components/ImportModal.jsx`: "Done" screen shows a yellow failures panel listing up to 10 failed rows with the per-row reason.

**Status of PR #3:** Opened at https://github.com/Booman008/3MA-CRM/pull/3 — pending merge. Note: PRs #1 and #2 were already merged onto `main` by the user.

---

### 4. Feature request: implement the "3MA CRM Redesign" visual system

User pointed to local folder `C:\Users\Henry\Desktop\AI Coding Projects\3MA-CRM\3MA CRM Redesign\react-codebase\` containing drop-in replacement files for a navy/gold/red 3MA-brand visual system (Montserrat headings + Raleway body, gold-on-navy CTAs, gold-trimmed cards, navy sidebar with gold accent bar on active nav items).

**Files in the redesign folder:**

```
README.md
client/assets/logo-full.png
client/assets/logo-mark.png
client/index.html              ← brand palette + Google Fonts + repointed --green-* tokens
client/src/styles.js           ← same S.* API, brand values
client/src/App.jsx             ← sidebar with logo + Lucide-style SVG icons + Main/Admin sections
client/src/format.js           ← only renewalStatus (DROPS my sortRecords/parseCSV/etc helpers!)
client/src/pages/Login.jsx     ← navy gradient + gold-trim card
client/src/pages/Dashboard.jsx ← brand-colored, DROPS my Marketplace Coverage widget
client/src/pages/Leads.jsx     ← brand-colored, DROPS my sort/archive/import features
client/src/pages/Tasks.jsx
client/src/pages/ContactLog.jsx
client/src/pages/Revenue.jsx
client/src/components/SearchBar.jsx  ← styled to sit inside navy sidebar
scripts/build-client.js        ← copies client/assets/ into build/assets/
```

**The redesign README's drop-in mapping:**

| From (redesign) | To (repo) |
|---|---|
| `react-codebase/client/index.html` | `client/index.html` |
| `react-codebase/client/src/styles.js` | `client/src/styles.js` |
| `react-codebase/client/src/format.js` | `client/src/format.js` |
| `react-codebase/client/src/App.jsx` | `client/src/App.jsx` |
| `react-codebase/client/src/pages/Login.jsx` | `client/src/pages/Login.jsx` |
| `react-codebase/client/src/pages/Dashboard.jsx` | `client/src/pages/Dashboard.jsx` |
| `react-codebase/client/src/pages/Leads.jsx` | `client/src/pages/Leads.jsx` |
| `react-codebase/client/src/pages/Tasks.jsx` | `client/src/pages/Tasks.jsx` |
| `react-codebase/client/src/pages/ContactLog.jsx` | `client/src/pages/ContactLog.jsx` |
| `react-codebase/client/src/pages/Revenue.jsx` | `client/src/pages/Revenue.jsx` |
| `react-codebase/client/src/components/SearchBar.jsx` | `client/src/components/SearchBar.jsx` |
| `react-codebase/scripts/build-client.js` | `scripts/build-client.js` |
| `react-codebase/client/assets/` | `client/assets/` *(new folder)* |

**⚠ Critical caveat for the next agent:** The redesign was authored against an older version of the codebase that predates the features in PRs #1, #2, #3. Verbatim drop-ins for `format.js`, `Dashboard.jsx`, `Leads.jsx` would **delete** working features. These three files require a manual merge.

---

## Current state mid-task — partial progress on the redesign

Already copied verbatim to the worktree (✅ safe drop-ins, no feature loss):

- `client/index.html`
- `client/src/styles.js`
- `client/src/App.jsx`
- `client/src/pages/Login.jsx`
- `client/src/pages/Tasks.jsx`
- `client/src/pages/ContactLog.jsx`
- `client/src/pages/Revenue.jsx`
- `client/src/components/SearchBar.jsx`
- `scripts/build-client.js`
- `client/assets/logo-full.png` + `client/assets/logo-mark.png`

**Not yet done** (the rest of the redesign task):

1. **`client/src/stages.js`** — update color values to brand palette. Active stages already map cleanly to redesign colors (`New → navy`, `Contacted → navy-hover`, `Qualified → gold`, `Proposal → gold-hover`, `Won → success` (`#1f8a5b`), `Lost → red`). Add brand-equivalents for `FireCraft` (suggest `#ff7043` orange or gold-hover), `Not Pursuing` (`#9e9e9e`), `Closed/NA` (`#616161`), `Cannot Afford` (`#795548`). `stageHeaderBg` likewise — use `--color-callout-navy-bg`, `--color-callout-gold-bg`, `--color-callout-red-bg`.

2. **`client/src/format.js`** — keep the redesign's brand-colored `renewalStatus`, **but preserve** `sortRecords`, `nextSortDir`, `parseCSV`, `parseFlexibleDate` (these are still in the current file; just add the redesign's `renewalStatus` colors over the existing helpers).

3. **`client/src/pages/Leads.jsx`** — merge: take the redesign's visual treatment (KanbanCard, KanbanColumn, view toggle button styles, stage `<select>` pill styling, brand colors) **and re-add**:
   - Imports from `'../stages.js'`: `ACTIVE_STAGES, ARCHIVED_STAGES, ALL_STAGES, STAGES, isArchivedStage, stageColor, stageHeaderBg`
   - Imports `sortRecords, nextSortDir` from `'../format.js'`
   - Imports `ImportModal` from `'../components/ImportModal.jsx'` *(actually only Members page has the Import button; verify nothing on Leads needs it)*
   - State: `sortBy`, `sortDir`, `showArchived`
   - `archivedCount`, `filteredLeads` with archive filter logic, `leads = view === 'table' ? sortRecords(filteredLeads, ...) : filteredLeads`, `visibleKanbanStages = showArchived ? ALL_STAGES : ACTIVE_STAGES`
   - `toggleSort`, `SortTh` component
   - "Show archived (N)" checkbox in the filter toolbar
   - Replace `STAGES.map` in kanban with `visibleKanbanStages.map`
   - Replace `<th>` headers in table view with `<SortTh sortKey="...">`
   - `<optgroup>` Active/Archived in the filter dropdown, the per-row stage select, and the form stage select
   - Keep the redesign's stage pill colors (note: `'Qualified' || 'Proposal'` need dark text on the gold background)

4. **`client/src/pages/Members.jsx`** — was **not in the redesign folder**, so no visual file to merge from. It already uses `S.*` styles and CSS variables so the brand will pull through automatically. **Verify** the existing "Import CSV" button + sort headers still look right with the brand styles and adjust spacing/colors if needed.

5. **`client/src/pages/Dashboard.jsx`** — merge: take the redesign's brand styling for stats cards, lead pipeline bars, renewal alerts, recent contacts table. **Re-add** the Marketplace Coverage card (already in the current file). It should sit either above the stats cards or right after them. Use brand color buckets:
   - Members slice → `var(--color-success)` or `var(--color-navy)`
   - Active pipeline slice → `var(--color-gold)`
   - Archived slice → `var(--color-muted)` / `#9e9e9e`
   The redesign's `stageColors` map should be replaced with import from `'../stages.js'` so it picks up archived stages and FireCraft too. Use `isArchivedStage` from `stages.js` for partitioning.

6. **`client/src/components/ImportModal.jsx`** — was not in the redesign folder. It already uses `S.modal`, `S.btn`, `S.table` so brand applies automatically. **Verify** the success/failure panels (`background: 'var(--green-50, #f1f8e9)'`, `background: '#fff3e0'`) look right against the new palette; swap to `var(--color-callout-gold-bg)` and `var(--color-callout-red-bg)` if not.

7. **Build, commit, push, open PR #4.**

---

## Files map (relevant ones, post-PR #3)

```
server/
  index.js                         ← express.json limit raised to 10mb
  database.js                      ← pg pool + schema (members, leads, settings, contact_log, attachments, tasks, users)
  middleware/auth.js
  r2.js                            ← R2 S3-compat client for attachments
  routes/
    auth.js
    members.js                     ← /bulk added, row-by-row inserts
    leads.js                       ← /bulk added, row-by-row inserts
    contacts.js
    dashboard.js                   ← returns leadsByStage (raw counts grouped by stage)
    settings.js
    search.js
    tasks.js
    attachments.js

client/
  index.html                       ← redesign brand palette + Google Fonts (applied)
  src/
    main.jsx
    App.jsx                        ← redesign sidebar (applied)
    api.js                         ← robust error parsing (status N) (PR #3)
    format.js                      ← currently HAS my helpers; needs renewalStatus rewrite for brand
    styles.js                      ← redesign brand styles (applied)
    stages.js                      ← active/archived split; colors need brand re-tuning
    pages/
      Dashboard.jsx                ← has my Marketplace Coverage widget; needs brand merge
      Members.jsx                  ← has sort + Import CSV button; no redesign file existed; verify with brand
      Leads.jsx                    ← has sort + archive toggle + optgroups; needs brand merge
      Tasks.jsx                    ← redesign (applied)
      ContactLog.jsx               ← redesign (applied)
      Revenue.jsx                  ← redesign (applied)
      Login.jsx                    ← redesign (applied)
      Settings.jsx                 ← no redesign; auto-inherits via S.*
    components/
      SearchBar.jsx                ← redesign (applied)
      Modal.jsx                    ← inherits via S.*
      Field.jsx                    ← inherits via S.*
      ContactFormModal.jsx
      ContactsPanel.jsx
      AttachmentsPanel.jsx
      ImportModal.jsx              ← my 4-route version; verify with brand
  assets/
    logo-mark.png                  ← redesign (applied)
    logo-full.png                  ← redesign (applied)

scripts/
  build-client.js                  ← redesign, copies assets/ → build/assets/ (applied)

render.yaml                        ← autoDeploy: true from main
package.json                       ← deps: express, pg, react, esbuild, bcryptjs, jsonwebtoken, multer, @aws-sdk/* etc.
```

---

## Brand system reference

Defined as CSS variables in `client/index.html`:

```
--color-navy:        #071f40
--color-navy-hover:  #0d2d5c
--color-navy-deep:   #04152b
--color-gold:        #ebab22
--color-gold-hover:  #f5bc33
--color-gold-soft:   #fdf6e3
--color-red:         #c21f32
--color-red-hover:   #a91a2a
--color-white:       #ffffff
--color-light-gray:  #f4f5f7
--color-dark-gray:   #1f2937
--color-divider:     #dde1e7
--color-muted:       #5b6573
--color-callout-gold-bg: #fdf6e3
--color-callout-navy-bg: #e8edf4
--color-callout-red-bg:  #fdecea
--color-success: #1f8a5b   (used only for "Won" lead stage)

--font-heading: 'Montserrat'   (uppercase, tracked, for titles/CTAs/labels/badges)
--font-body:    'Raleway'

--shadow-sm   --shadow-md   --shadow-lg   --shadow-card
--radius-sm: 4px   --radius-md: 6px   --radius-lg: 10px
```

Legacy `--green-*` variables are repointed to the brand so older JSX picks up the new look automatically.

**Brand rules:**

- Navy leads. Gold is the **only** primary CTA color. Red is rationed to alerts/errors only.
- Montserrat (uppercase, tracked) for headings, CTAs, labels, badges.
- Raleway for body copy.
- Buttons (gold-on-navy primary): uppercase Montserrat 0.74rem 800 weight, 0.1em letter-spacing.

---

## PRs at a glance

| # | Title | State | URL |
|---|---|---|---|
| 1 | Add sortable tables and CSV mass import | MERGED | https://github.com/Booman008/3MA-CRM/pull/1 |
| 2 | Archived lead stages and Marketplace Coverage widget | MERGED | https://github.com/Booman008/3MA-CRM/pull/2 |
| 3 | Fix mass import: raise body limit, surface real errors | OPEN | https://github.com/Booman008/3MA-CRM/pull/3 |

When you finish the redesign merge, you'll need to open **PR #4** for those changes.

---

## Workflow notes

- Working directory **is already the worktree**. Do not `cd` into it.
- `gh` CLI is at `C:\Program Files\GitHub CLI\gh.exe` and authenticated as Booman008.
- After each PR merge, push lands on a stale branch — open a fresh PR for any follow-up commits.
- For multi-line PR bodies via gh on Windows PowerShell, write to a temp file and use `--body-file`.
- Build: `npm run build` (esbuild bundles `client/src/main.jsx` → `client/build/app.js`, copies `index.html` and `assets/` over).
- Run server locally: `npm start` (requires `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` env vars; R2 vars optional for attachments).
- Commits should end with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.
- PR bodies should end with the `Generated with [Claude Code]` line.
- The user prefers terse confirmation, with file path references using clickable markdown links. Avoid sycophancy.

---

## CSV format reference (3MA master sheet)

Headers (case-insensitive aliases handled in `ImportModal.jsx`):

```
License No., Business Name, DBA, Last Touch, Facebook, Business Type, Status,
County, Expiration, License Issue Date, Owner Name, Physical Address,
Mailing Address, Phone Number, Email Address
```

Status values seen in actual data:

```
Member                            106
Possible Member                   185
Not pursuing                       34
Cannot Afford / Not interested     15
Closed / NA                        11
In Pipeline                        11
FireCraft                           7
```

Total 369 rows. Date formats: `m/d/yyyy` (Expiration) and `mm-dd-yyyy` (Issue Date) — both normalized to ISO `yyyy-mm-dd` by `parseFlexibleDate`.

---

## How to resume

1. Verify uncommitted state in the worktree: `git status`. The already-applied redesign files should be unstaged.
2. Work through items 1–6 in the "Not yet done" list above (stages.js → format.js → Leads.jsx → Members.jsx verify → Dashboard.jsx → ImportModal.jsx verify).
3. `npm run build` should pass cleanly.
4. `git add -A`, commit with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`, push, open PR #4 from `claude/agitated-dewdney-440175` → `main`.
5. Tell the user the PR URL. Merge will trigger Render auto-deploy.
