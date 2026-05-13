// 3MA-brand styles for the CRM. Same `S.*` API as before — only values
// changed so existing JSX inline-style consumers pick the new look up.
//
// Brand rules (from /projects/172d6a2d-e49c-4623-ac37-e55dfee42eb9/):
//   • Navy leads. Gold is the only primary CTA. Red is rationed to alerts.
//   • Montserrat (uppercase, tracked) for headings/CTAs/labels/badges.
//   • Raleway for body copy.

const F_HEAD = 'var(--font-heading)';
const F_BODY = 'var(--font-body)';

const NAVY = 'var(--color-navy)';
const NAVY_HOVER = 'var(--color-navy-hover)';
const GOLD = 'var(--color-gold)';
const GOLD_HOVER = 'var(--color-gold-hover)';
const RED  = 'var(--color-red)';
const RED_HOVER = 'var(--color-red-hover)';
const WHITE = '#fff';
const LIGHT = 'var(--color-light-gray)';
const DIVIDER = 'var(--color-divider)';
const MUTED = 'var(--color-muted)';

export const S = {
  // ── Sidebar ───────────────────────────────────────────────
  sidebar: {
    width: 248,
    flexShrink: 0,
    background: NAVY,
    color: WHITE,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    borderRight: '1px solid var(--color-navy-deep)',
  },
  sidebarHeader: {
    padding: '22px 22px 18px',
    borderBottom: `2px solid ${GOLD}`,
    fontFamily: F_HEAD,
    fontWeight: 900,
    fontSize: '1.05rem',
    letterSpacing: '0.06em',
    color: WHITE,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  navBtn: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '11px 22px',
    background: active ? NAVY_HOVER : 'transparent',
    color: active ? GOLD : 'rgba(255,255,255,0.78)',
    border: 'none',
    borderLeft: `3px solid ${active ? GOLD : 'transparent'}`,
    cursor: 'pointer',
    fontFamily: F_HEAD,
    fontWeight: 600,
    fontSize: '0.78rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    textAlign: 'left',
    transition: 'background .15s, color .15s, border-color .15s',
  }),

  // ── Main area ─────────────────────────────────────────────
  main: {
    flex: 1,
    minWidth: 0,
    padding: '28px 32px',
    overflowY: 'auto',
    maxHeight: '100vh',
  },

  pageTitle: {
    fontFamily: F_HEAD,
    fontSize: '1.5rem',
    fontWeight: 800,
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 20,
  },

  // ── Cards ─────────────────────────────────────────────────
  card: {
    background: WHITE,
    borderRadius: 10,
    padding: '22px 24px',
    boxShadow: 'var(--shadow-card)',
    marginBottom: 16,
  },
  statsCard: (accentColor) => ({
    background: WHITE,
    borderRadius: 10,
    padding: '18px 20px',
    boxShadow: 'var(--shadow-card)',
    borderLeft: `4px solid ${accentColor}`,
    flex: '1 1 200px',
    minWidth: 200,
  }),

  // ── Buttons ───────────────────────────────────────────────
  btn: (variant = 'primary') => {
    const base = {
      padding: '9px 18px',
      borderRadius: 6,
      border: '1px solid transparent',
      cursor: 'pointer',
      fontFamily: F_HEAD,
      fontWeight: 800,
      fontSize: '0.74rem',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      transition: 'background .15s, color .15s, border-color .15s, box-shadow .15s',
      whiteSpace: 'nowrap',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
    };
    if (variant === 'primary')   return { ...base, background: GOLD, color: NAVY };
    if (variant === 'navy')      return { ...base, background: NAVY, color: WHITE };
    if (variant === 'secondary') return { ...base, background: 'transparent', color: NAVY, borderColor: DIVIDER };
    if (variant === 'danger')    return { ...base, background: RED, color: WHITE };
    if (variant === 'warning')   return { ...base, background: GOLD, color: NAVY };
    return { ...base, background: GOLD, color: NAVY };
  },

  // ── Inputs ────────────────────────────────────────────────
  input: {
    width: '100%',
    padding: '9px 12px',
    border: `1px solid ${DIVIDER}`,
    borderRadius: 6,
    fontSize: '0.88rem',
    outline: 'none',
    background: WHITE,
    color: 'var(--text)',
    fontFamily: F_BODY,
    transition: 'border-color .15s, box-shadow .15s',
  },
  select: {
    padding: '9px 12px',
    border: `1px solid ${DIVIDER}`,
    borderRadius: 6,
    fontSize: '0.88rem',
    outline: 'none',
    background: WHITE,
    color: 'var(--text)',
    fontFamily: F_BODY,
    cursor: 'pointer',
  },

  // ── Tables ────────────────────────────────────────────────
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    background: LIGHT,
    borderBottom: `2px solid ${GOLD}`,
    color: NAVY,
    fontFamily: F_HEAD,
    fontWeight: 700,
    fontSize: '0.68rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 16px',
    borderBottom: `1px solid ${DIVIDER}`,
    fontSize: '0.88rem',
    verticalAlign: 'middle',
  },

  // ── Badges ────────────────────────────────────────────────
  badge: (color) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 10px',
    borderRadius: 999,
    fontFamily: F_HEAD,
    fontSize: '0.66rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    background: color,
    color: WHITE,
    whiteSpace: 'nowrap',
  }),

  // ── Modal ─────────────────────────────────────────────────
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(7,31,64,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  modal: {
    background: WHITE,
    borderRadius: 12,
    padding: '28px 32px',
    width: '100%',
    maxWidth: 600,
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: 'var(--shadow-lg)',
    borderTop: `4px solid ${GOLD}`,
  },
  modalTitle: {
    fontFamily: F_HEAD,
    fontSize: '1.05rem',
    fontWeight: 800,
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },

  // ── Forms ─────────────────────────────────────────────────
  formRow: { marginBottom: 14 },
  label: {
    display: 'block',
    marginBottom: 6,
    fontFamily: F_HEAD,
    fontSize: '0.66rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: MUTED,
  },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' },

  // ── Toolbars / empty ─────────────────────────────────────
  toolbar: {
    display: 'flex',
    gap: 10,
    marginBottom: 18,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  emptyState: {
    textAlign: 'center',
    padding: 40,
    color: MUTED,
    fontSize: '0.92rem',
  },
};
