export const S = {
  sidebar: { width: 220, background: 'var(--green-900)', color: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, minHeight: '100vh' },
  sidebarHeader: { padding: '24px 20px 8px', fontSize: '1.4rem', fontWeight: 700, letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,.15)', paddingBottom: 16 },
  navBtn: (active) => ({ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 20px', background: active ? 'var(--green-700)' : 'transparent', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '.95rem', textAlign: 'left', transition: 'background .15s' }),
  main: { flex: 1, padding: '28px 32px', overflowY: 'auto', maxHeight: '100vh' },
  pageTitle: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--green-900)', marginBottom: 20 },
  card: { background: 'var(--card)', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.08)', marginBottom: 16 },
  statsCard: (color) => ({ background: 'var(--card)', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.08)', borderLeft: `4px solid ${color}`, flex: '1 1 180px', minWidth: 180 }),
  btn: (variant = 'primary') => {
    const colors = { primary: 'var(--green-700)', danger: 'var(--danger)', secondary: '#666', warning: 'var(--warning)' };
    return { padding: '8px 18px', background: colors[variant] || colors.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '.9rem', fontWeight: 500, transition: 'opacity .15s' };
  },
  input: { width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '.9rem', outline: 'none' },
  select: { padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '.9rem', outline: 'none', background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid var(--green-200)', color: 'var(--green-800)', fontSize: '.85rem', fontWeight: 600, whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: '.9rem' },
  badge: (color) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: '.78rem', fontWeight: 600, background: color, color: '#fff' }),
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 12, padding: 28, width: '90%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.18)' },
  modalTitle: { fontSize: '1.15rem', fontWeight: 700, color: 'var(--green-900)', marginBottom: 18 },
  formRow: { marginBottom: 14 },
  label: { display: 'block', marginBottom: 4, fontSize: '.82rem', fontWeight: 600, color: 'var(--text-light)' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' },
  toolbar: { display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' },
  emptyState: { textAlign: 'center', padding: 40, color: 'var(--text-light)', fontSize: '.95rem' },
};
