const { useState, useEffect, useCallback } = React;
const TOKEN_KEY = 'crm_jwt_token';

// ── API helper ──────────────────────────────────────────────────────────────
const api = async (path, opts = {}) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    headers,
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event('auth:logout'));
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const errorBody = await res.json();
      message = errorBody.error || message;
    } catch {}
    throw new Error(message);
  }

  return res.json();
};

// ── Shared styles ───────────────────────────────────────────────────────────
const S = {
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

// ── Modal ───────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={S.modalTitle}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#999' }}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Field helper ────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return <div style={S.formRow}><label style={S.label}>{label}</label>{children}</div>;
}

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Login failed');

      localStorage.setItem(TOKEN_KEY, payload.token);
      onLogin(payload);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #f4f7f2 0%, #e8efe5 100%)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 18, boxShadow: '0 20px 50px rgba(13,59,13,.12)', padding: 32, border: '1px solid rgba(13,59,13,.08)' }}>
        <div style={{ fontSize: '.8rem', fontWeight: 700, letterSpacing: 1.2, color: 'var(--green-600)', textTransform: 'uppercase', marginBottom: 10 }}>3MA CRM</div>
        <h1 style={{ fontSize: '2rem', color: 'var(--green-900)', marginBottom: 10 }}>Sign in</h1>
        <p style={{ color: 'var(--text-light)', marginBottom: 24, lineHeight: 1.5 }}>Use your account to access the hosted CRM and protected membership data.</p>

        <form onSubmit={submit}>
          <Field label="Email">
            <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required />
          </Field>
          <Field label="Password">
            <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          {error && <div style={{ color: 'var(--danger)', fontSize: '.85rem', marginBottom: 14 }}>{error}</div>}
          <button type="submit" style={{ ...S.btn(), width: '100%', justifyContent: 'center', padding: '11px 18px' }} disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Format helpers ──────────────────────────────────────────────────────────
const fmt = {
  currency: (v) => v != null ? `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
  date: (v) => v ? new Date(v + 'T00:00:00').toLocaleDateString() : '—',
};

// ── Renewal status helper ───────────────────────────────────────────────────
// Returns { status, color, bgColor, label } for a given renewalDate string
function renewalStatus(renewalDate) {
  if (!renewalDate) return { status: 'none', color: 'inherit', bgColor: 'transparent', label: null };
  const today = new Date(); today.setHours(0,0,0,0);
  const renewal = new Date(renewalDate + 'T00:00:00');
  const diffDays = Math.ceil((renewal - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { status: 'pastDue', color: '#b71c1c', bgColor: '#ffebee', label: `${Math.abs(diffDays)}d overdue`, badgeBg: 'var(--danger)' };
  if (diffDays <= 30) return { status: 'urgent', color: '#e65100', bgColor: '#fff8e1', label: `${diffDays}d left`, badgeBg: 'var(--warning)' };
  if (diffDays <= 60) return { status: 'upcoming', color: '#f57f17', bgColor: '#fffde7', label: `${diffDays}d left`, badgeBg: '#fbc02d' };
  return { status: 'ok', color: 'inherit', bgColor: 'transparent', label: null };
}

// ══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api('/dashboard').then(setData).finally(() => setLoading(false)); }, []);

  if (loading) return <div style={S.emptyState}>Loading dashboard...</div>;
  if (!data) return <div style={S.emptyState}>Failed to load dashboard</div>;

  const stageColors = { 'New': 'var(--info)', 'Contacted': 'var(--green-500)', 'Qualified': 'var(--warning)', 'Proposal': '#7b1fa2', 'Won': 'var(--green-700)', 'Lost': 'var(--danger)' };
  const maxStageCount = Math.max(...(data.leadsByStage.map(s => s.count)), 1);

  return (
    <div>
      <div style={S.pageTitle}>Dashboard</div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={S.statsCard('var(--green-600)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Total Members</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--green-800)' }}>{data.totalMembers}</div>
        </div>
        <div style={S.statsCard('var(--info)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Total Licenses</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--green-800)' }}>{data.totalLicenses}</div>
        </div>
        <div style={S.statsCard('var(--green-400)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Total Dues Revenue</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--green-800)' }}>{fmt.currency(data.totalDues)}</div>
        </div>
        <div style={S.statsCard('var(--danger)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Past Due</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: data.pastDueMembers.length > 0 ? 'var(--danger)' : 'var(--green-800)' }}>{data.pastDueMembers.length}</div>
        </div>
        <div style={S.statsCard('var(--warning)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Renewing in 60 Days</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: data.upcomingRenewals.length > 0 ? 'var(--warning)' : 'var(--green-800)' }}>{data.upcomingRenewals.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Pipeline Chart */}
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--green-800)' }}>Lead Pipeline</div>
          {data.leadsByStage.length === 0 && <div style={{ color: 'var(--text-light)', fontSize: '.9rem' }}>No leads yet</div>}
          {data.leadsByStage.map(s => (
            <div key={s.stage} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: 3 }}>
                <span>{s.stage}</span><span style={{ fontWeight: 600 }}>{s.count}</span>
              </div>
              <div style={{ background: '#eee', borderRadius: 4, height: 22, overflow: 'hidden' }}>
                <div style={{ width: `${(s.count / maxStageCount) * 100}%`, height: '100%', background: stageColors[s.stage] || 'var(--green-500)', borderRadius: 4, transition: 'width .4s' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Renewal Alerts */}
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--green-800)' }}>Renewal Alerts</div>
          {data.pastDueMembers.length === 0 && data.upcomingRenewals.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: '.9rem' }}>No upcoming renewals or past-due members</div>
          ) : (
            <div>
              {/* Summary banners */}
              {data.pastDueMembers.length > 0 && (
                <div style={{ padding: '10px 14px', background: '#ffebee', borderRadius: 8, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #ffcdd2' }}>
                  <span style={{ fontSize: '1.1rem' }}>&#9888;</span>
                  <span style={{ color: '#b71c1c', fontWeight: 600 }}>{data.pastDueMembers.length} past-due member{data.pastDueMembers.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              {data.upcomingRenewals.length > 0 && (
                <div style={{ padding: '10px 14px', background: '#fff8e1', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #ffecb3' }}>
                  <span style={{ fontSize: '1.1rem' }}>&#8505;</span>
                  <span style={{ color: '#e65100', fontWeight: 600 }}>{data.upcomingRenewals.length} renewing within 60 days</span>
                </div>
              )}
              {/* Detailed member list */}
              <table style={S.table}>
                <thead><tr>
                  <th style={S.th}>Status</th><th style={S.th}>Business</th><th style={S.th}>Owner</th><th style={S.th}>Renewal Date</th><th style={S.th}>Dues</th>
                </tr></thead>
                <tbody>
                  {data.pastDueMembers.map(m => {
                    const rs = renewalStatus(m.renewalDate);
                    return (
                      <tr key={`pd-${m.id}`} style={{ background: rs.bgColor }}>
                        <td style={S.td}><span style={S.badge(rs.badgeBg)}>{rs.label}</span></td>
                        <td style={{ ...S.td, fontWeight: 600, color: rs.color }}>{m.businessName}</td>
                        <td style={S.td}>{m.ownerName || '—'}</td>
                        <td style={{ ...S.td, fontWeight: 600, color: rs.color }}>{fmt.date(m.renewalDate)}</td>
                        <td style={S.td}>{fmt.currency(m.duesAmount)}</td>
                      </tr>
                    );
                  })}
                  {data.upcomingRenewals.map(m => {
                    const rs = renewalStatus(m.renewalDate);
                    return (
                      <tr key={`ur-${m.id}`} style={{ background: rs.bgColor }}>
                        <td style={S.td}><span style={S.badge(rs.badgeBg)}>{rs.label}</span></td>
                        <td style={{ ...S.td, fontWeight: 600, color: rs.color }}>{m.businessName}</td>
                        <td style={S.td}>{m.ownerName || '—'}</td>
                        <td style={{ ...S.td, fontWeight: 600, color: rs.color }}>{fmt.date(m.renewalDate)}</td>
                        <td style={S.td}>{fmt.currency(m.duesAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent Contacts */}
      <div style={{ ...S.card, marginTop: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--green-800)' }}>Recent Contacts</div>
        {data.recentContacts.length === 0 ? (
          <div style={{ color: 'var(--text-light)', fontSize: '.9rem' }}>No contact log entries yet</div>
        ) : (
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Date</th><th style={S.th}>Name</th><th style={S.th}>Type</th><th style={S.th}>Summary</th><th style={S.th}>Next Action</th>
            </tr></thead>
            <tbody>
              {data.recentContacts.map(c => (
                <tr key={c.id}>
                  <td style={S.td}>{fmt.date(c.contactDate)}</td>
                  <td style={{ ...S.td, fontWeight: 500 }}>{c.entityName || '—'}</td>
                  <td style={S.td}><span style={S.badge('var(--green-600)')}>{c.contactType || '—'}</span></td>
                  <td style={{ ...S.td, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.summary || '—'}</td>
                  <td style={S.td}>{c.nextAction || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  MEMBERS
// ══════════════════════════════════════════════════════════════════════════════
const MEMBER_DEFAULTS = { businessName: '', licenseNo: '', licenseType: '', county: '', ownerName: '', phone: '', email: '', joinDate: '', renewalDate: '', duesAmount: '', membershipTier: '', notes: '' };
const LICENSE_TYPES = ['Dispensary', 'Cultivator Facility', 'Micro-Cultivation', 'Processing Facility', 'Micro-Processing', 'Transportation Entity', 'Testing Facility', 'Disposal Entity', 'Ancillary', 'Practitioner'];
const EMPTY_LICENSE_ROW = { number: '', type: '' };

// Parse licenseNo column: handles new JSON format, legacy comma-separated, or plain string
function parseLicenses(licenseNo) {
  if (!licenseNo) return [{ ...EMPTY_LICENSE_ROW }];
  try {
    const parsed = JSON.parse(licenseNo);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(l => ({ number: l.number || '', type: l.type || '' }));
  } catch {}
  // Legacy: comma-separated plain numbers
  const parts = licenseNo.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length > 0) return parts.map(n => ({ number: n, type: '' }));
  return [{ ...EMPTY_LICENSE_ROW }];
}

// Extract all license types from a parsed license JSON array for table display
function parseLicenseTypes(licenseNo) {
  if (!licenseNo) return [];
  try {
    const parsed = JSON.parse(licenseNo);
    if (Array.isArray(parsed)) return parsed.map(l => l.type).filter(Boolean);
  } catch {}
  return [];
}

// Extract all license numbers from a parsed license JSON array for table display
function parseLicenseNumbers(licenseNo) {
  if (!licenseNo) return [];
  try {
    const parsed = JSON.parse(licenseNo);
    if (Array.isArray(parsed)) return parsed.map(l => l.number).filter(Boolean);
  } catch {}
  // Legacy fallback
  return licenseNo.split(',').map(s => s.trim()).filter(Boolean);
}

const RENEWAL_FILTERS = [
  { value: '', label: 'All Renewal Status' },
  { value: 'pastDue', label: 'Past Due' },
  { value: 'urgent', label: 'Within 30 Days' },
  { value: 'upcoming', label: 'Within 60 Days' },
  { value: 'ok', label: 'Current (60+ Days)' },
  { value: 'none', label: 'No Renewal Date' },
];

function Members() {
  const [allMembers, setAllMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [licenseTypeFilter, setLicenseTypeFilter] = useState('');
  const [countyFilter, setCountyFilter] = useState('');
  const [renewalFilter, setRenewalFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [form, setForm] = useState(MEMBER_DEFAULTS);
  const [editId, setEditId] = useState(null);
  const [licenseRows, setLicenseRows] = useState([{ ...EMPTY_LICENSE_ROW }]);

  const load = useCallback(() => {
    setLoading(true);
    api(`/members?search=${encodeURIComponent(search)}`).then(setAllMembers).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  // Derive unique values for filter dropdowns from the full dataset
  const licenseTypes = [...new Set(allMembers.flatMap(m => parseLicenseTypes(m.licenseNo)).filter(Boolean))].sort();
  const counties = [...new Set(allMembers.map(m => m.county).filter(Boolean))].sort();

  // Apply client-side filters
  const members = allMembers.filter(m => {
    if (licenseTypeFilter && !parseLicenseTypes(m.licenseNo).includes(licenseTypeFilter)) return false;
    if (countyFilter && m.county !== countyFilter) return false;
    if (renewalFilter) {
      const rs = renewalStatus(m.renewalDate);
      if (renewalFilter === 'urgent') { if (rs.status !== 'urgent') return false; }
      else if (renewalFilter === 'upcoming') { if (rs.status !== 'upcoming' && rs.status !== 'urgent') return false; }
      else if (rs.status !== renewalFilter) return false;
    }
    return true;
  });

  const activeFilterCount = [licenseTypeFilter, countyFilter, renewalFilter].filter(Boolean).length;

  const clearFilters = () => { setLicenseTypeFilter(''); setCountyFilter(''); setRenewalFilter(''); };

  const openAdd = () => { setForm(MEMBER_DEFAULTS); setLicenseRows([{ ...EMPTY_LICENSE_ROW }]); setEditId(null); setModal('add'); };
  const openEdit = (m) => {
    setForm({ ...MEMBER_DEFAULTS, ...m, duesAmount: m.duesAmount ?? '' });
    setLicenseRows(parseLicenses(m.licenseNo));
    setEditId(m.id); setModal('edit');
  };
  const close = () => setModal(null);

  // License row helpers
  const setLicenseField = (idx, field, val) => setLicenseRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: val } : row));
  const addLicenseRow = () => setLicenseRows(prev => [...prev, { ...EMPTY_LICENSE_ROW }]);
  const removeLicenseRow = (idx) => setLicenseRows(prev => prev.filter((_, i) => i !== idx));

  const save = async () => {
    // Build JSON array of license entries, filtering out completely empty rows
    const licenses = licenseRows.filter(r => r.number.trim() || r.type);
    const licenseNo = licenses.length > 0 ? JSON.stringify(licenses) : null;
    // Also set licenseType to the first license type for backward compat / simple queries
    const licenseType = licenses.length > 0 ? licenses[0].type : null;
    const body = { ...form, licenseNo, licenseType, duesAmount: form.duesAmount !== '' ? Number(form.duesAmount) : null };
    if (modal === 'add') await api('/members', { method: 'POST', body });
    else await api(`/members/${editId}`, { method: 'PUT', body });
    close(); load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this member?')) return;
    await api(`/members/${id}`, { method: 'DELETE' });
    load();
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={S.pageTitle}>Members</div>
        <button style={S.btn()} onClick={openAdd}>+ Add Member</button>
      </div>

      {/* Search bar */}
      <div style={S.toolbar}>
        <input style={{ ...S.input, maxWidth: 320 }} placeholder="Search by name, license, email..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Filter row */}
      <div style={{ ...S.toolbar, background: 'var(--card)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <select style={S.select} value={licenseTypeFilter} onChange={e => setLicenseTypeFilter(e.target.value)}>
          <option value="">All License Types</option>
          {licenseTypes.map(t => <option key={t}>{t}</option>)}
        </select>
        <select style={S.select} value={countyFilter} onChange={e => setCountyFilter(e.target.value)}>
          <option value="">All Counties</option>
          {counties.map(c => <option key={c}>{c}</option>)}
        </select>
        <select style={{ ...S.select, ...(renewalFilter === 'pastDue' ? { borderColor: 'var(--danger)', color: 'var(--danger)' } : renewalFilter === 'urgent' ? { borderColor: 'var(--warning)', color: 'var(--warning)' } : {}) }}
          value={renewalFilter} onChange={e => setRenewalFilter(e.target.value)}>
          {RENEWAL_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} style={{ ...S.btn('secondary'), padding: '6px 12px', fontSize: '.82rem' }}>
            Clear Filters ({activeFilterCount})
          </button>
        )}
        <span style={{ color: 'var(--text-light)', fontSize: '.85rem', marginLeft: 'auto' }}>
          {members.length}{members.length !== allMembers.length ? ` of ${allMembers.length}` : ''} member{members.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={S.card}>
        {loading ? <div style={S.emptyState}>Loading...</div> : members.length === 0 ? (
          <div style={S.emptyState}>
            {allMembers.length === 0 ? 'No members found. Add your first member to get started.' : 'No members match your filters.'}
            {activeFilterCount > 0 && <div style={{ marginTop: 8 }}><button onClick={clearFilters} style={{ ...S.btn('secondary'), padding: '6px 14px', fontSize: '.85rem' }}>Clear Filters</button></div>}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Business Name</th><th style={S.th}>Owner</th><th style={S.th}>License #</th><th style={S.th}>Type</th><th style={S.th}>County</th><th style={S.th}>Tier</th><th style={S.th}>Dues</th><th style={S.th}>Renewal</th><th style={S.th}>Actions</th>
              </tr></thead>
              <tbody>
                {members.map(m => {
                  const rs = renewalStatus(m.renewalDate);
                  return (
                  <tr key={m.id} style={{ cursor: 'pointer', background: rs.bgColor, transition: 'background .15s' }} onDoubleClick={() => openEdit(m)}>
                    <td style={{ ...S.td, fontWeight: 600 }}>{m.businessName}</td>
                    <td style={S.td}>{m.ownerName || '—'}</td>
                    <td style={S.td}>{(() => { const nums = parseLicenseNumbers(m.licenseNo); return nums.length ? nums.map((n, i) => <div key={i} style={{ lineHeight: 1.5, fontSize: '.85rem' }}>{n}</div>) : '—'; })()}</td>
                    <td style={S.td}>{(() => { const types = parseLicenseTypes(m.licenseNo); return types.length ? types.map((t, i) => <div key={i} style={{ lineHeight: 1.5, fontSize: '.85rem' }}>{t}</div>) : (m.licenseType || '—'); })()}</td>
                    <td style={S.td}>{m.county || '—'}</td>
                    <td style={S.td}>{m.membershipTier ? <span style={S.badge('var(--green-600)')}>{m.membershipTier}</span> : '—'}</td>
                    <td style={S.td}>{fmt.currency(m.duesAmount)}</td>
                    <td style={S.td}>
                      <span style={{ color: rs.color, fontWeight: rs.status !== 'ok' && rs.status !== 'none' ? 600 : 400 }}>{fmt.date(m.renewalDate)}</span>
                      {rs.label && <span style={{ ...S.badge(rs.badgeBg), marginLeft: 8, fontSize: '.72rem' }}>{rs.label}</span>}
                    </td>
                    <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                      <button style={{ ...S.btn('primary'), padding: '4px 10px', fontSize: '.8rem', marginRight: 6 }} onClick={() => openEdit(m)}>Edit</button>
                      <button style={{ ...S.btn('danger'), padding: '4px 10px', fontSize: '.8rem' }} onClick={() => remove(m.id)}>Del</button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Member' : 'Edit Member'} onClose={close}>
          <div style={S.formGrid}>
            <Field label="Business Name *"><input style={S.input} value={form.businessName} onChange={e => set('businessName', e.target.value)} /></Field>
            <Field label="Owner Name"><input style={S.input} value={form.ownerName} onChange={e => set('ownerName', e.target.value)} /></Field>
          </div>
          {/* License rows — full width outside the 2-column grid */}
          <div style={S.formRow}>
            <label style={S.label}>Licenses</label>
            {licenseRows.map((row, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <input style={{ ...S.input, flex: '1 1 45%' }} value={row.number} onChange={e => setLicenseField(idx, 'number', e.target.value)} placeholder={`License #${idx + 1}`} />
                <select style={{ ...S.select, flex: '1 1 45%' }} value={row.type} onChange={e => setLicenseField(idx, 'type', e.target.value)}>
                  <option value="">License Type...</option>
                  {LICENSE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                {idx > 0 ? (
                  <button type="button" onClick={() => removeLicenseRow(idx)}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, padding: '2px 6px', lineHeight: 1, flexShrink: 0 }}
                    title="Remove this license">&times;</button>
                ) : (
                  <span style={{ width: 22, flexShrink: 0 }} />
                )}
              </div>
            ))}
            <button type="button" onClick={addLicenseRow}
              style={{ background: 'none', border: 'none', color: 'var(--green-700)', cursor: 'pointer', fontSize: '.82rem', fontWeight: 600, padding: '4px 0', marginTop: 2 }}>
              + Add License #
            </button>
          </div>
          <div style={S.formGrid}>
            <Field label="County"><input style={S.input} value={form.county} onChange={e => set('county', e.target.value)} /></Field>
            <Field label="Membership Tier">
              <select style={{ ...S.select, width: '100%' }} value={form.membershipTier} onChange={e => set('membershipTier', e.target.value)}>
                <option value="">Select...</option><option>Affiliate</option><option>Member</option><option>Board Member</option><option>Corporate Sponsor</option>
              </select>
            </Field>
            <Field label="Phone"><input style={S.input} value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
            <Field label="Email"><input style={S.input} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
            <Field label="Join Date"><input style={S.input} type="date" value={form.joinDate} onChange={e => set('joinDate', e.target.value)} /></Field>
            <Field label="Renewal Date"><input style={S.input} type="date" value={form.renewalDate} onChange={e => set('renewalDate', e.target.value)} /></Field>
            <Field label="Dues Amount ($)"><input style={S.input} type="number" step="0.01" value={form.duesAmount} onChange={e => set('duesAmount', e.target.value)} /></Field>
          </div>
          <Field label="Notes"><textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button style={S.btn('secondary')} onClick={close}>Cancel</button>
            <button style={S.btn()} onClick={save} disabled={!form.businessName}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  LEADS
// ══════════════════════════════════════════════════════════════════════════════
const LEAD_DEFAULTS = { businessName: '', licenseNo: '', licenseType: '', county: '', ownerName: '', phone: '', email: '', stage: 'New', priority: 'Medium', lastContactDate: '', nextContactDate: '', notes: '' };
const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
const PRIORITIES = ['Low', 'Medium', 'High'];
const priorityColor = { Low: 'var(--info)', Medium: 'var(--warning)', High: 'var(--danger)' };
const stageColor = { New: 'var(--info)', Contacted: 'var(--green-500)', Qualified: 'var(--warning)', Proposal: '#7b1fa2', Won: 'var(--green-700)', Lost: 'var(--danger)' };

// Kanban column color bands (lighter tints for column headers)
const stageHeaderBg = { New: '#e3f2fd', Contacted: '#e8f5e9', Qualified: '#fff3e0', Proposal: '#f3e5f5', Won: '#e8f5e9', Lost: '#ffebee' };

function Leads() {
  const [allLeads, setAllLeads] = useState([]);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [countyFilter, setCountyFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(LEAD_DEFAULTS);
  const [editId, setEditId] = useState(null);
  const [view, setView] = useState('kanban'); // 'table' | 'kanban'
  const [dragId, setDragId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    api(`/leads?${params}`).then(setAllLeads).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  // Derive unique counties for filter
  const leadCounties = [...new Set(allLeads.map(l => l.county).filter(Boolean))].sort();

  // Client-side filtering
  const leads = allLeads.filter(l => {
    if (stageFilter && l.stage !== stageFilter) return false;
    if (priorityFilter && l.priority !== priorityFilter) return false;
    if (countyFilter && l.county !== countyFilter) return false;
    return true;
  });

  const activeLeadFilters = [stageFilter, priorityFilter, countyFilter].filter(Boolean).length;
  const clearLeadFilters = () => { setStageFilter(''); setPriorityFilter(''); setCountyFilter(''); };

  const openAdd = (presetStage) => {
    setForm({ ...LEAD_DEFAULTS, stage: presetStage || 'New' });
    setEditId(null); setModal('add');
  };
  const openEdit = (l) => { setForm({ ...LEAD_DEFAULTS, ...l }); setEditId(l.id); setModal('edit'); };
  const close = () => setModal(null);

  const save = async () => {
    if (modal === 'add') await api('/leads', { method: 'POST', body: form });
    else await api(`/leads/${editId}`, { method: 'PUT', body: form });
    close(); load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this lead?')) return;
    await api(`/leads/${id}`, { method: 'DELETE' });
    load();
  };

  const updateStage = async (id, stage) => {
    // Optimistic update for snappier feel
    setAllLeads(prev => prev.map(l => l.id === id ? { ...l, stage } : l));
    await api(`/leads/${id}`, { method: 'PUT', body: { stage } });
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Drag & Drop handlers ──────────────────────────────────────────────────
  const onDragStart = (e, leadId) => {
    setDragId(leadId);
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag image semi-transparent
    if (e.target) e.target.style.opacity = '0.5';
  };
  const onDragEnd = (e) => {
    if (e.target) e.target.style.opacity = '1';
    setDragId(null);
    setDragOverStage(null);
  };
  const onDragOver = (e, stage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  };
  const onDragLeave = () => { setDragOverStage(null); };
  const onDrop = (e, newStage) => {
    e.preventDefault();
    setDragOverStage(null);
    if (dragId != null) {
      const lead = leads.find(l => l.id === dragId);
      if (lead && lead.stage !== newStage) {
        updateStage(dragId, newStage);
      }
    }
    setDragId(null);
  };

  // ── View toggle button style ──────────────────────────────────────────────
  const viewBtn = (v) => ({
    padding: '6px 14px', fontSize: '.85rem', fontWeight: 500, cursor: 'pointer', border: '1px solid var(--green-300)',
    background: view === v ? 'var(--green-700)' : '#fff', color: view === v ? '#fff' : 'var(--green-700)',
    borderRadius: v === 'table' ? '6px 0 0 6px' : '0 6px 6px 0', transition: 'all .15s',
  });

  // ── Kanban card ───────────────────────────────────────────────────────────
  const KanbanCard = ({ lead }) => {
    const isDragging = dragId === lead.id;
    return (
      <div
        draggable
        onDragStart={e => onDragStart(e, lead.id)}
        onDragEnd={onDragEnd}
        onClick={() => openEdit(lead)}
        style={{
          background: '#fff', borderRadius: 8, padding: '12px 14px', marginBottom: 8,
          boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,.18)' : '0 1px 3px rgba(0,0,0,.1)',
          cursor: 'grab', transition: 'box-shadow .15s, transform .15s',
          transform: isDragging ? 'rotate(2deg) scale(1.02)' : 'none',
          borderLeft: `3px solid ${priorityColor[lead.priority] || 'var(--warning)'}`,
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,.12)'; }}
        onMouseLeave={e => { if (!isDragging) e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.1)'; }}
      >
        <div style={{ fontWeight: 600, fontSize: '.88rem', marginBottom: 4, color: 'var(--green-900)' }}>{lead.businessName}</div>
        {lead.ownerName && <div style={{ fontSize: '.8rem', color: 'var(--text-light)', marginBottom: 6 }}>{lead.ownerName}</div>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ ...S.badge(priorityColor[lead.priority] || 'var(--warning)'), fontSize: '.7rem', padding: '2px 7px' }}>{lead.priority}</span>
          {lead.county && <span style={{ fontSize: '.75rem', color: 'var(--text-light)' }}>{lead.county}</span>}
        </div>
        {lead.nextContactDate && (
          <div style={{ fontSize: '.78rem', color: 'var(--text-light)', marginTop: 6 }}>Next: {fmt.date(lead.nextContactDate)}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); remove(lead.id); }}
            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '.75rem', padding: '2px 4px', opacity: 0.6 }}
            onMouseEnter={e => e.target.style.opacity = '1'} onMouseLeave={e => e.target.style.opacity = '0.6'}>
            Del
          </button>
        </div>
      </div>
    );
  };

  // ── Kanban column ─────────────────────────────────────────────────────────
  const KanbanColumn = ({ stage }) => {
    const stageLead = leads.filter(l => l.stage === stage);
    const isOver = dragOverStage === stage;
    return (
      <div
        onDragOver={e => onDragOver(e, stage)}
        onDragLeave={onDragLeave}
        onDrop={e => onDrop(e, stage)}
        style={{
          flex: '1 1 0', minWidth: 200, maxWidth: 280, display: 'flex', flexDirection: 'column',
          background: isOver ? 'var(--green-50)' : '#f5f5f5',
          borderRadius: 10, transition: 'background .2s, box-shadow .2s',
          boxShadow: isOver ? 'inset 0 0 0 2px var(--green-400)' : 'none',
        }}
      >
        {/* Column header */}
        <div style={{
          padding: '10px 14px', borderRadius: '10px 10px 0 0',
          background: stageHeaderBg[stage] || '#f5f5f5',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: `2px solid ${stageColor[stage] || 'var(--green-500)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: stageColor[stage], display: 'inline-block' }} />
            <span style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--green-900)' }}>{stage}</span>
          </div>
          <span style={{
            background: stageColor[stage], color: '#fff', borderRadius: 10, padding: '1px 8px',
            fontSize: '.78rem', fontWeight: 700, minWidth: 22, textAlign: 'center',
          }}>{stageLead.length}</span>
        </div>
        {/* Cards area */}
        <div style={{ flex: 1, padding: 8, minHeight: 80, overflowY: 'auto' }}>
          {stageLead.map(l => <KanbanCard key={l.id} lead={l} />)}
          {/* Drop placeholder when empty and dragging over */}
          {stageLead.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 8px', color: '#aaa', fontSize: '.82rem', fontStyle: 'italic' }}>
              {isOver ? 'Drop here' : 'No leads'}
            </div>
          )}
        </div>
        {/* Add button at bottom */}
        <div style={{ padding: '4px 8px 8px' }}>
          <button onClick={() => openAdd(stage)} style={{
            width: '100%', padding: '6px', background: 'transparent', border: '1px dashed #ccc',
            borderRadius: 6, cursor: 'pointer', color: 'var(--text-light)', fontSize: '.82rem',
            transition: 'border-color .15s, color .15s',
          }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--green-400)'; e.target.style.color = 'var(--green-700)'; }}
            onMouseLeave={e => { e.target.style.borderColor = '#ccc'; e.target.style.color = 'var(--text-light)'; }}>
            + Add Lead
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={S.pageTitle}>Leads</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* View toggle */}
          <div>
            <button style={viewBtn('table')} onClick={() => setView('table')}>Table</button>
            <button style={viewBtn('kanban')} onClick={() => setView('kanban')}>Kanban</button>
          </div>
          <button style={S.btn()} onClick={() => openAdd()}>+ Add Lead</button>
        </div>
      </div>

      {/* Search bar */}
      <div style={S.toolbar}>
        <input style={{ ...S.input, maxWidth: 280 }} placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Filter row */}
      <div style={{ ...S.toolbar, background: 'var(--card)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <select style={S.select} value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select style={S.select} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        <select style={S.select} value={countyFilter} onChange={e => setCountyFilter(e.target.value)}>
          <option value="">All Counties</option>
          {leadCounties.map(c => <option key={c}>{c}</option>)}
        </select>
        {activeLeadFilters > 0 && (
          <button onClick={clearLeadFilters} style={{ ...S.btn('secondary'), padding: '6px 12px', fontSize: '.82rem' }}>
            Clear Filters ({activeLeadFilters})
          </button>
        )}
        <span style={{ color: 'var(--text-light)', fontSize: '.85rem', marginLeft: 'auto' }}>
          {leads.length}{leads.length !== allLeads.length ? ` of ${allLeads.length}` : ''} lead{leads.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── KANBAN VIEW ──────────────────────────────────────────────────────── */}
      {view === 'kanban' && (
        loading ? <div style={S.emptyState}>Loading...</div> : (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
            {STAGES.map(stage => <KanbanColumn key={stage} stage={stage} />)}
          </div>
        )
      )}

      {/* ── TABLE VIEW ───────────────────────────────────────────────────────── */}
      {view === 'table' && (
        <div style={S.card}>
          {loading ? <div style={S.emptyState}>Loading...</div> : leads.length === 0 ? (
            <div style={S.emptyState}>
              {allLeads.length === 0 ? 'No leads found. Add your first lead to get started.' : 'No leads match your filters.'}
              {activeLeadFilters > 0 && <div style={{ marginTop: 8 }}><button onClick={clearLeadFilters} style={{ ...S.btn('secondary'), padding: '6px 14px', fontSize: '.85rem' }}>Clear Filters</button></div>}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead><tr>
                  <th style={S.th}>Business Name</th><th style={S.th}>Owner</th><th style={S.th}>License #</th><th style={S.th}>County</th><th style={S.th}>Stage</th><th style={S.th}>Priority</th><th style={S.th}>Next Contact</th><th style={S.th}>Actions</th>
                </tr></thead>
                <tbody>
                  {leads.map(l => (
                    <tr key={l.id}>
                      <td style={{ ...S.td, fontWeight: 600 }}>{l.businessName}</td>
                      <td style={S.td}>{l.ownerName || '—'}</td>
                      <td style={S.td}>{l.licenseNo || '—'}</td>
                      <td style={S.td}>{l.county || '—'}</td>
                      <td style={S.td}>
                        <select value={l.stage} onChange={e => updateStage(l.id, e.target.value)} style={{ ...S.select, padding: '3px 8px', fontSize: '.82rem', background: stageColor[l.stage] || 'var(--green-500)', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
                          {STAGES.map(s => <option key={s} style={{ color: '#333', background: '#fff' }}>{s}</option>)}
                        </select>
                      </td>
                      <td style={S.td}><span style={S.badge(priorityColor[l.priority] || 'var(--warning)')}>{l.priority}</span></td>
                      <td style={S.td}>{fmt.date(l.nextContactDate)}</td>
                      <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                        <button style={{ ...S.btn('primary'), padding: '4px 10px', fontSize: '.8rem', marginRight: 6 }} onClick={() => openEdit(l)}>Edit</button>
                        <button style={{ ...S.btn('danger'), padding: '4px 10px', fontSize: '.8rem' }} onClick={() => remove(l.id)}>Del</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modal && (
        <Modal title={modal === 'add' ? 'Add Lead' : 'Edit Lead'} onClose={close}>
          <div style={S.formGrid}>
            <Field label="Business Name *"><input style={S.input} value={form.businessName} onChange={e => set('businessName', e.target.value)} /></Field>
            <Field label="Owner Name"><input style={S.input} value={form.ownerName} onChange={e => set('ownerName', e.target.value)} /></Field>
            <Field label="License #"><input style={S.input} value={form.licenseNo} onChange={e => set('licenseNo', e.target.value)} /></Field>
            <Field label="License Type"><input style={S.input} value={form.licenseType} onChange={e => set('licenseType', e.target.value)} /></Field>
            <Field label="County"><input style={S.input} value={form.county} onChange={e => set('county', e.target.value)} /></Field>
            <Field label="Phone"><input style={S.input} value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
            <Field label="Email"><input style={S.input} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
            <Field label="Stage">
              <select style={{ ...S.select, width: '100%' }} value={form.stage} onChange={e => set('stage', e.target.value)}>
                {STAGES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select style={{ ...S.select, width: '100%' }} value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Last Contact Date"><input style={S.input} type="date" value={form.lastContactDate} onChange={e => set('lastContactDate', e.target.value)} /></Field>
            <Field label="Next Contact Date"><input style={S.input} type="date" value={form.nextContactDate} onChange={e => set('nextContactDate', e.target.value)} /></Field>
          </div>
          <Field label="Notes"><textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button style={S.btn('secondary')} onClick={close}>Cancel</button>
            <button style={S.btn()} onClick={save} disabled={!form.businessName}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  CONTACT LOG
// ══════════════════════════════════════════════════════════════════════════════
const CONTACT_DEFAULTS = { entityType: 'member', entityId: '', entityName: '', contactDate: new Date().toISOString().split('T')[0], contactType: 'Phone', summary: '', nextAction: '', nextActionDate: '' };
const CONTACT_TYPES = ['Phone', 'Email', 'In-Person', 'Text', 'Mail', 'Other'];

function ContactLog() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(CONTACT_DEFAULTS);
  const [entities, setEntities] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    api(`/contacts?search=${encodeURIComponent(search)}`).then(setLogs).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const openModal = () => {
    setForm({ ...CONTACT_DEFAULTS, contactDate: new Date().toISOString().split('T')[0] });
    // Load members and leads for the entity picker
    Promise.all([api('/members'), api('/leads')]).then(([m, l]) => {
      setEntities([
        ...m.map(x => ({ id: x.id, type: 'member', name: x.businessName })),
        ...l.map(x => ({ id: x.id, type: 'lead', name: x.businessName })),
      ]);
    });
    setModal(true);
  };

  const save = async () => {
    await api('/contacts', { method: 'POST', body: form });
    setModal(false); load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this contact log entry?')) return;
    await api(`/contacts/${id}`, { method: 'DELETE' });
    load();
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const pickEntity = (val) => {
    if (!val) { set('entityId', ''); set('entityName', ''); set('entityType', 'member'); return; }
    const [type, id] = val.split(':');
    const ent = entities.find(e => e.type === type && e.id === Number(id));
    setForm(f => ({ ...f, entityType: type, entityId: Number(id), entityName: ent ? ent.name : '' }));
  };

  const contactTypeIcon = { Phone: '\u260E', Email: '\u2709', 'In-Person': '\u263A', Text: '\u2709', Mail: '\u2709', Other: '\u2022' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={S.pageTitle}>Contact Log</div>
        <button style={S.btn()} onClick={openModal}>+ Log Contact</button>
      </div>

      <div style={S.toolbar}>
        <input style={{ ...S.input, maxWidth: 320 }} placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
        <span style={{ color: 'var(--text-light)', fontSize: '.85rem' }}>{logs.length} entr{logs.length !== 1 ? 'ies' : 'y'}</span>
      </div>

      {loading ? <div style={S.emptyState}>Loading...</div> : logs.length === 0 ? <div style={{ ...S.card, ...S.emptyState }}>No contact log entries yet.</div> : (
        <div>
          {logs.map(c => (
            <div key={c.id} style={{ ...S.card, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: c.entityType === 'member' ? 'var(--green-100)' : '#e3f2fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                {contactTypeIcon[c.contactType] || '\u2022'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div>
                    <strong>{c.entityName || 'Unknown'}</strong>
                    <span style={{ ...S.badge(c.entityType === 'member' ? 'var(--green-600)' : 'var(--info)'), marginLeft: 8, fontSize: '.72rem' }}>{c.entityType}</span>
                    <span style={{ ...S.badge(stageColor[c.contactType] || 'var(--green-500)'), marginLeft: 6, fontSize: '.72rem' }}>{c.contactType}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '.82rem', color: 'var(--text-light)' }}>{fmt.date(c.contactDate)}</span>
                    <button style={{ ...S.btn('danger'), padding: '2px 8px', fontSize: '.75rem' }} onClick={() => remove(c.id)}>Del</button>
                  </div>
                </div>
                {c.summary && <div style={{ fontSize: '.9rem', color: '#444', marginBottom: 4 }}>{c.summary}</div>}
                {c.nextAction && <div style={{ fontSize: '.85rem', color: 'var(--green-700)' }}>Next: {c.nextAction}{c.nextActionDate ? ` (by ${fmt.date(c.nextActionDate)})` : ''}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title="Log New Contact" onClose={() => setModal(false)}>
          <Field label="Member or Lead *">
            <select style={{ ...S.select, width: '100%' }} value={form.entityId ? `${form.entityType}:${form.entityId}` : ''} onChange={e => pickEntity(e.target.value)}>
              <option value="">Select...</option>
              {entities.filter(e => e.type === 'member').length > 0 && <optgroup label="Members">
                {entities.filter(e => e.type === 'member').map(e => <option key={`m${e.id}`} value={`member:${e.id}`}>{e.name}</option>)}
              </optgroup>}
              {entities.filter(e => e.type === 'lead').length > 0 && <optgroup label="Leads">
                {entities.filter(e => e.type === 'lead').map(e => <option key={`l${e.id}`} value={`lead:${e.id}`}>{e.name}</option>)}
              </optgroup>}
            </select>
          </Field>
          <div style={S.formGrid}>
            <Field label="Contact Date *"><input style={S.input} type="date" value={form.contactDate} onChange={e => set('contactDate', e.target.value)} /></Field>
            <Field label="Contact Type">
              <select style={{ ...S.select, width: '100%' }} value={form.contactType} onChange={e => set('contactType', e.target.value)}>
                {CONTACT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Summary"><textarea style={{ ...S.input, minHeight: 70, resize: 'vertical' }} value={form.summary} onChange={e => set('summary', e.target.value)} /></Field>
          <div style={S.formGrid}>
            <Field label="Next Action"><input style={S.input} value={form.nextAction} onChange={e => set('nextAction', e.target.value)} /></Field>
            <Field label="Next Action Date"><input style={S.input} type="date" value={form.nextActionDate} onChange={e => set('nextActionDate', e.target.value)} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button style={S.btn('secondary')} onClick={() => setModal(false)}>Cancel</button>
            <button style={S.btn()} onClick={save} disabled={!form.entityId || !form.contactDate}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  REVENUE
// ══════════════════════════════════════════════════════════════════════════════
function Revenue() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api('/members').then(setMembers).finally(() => setLoading(false)); }, []);

  if (loading) return <div style={S.emptyState}>Loading...</div>;

  const totalRevenue = members.reduce((s, m) => s + (m.duesAmount || 0), 0);

  // Group by license type
  const byType = {};
  members.forEach(m => {
    const type = m.licenseType || 'Unspecified';
    if (!byType[type]) byType[type] = { count: 0, total: 0 };
    byType[type].count++;
    byType[type].total += m.duesAmount || 0;
  });
  const typeEntries = Object.entries(byType).sort((a, b) => b[1].total - a[1].total);
  const maxTypeTotal = Math.max(...typeEntries.map(([, v]) => v.total), 1);

  // Group by tier
  const byTier = {};
  members.forEach(m => {
    const tier = m.membershipTier || 'No Tier';
    if (!byTier[tier]) byTier[tier] = { count: 0, total: 0 };
    byTier[tier].count++;
    byTier[tier].total += m.duesAmount || 0;
  });
  const tierEntries = Object.entries(byTier).sort((a, b) => b[1].total - a[1].total);

  const barColors = ['var(--green-700)', 'var(--green-500)', 'var(--green-400)', 'var(--green-300)', '#66bb6a', '#a5d6a7', '#c8e6c9'];

  return (
    <div>
      <div style={S.pageTitle}>Revenue</div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={S.statsCard('var(--green-600)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Total Dues Revenue</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--green-800)' }}>{fmt.currency(totalRevenue)}</div>
        </div>
        <div style={S.statsCard('var(--green-400)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Paying Members</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--green-800)' }}>{members.filter(m => m.duesAmount > 0).length}</div>
        </div>
        <div style={S.statsCard('var(--info)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Avg Dues</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--green-800)' }}>{members.length ? fmt.currency(totalRevenue / members.length) : '—'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* By License Type */}
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 16, color: 'var(--green-800)' }}>Dues by License Type</div>
          {typeEntries.length === 0 ? <div style={{ color: 'var(--text-light)', fontSize: '.9rem' }}>No data</div> : (
            typeEntries.map(([type, data], i) => (
              <div key={type} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: 3 }}>
                  <span>{type} <span style={{ color: 'var(--text-light)' }}>({data.count})</span></span>
                  <span style={{ fontWeight: 600 }}>{fmt.currency(data.total)}</span>
                </div>
                <div style={{ background: '#eee', borderRadius: 4, height: 22, overflow: 'hidden' }}>
                  <div style={{ width: `${(data.total / maxTypeTotal) * 100}%`, height: '100%', background: barColors[i % barColors.length], borderRadius: 4, transition: 'width .4s' }} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* By Tier */}
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 16, color: 'var(--green-800)' }}>Dues by Membership Tier</div>
          {tierEntries.length === 0 ? <div style={{ color: 'var(--text-light)', fontSize: '.9rem' }}>No data</div> : (
            <table style={S.table}>
              <thead><tr><th style={S.th}>Tier</th><th style={S.th}>Members</th><th style={S.th}>Total Dues</th><th style={S.th}>Avg</th></tr></thead>
              <tbody>
                {tierEntries.map(([tier, data]) => (
                  <tr key={tier}>
                    <td style={{ ...S.td, fontWeight: 600 }}>{tier}</td>
                    <td style={S.td}>{data.count}</td>
                    <td style={S.td}>{fmt.currency(data.total)}</td>
                    <td style={S.td}>{fmt.currency(data.total / data.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Full member dues list */}
      <div style={{ ...S.card, marginTop: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--green-800)' }}>All Member Dues</div>
        {members.length === 0 ? <div style={{ color: 'var(--text-light)', fontSize: '.9rem' }}>No members</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead><tr><th style={S.th}>Business</th><th style={S.th}>License Type</th><th style={S.th}>Tier</th><th style={S.th}>County</th><th style={S.th}>Dues</th><th style={S.th}>Renewal</th></tr></thead>
              <tbody>
                {[...members].sort((a, b) => (b.duesAmount || 0) - (a.duesAmount || 0)).map(m => (
                  <tr key={m.id}>
                    <td style={{ ...S.td, fontWeight: 500 }}>{m.businessName}</td>
                    <td style={S.td}>{m.licenseType || '—'}</td>
                    <td style={S.td}>{m.membershipTier || '—'}</td>
                    <td style={S.td}>{m.county || '—'}</td>
                    <td style={{ ...S.td, fontWeight: 600, color: 'var(--green-700)' }}>{fmt.currency(m.duesAmount)}</td>
                    <td style={S.td}>{fmt.date(m.renewalDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════════════════════════════════
const DEFAULT_LICENSE_TYPES = ['Retail', 'Grower/Processor', 'Dispensary', 'Transport', 'Testing Lab', 'Micro', 'Practitioner', 'Other'];
const DEFAULT_TIERS = ['Affiliate', 'Member', 'Board Member', 'Corporate Sponsor'];

function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local form state
  const [userName, setUserName] = useState('');
  const [userTitle, setUserTitle] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [tierPricing, setTierPricing] = useState({});
  const [customLicenseTypes, setCustomLicenseTypes] = useState([]);
  const [newLicenseType, setNewLicenseType] = useState('');

  useEffect(() => {
    api('/settings').then(s => {
      setSettings(s);
      setUserName(s.userName || '');
      setUserTitle(s.userTitle || '');
      setOrganizationName(s.organizationName || '');
      const tp = typeof s.tierPricing === 'object' ? s.tierPricing : {};
      setTierPricing(tp);
      // Extract any custom license types from saved pricing
      const savedTypes = Object.keys(tp);
      const custom = savedTypes.filter(t => {
        const base = t.split('::')[0]; // licenseType::tier format not used, just licenseType
        return !DEFAULT_LICENSE_TYPES.includes(base);
      });
      // Actually tierPricing is { licenseType: { tier: amount } }
      const allLicTypes = Object.keys(tp);
      setCustomLicenseTypes(allLicTypes.filter(t => !DEFAULT_LICENSE_TYPES.includes(t)));
    }).finally(() => setLoading(false));
  }, []);

  const allLicenseTypes = [...DEFAULT_LICENSE_TYPES, ...customLicenseTypes.filter(t => !DEFAULT_LICENSE_TYPES.includes(t))];

  const setPrice = (licenseType, tier, value) => {
    setTierPricing(prev => {
      const updated = { ...prev };
      if (!updated[licenseType]) updated[licenseType] = {};
      updated[licenseType] = { ...updated[licenseType], [tier]: value };
      return updated;
    });
  };

  const getPrice = (licenseType, tier) => {
    return tierPricing[licenseType]?.[tier] ?? '';
  };

  const addLicenseType = () => {
    const trimmed = newLicenseType.trim();
    if (!trimmed || allLicenseTypes.includes(trimmed)) return;
    setCustomLicenseTypes(prev => [...prev, trimmed]);
    setNewLicenseType('');
  };

  const removeLicenseType = (type) => {
    setCustomLicenseTypes(prev => prev.filter(t => t !== type));
    setTierPricing(prev => {
      const updated = { ...prev };
      delete updated[type];
      return updated;
    });
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api('/settings', {
        method: 'PUT',
        body: { userName, userTitle, organizationName, tierPricing },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={S.emptyState}>Loading settings...</div>;

  const sectionStyle = { ...S.card, marginBottom: 24 };
  const sectionTitle = { fontSize: '1.05rem', fontWeight: 700, color: 'var(--green-800)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={S.pageTitle}>Settings</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {saved && <span style={{ color: 'var(--green-600)', fontWeight: 500, fontSize: '.9rem' }}>Settings saved!</span>}
          <button style={S.btn()} onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Profile Section */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Your Profile</div>
        <div style={S.formGrid}>
          <Field label="Your Name">
            <input style={S.input} value={userName} onChange={e => setUserName(e.target.value)} placeholder="e.g. John Smith" />
          </Field>
          <Field label="Your Title">
            <input style={S.input} value={userTitle} onChange={e => setUserTitle(e.target.value)} placeholder="e.g. Executive Director" />
          </Field>
        </div>
      </div>

      {/* Organization Section */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Organization</div>
        <div style={{ maxWidth: 400 }}>
          <Field label="Organization Name">
            <input style={S.input} value={organizationName} onChange={e => setOrganizationName(e.target.value)} placeholder="e.g. 3MA" />
          </Field>
        </div>
      </div>

      {/* Tier Pricing Section */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Default Membership Tier Pricing by License Type</div>
        <p style={{ fontSize: '.85rem', color: 'var(--text-light)', marginBottom: 16 }}>
          Set the default annual dues for each license type and membership tier. These values will be used as defaults when adding new members.
        </p>

        {/* Add custom license type */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, maxWidth: 280 }}>
            <Field label="Add Custom License Type">
              <input style={S.input} value={newLicenseType} onChange={e => setNewLicenseType(e.target.value)}
                placeholder="e.g. Cultivation" onKeyDown={e => { if (e.key === 'Enter') addLicenseType(); }} />
            </Field>
          </div>
          <button style={{ ...S.btn(), marginBottom: 14 }} onClick={addLicenseType} disabled={!newLicenseType.trim()}>Add</button>
        </div>

        {/* Pricing table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, minWidth: 160 }}>License Type</th>
                {DEFAULT_TIERS.map(tier => (
                  <th key={tier} style={{ ...S.th, minWidth: 120, textAlign: 'center' }}>
                    <span style={S.badge(tier === 'Corporate Sponsor' ? '#7b1fa2' : tier === 'Board Member' ? 'var(--warning)' : tier === 'Member' ? 'var(--green-600)' : 'var(--info)')}>{tier}</span>
                  </th>
                ))}
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {allLicenseTypes.map(licType => {
                const isCustom = !DEFAULT_LICENSE_TYPES.includes(licType);
                return (
                  <tr key={licType} style={{ background: isCustom ? 'var(--green-50)' : 'transparent' }}>
                    <td style={{ ...S.td, fontWeight: 600, fontSize: '.88rem' }}>
                      {licType}
                      {isCustom && <span style={{ fontSize: '.72rem', color: 'var(--text-light)', marginLeft: 6 }}>(custom)</span>}
                    </td>
                    {DEFAULT_TIERS.map(tier => (
                      <td key={tier} style={{ ...S.td, textAlign: 'center' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#999', fontSize: '.85rem', pointerEvents: 'none' }}>$</span>
                          <input
                            type="number" step="0.01" min="0"
                            style={{ ...S.input, width: 110, textAlign: 'right', paddingLeft: 22 }}
                            value={getPrice(licType, tier)}
                            onChange={e => setPrice(licType, tier, e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </td>
                    ))}
                    <td style={S.td}>
                      {isCustom && (
                        <button onClick={() => removeLicenseType(licType)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '.8rem', padding: '4px 8px' }}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save button at bottom too for convenience */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
        {saved && <span style={{ color: 'var(--green-600)', fontWeight: 500, fontSize: '.9rem' }}>Settings saved!</span>}
        <button style={S.btn()} onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  APP (Routing + Sidebar)
// ══════════════════════════════════════════════════════════════════════════════
const PAGES = [
  { key: 'dashboard', label: 'Dashboard', icon: '\u25A3' },
  { key: 'members', label: 'Members', icon: '\u263A' },
  { key: 'leads', label: 'Leads', icon: '\u2691' },
  { key: 'contacts', label: 'Contact Log', icon: '\u260E' },
  { key: 'revenue', label: 'Revenue', icon: '\u0024' },
  { key: 'settings', label: 'Settings', icon: '\u2699' },
];

function App() {
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

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
