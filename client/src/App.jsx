import { useState, useEffect } from 'react';
import { TOKEN_KEY } from './api.js';
import { S } from './styles.js';
import { SearchBar } from './components/SearchBar.jsx';
import { LoginPage } from './pages/Login.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Members } from './pages/Members.jsx';
import { Leads } from './pages/Leads.jsx';
import { Tasks } from './pages/Tasks.jsx';
import { ContactLog } from './pages/ContactLog.jsx';
import { Revenue } from './pages/Revenue.jsx';
import { Settings } from './pages/Settings.jsx';

/* ──────────────────────────────────────────────────────────────
   Inline icon set (Lucide-style, 2px stroke). Sized via prop.
   ──────────────────────────────────────────────────────────── */
const Svg = ({ size = 18, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {children}
  </svg>
);
const Ic = {
  Dashboard: (p) => <Svg {...p}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></Svg>,
  Members:   (p) => <Svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Svg>,
  Leads:     (p) => <Svg {...p}><path d="M4 22V4a2 2 0 0 1 2-2h11l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M14 2v6h6"/><path d="M8 13h7"/><path d="M8 17h5"/></Svg>,
  Tasks:     (p) => <Svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></Svg>,
  Contacts:  (p) => <Svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></Svg>,
  Revenue:   (p) => <Svg {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></Svg>,
  Settings:  (p) => <Svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></Svg>,
  Logout:    (p) => <Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Svg>,
};

const PAGES = [
  { key: 'dashboard', label: 'Dashboard',   icon: Ic.Dashboard },
  { key: 'members',   label: 'Members',     icon: Ic.Members   },
  { key: 'leads',     label: 'Leads',       icon: Ic.Leads     },
  { key: 'tasks',     label: 'Tasks',       icon: Ic.Tasks     },
  { key: 'contacts',  label: 'Contact Log', icon: Ic.Contacts  },
  { key: 'revenue',   label: 'Revenue',     icon: Ic.Revenue   },
  { key: 'settings',  label: 'Settings',    icon: Ic.Settings  },
];

export function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { token } : null;
  });
  const [page, setPage] = useState(() => location.hash.slice(1) || 'dashboard');

  useEffect(() => {
    const handler = () => setPage(location.hash.slice(1) || 'dashboard');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  useEffect(() => {
    const handleLogout = () => setAuth(null);
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const handleLogin = (payload) => {
    setAuth({ token: payload.token, user: payload.user });
    if (!location.hash) location.hash = 'dashboard';
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setAuth(null);
  };

  const navigate = (key) => { location.hash = key; };

  const renderPage = () => {
    switch (page) {
      case 'members':  return <Members />;
      case 'leads':    return <Leads />;
      case 'tasks':    return <Tasks />;
      case 'contacts': return <ContactLog />;
      case 'revenue':  return <Revenue />;
      case 'settings': return <Settings />;
      default:         return <Dashboard />;
    }
  };

  if (!auth) return <LoginPage onLogin={handleLogin} />;

  const initials = (auth.user?.name || auth.user?.email || 'U')
    .split(/[ @]/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || 'U';

  return (
    <>
      <aside style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <img src="assets/logo-lettering.png" alt="3MA CRM — Voice of MS Cannabis"
               style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>

        <SearchBar />

        <div style={{
          fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.6rem',
          letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.42)', padding: '18px 22px 8px',
        }}>Main</div>

        <nav style={{ flex: 1, paddingBottom: 12 }}>
          {PAGES.slice(0, 6).map(p => {
            const active = page === p.key;
            const Icon = p.icon;
            return (
              <button key={p.key} style={S.navBtn(active)} onClick={() => navigate(p.key)}
                onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'var(--color-navy-hover)'; e.currentTarget.style.color = '#fff'; } }}
                onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.78)'; } }}>
                <Icon size={17} /> <span>{p.label}</span>
              </button>
            );
          })}

          <div style={{
            fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.6rem',
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.42)', padding: '18px 22px 8px',
          }}>Admin</div>

          {PAGES.slice(6).map(p => {
            const active = page === p.key;
            const Icon = p.icon;
            return (
              <button key={p.key} style={S.navBtn(active)} onClick={() => navigate(p.key)}
                onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'var(--color-navy-hover)'; e.currentTarget.style.color = '#fff'; } }}
                onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.78)'; } }}>
                <Icon size={17} /> <span>{p.label}</span>
              </button>
            );
          })}
        </nav>

        <div style={{ padding: '14px 22px 18px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'var(--color-gold)', color: 'var(--color-navy)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.78rem',
            }}>{initials}</div>
            <div style={{ lineHeight: 1.25, flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {auth.user?.name || auth.user?.email || 'Signed in'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                {auth.user?.role || 'Member'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={logout} style={{
              background: 'transparent', border: 'none',
              color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
              fontFamily: 'var(--font-heading)', fontSize: '0.68rem', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
            }}><Ic.Logout size={13} /> Sign Out</button>
            <span style={{
              fontFamily: 'var(--font-heading)', fontSize: '0.62rem', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
            }}>v1.0</span>
          </div>
        </div>
      </aside>

      <main style={S.main}>{renderPage()}</main>
    </>
  );
}
