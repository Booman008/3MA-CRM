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

const PAGES = [
  { key: 'dashboard', label: 'Dashboard', icon: '▣' },
  { key: 'members', label: 'Members', icon: '☺' },
  { key: 'leads', label: 'Leads', icon: '⚑' },
  { key: 'tasks', label: 'Tasks', icon: '✓' },
  { key: 'contacts', label: 'Contact Log', icon: '☎' },
  { key: 'revenue', label: 'Revenue', icon: '$' },
  { key: 'settings', label: 'Settings', icon: '⚙' },
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
      case 'members': return <Members />;
      case 'leads': return <Leads />;
      case 'tasks': return <Tasks />;
      case 'contacts': return <ContactLog />;
      case 'revenue': return <Revenue />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  if (!auth) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <>
      <div style={S.sidebar}>
        <div style={S.sidebarHeader}>3MA CRM</div>
        <SearchBar />
        <nav style={{ flex: 1, paddingTop: 8 }}>
          {PAGES.map(p => (
            <button key={p.key} style={S.navBtn(page === p.key)} onClick={() => navigate(p.key)}
              onMouseEnter={e => { if (page !== p.key) e.target.style.background = 'var(--green-800)'; }}
              onMouseLeave={e => { if (page !== p.key) e.target.style.background = 'transparent'; }}>
              <span style={{ fontSize: '1.1rem' }}>{p.icon}</span> {p.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <button style={{ ...S.btn('secondary'), width: '100%', padding: '8px 12px' }} onClick={logout}>Log Out</button>
          <div style={{ marginTop: 12, fontSize: '.75rem', color: 'rgba(255,255,255,.4)' }}>3MA CRM v1.0</div>
        </div>
      </div>
      <div style={S.main}>
        {renderPage()}
      </div>
    </>
  );
}
