# 3MA CRM Redesign — Drop-in Files

These files replace selected files in your `3MA-CRM/` repo with the new 3MA-brand visual system applied (navy / gold / red, Montserrat headings + Raleway body).

## How to apply

Copy each file from this folder over the matching file in your repo:

| From (this project) | To (your repo) |
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

Then:

```
npm run build
npm start
```

## What changed

- **`index.html`** — Repoints the existing `--green-*` CSS variables to the 3MA palette, adds Google Fonts (Montserrat + Raleway), exposes brand tokens (`--color-navy`, `--color-gold`, `--color-red`, callouts, shadows, radii), sets Raleway as the body font.
- **`styles.js`** — Same `S.*` API as before; values retuned to the brand system. Primary button is now gold-on-navy uppercase Montserrat; sidebar is navy with gold accent; table headers are navy text on light-gray with a gold underline.
- **`App.jsx`** — Sidebar swapped to logo + brand mark, uppercase Montserrat nav, gold left-border for the active item, executive-director footer block.
- **`Login.jsx`** — Navy gradient background, gold-trim card.
- **`format.js`** — `renewalStatus` row tints and badge colors use the brand callout/red/gold scheme instead of Material reds and yellows.
- **`Dashboard.jsx`**, **`Leads.jsx`**, **`Tasks.jsx`**, **`ContactLog.jsx`**, **`Revenue.jsx`** — Stage / priority / contact-type color maps repointed to brand colors. Callout boxes use the official navy/gold/red callout bgs.
- **`SearchBar.jsx`** — Input field tinted with the navy/gold palette to match the sidebar.
- **`build-client.js`** — Adds one step to copy `client/assets/` into the build output so the logo is served.

## Other files

Everything else (`Members.jsx`, `Settings.jsx`, `Modal.jsx`, `Field.jsx`, all `*Panel.jsx` components, etc.) inherits the new look automatically through `styles.js` + the CSS variables — no changes needed.

## Fonts

Both Montserrat and Raleway are loaded from Google Fonts (already in `index.html`). No local font files needed.
