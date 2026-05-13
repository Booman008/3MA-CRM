import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { fmt, renewalStatus, sortRecords, nextSortDir } from '../format.js';
import { Modal } from '../components/Modal.jsx';
import { Field } from '../components/Field.jsx';
import { AttachmentsPanel } from '../components/AttachmentsPanel.jsx';
import { ContactsPanel } from '../components/ContactsPanel.jsx';
import { ImportModal } from '../components/ImportModal.jsx';
import { useSettings } from '../useSettings.js';
import { getAllLicenseTypes } from '../licenseTypes.js';

const MEMBER_DEFAULTS = {
  businessName: '', licenseNo: '', licenseType: '', county: '',
  ownerName: '', phone: '', email: '',
  joinDate: '', renewalDate: '', duesAmount: '', membershipTier: '', notes: '',
};
// Each license row now carries its own county so operators with sites in
// multiple counties (e.g. Kudzu Cannabis — dispensaries in Meridian and
// Jackson, cultivation in Vicksburg) can be represented accurately.
const EMPTY_LICENSE_ROW = { number: '', type: '', county: '' };

function parseLicenses(licenseNo) {
  if (!licenseNo) return [{ ...EMPTY_LICENSE_ROW }];
  try {
    const parsed = JSON.parse(licenseNo);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(l => ({
        number: l.number || '',
        type: l.type || '',
        county: l.county || '',
      }));
    }
  } catch {}
  const parts = licenseNo.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length > 0) return parts.map(n => ({ number: n, type: '', county: '' }));
  return [{ ...EMPTY_LICENSE_ROW }];
}

export function parseLicenseTypes(licenseNo) {
  if (!licenseNo) return [];
  try {
    const parsed = JSON.parse(licenseNo);
    if (Array.isArray(parsed)) return parsed.map(l => l.type).filter(Boolean);
  } catch {}
  return [];
}

export function parseLicenseNumbers(licenseNo) {
  if (!licenseNo) return [];
  try {
    const parsed = JSON.parse(licenseNo);
    if (Array.isArray(parsed)) return parsed.map(l => l.number).filter(Boolean);
  } catch {}
  return licenseNo.split(',').map(s => s.trim()).filter(Boolean);
}

// Return every county tagged on a member's licenses (deduped, in order).
export function parseLicenseCounties(licenseNo) {
  if (!licenseNo) return [];
  try {
    const parsed = JSON.parse(licenseNo);
    if (Array.isArray(parsed)) {
      const out = [];
      for (const l of parsed) {
        const c = (l.county || '').trim();
        if (c && !out.includes(c)) out.push(c);
      }
      return out;
    }
  } catch {}
  return [];
}

// All counties associated with a member: per-license counties plus the
// primary `county` field as fallback/billing county.
export function allCountiesFor(member) {
  const fromLicenses = parseLicenseCounties(member.licenseNo);
  if (fromLicenses.length === 0) return member.county ? [member.county] : [];
  if (member.county && !fromLicenses.includes(member.county)) {
    return [member.county, ...fromLicenses];
  }
  return fromLicenses;
}

const RENEWAL_FILTERS = [
  { value: '', label: 'All Renewal Status' },
  { value: 'pastDue', label: 'Past Due' },
  { value: 'urgent', label: 'Within 30 Days' },
  { value: 'upcoming', label: 'Within 60 Days' },
  { value: 'ok', label: 'Current (60+ Days)' },
  { value: 'none', label: 'No Renewal Date' },
];

export function Members() {
  const settings = useSettings();
  const licenseTypeOptions = getAllLicenseTypes(settings);

  const [allMembers, setAllMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [licenseTypeFilter, setLicenseTypeFilter] = useState('');
  const [countyFilter, setCountyFilter] = useState('');
  const [renewalFilter, setRenewalFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(MEMBER_DEFAULTS);
  const [editId, setEditId] = useState(null);
  const [licenseRows, setLicenseRows] = useState([{ ...EMPTY_LICENSE_ROW }]);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api(`/members?search=${encodeURIComponent(search)}`).then(setAllMembers).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  useEffect(() => {
    const checkOpen = async () => {
      const raw = sessionStorage.getItem('crm:openRecord');
      if (!raw) return;
      try {
        const { kind, id } = JSON.parse(raw);
        if (kind !== 'member') return;
        sessionStorage.removeItem('crm:openRecord');
        const m = await api(`/members/${id}`);
        openEdit(m);
      } catch {}
    };
    checkOpen();
    window.addEventListener('crm:openRecord', checkOpen);
    return () => window.removeEventListener('crm:openRecord', checkOpen);
  }, []);

  const licenseTypesInUse = [...new Set(allMembers.flatMap(m => parseLicenseTypes(m.licenseNo)).filter(Boolean))].sort();
  // County filter draws from per-license counties + primary county.
  const counties = [...new Set(allMembers.flatMap(allCountiesFor).filter(Boolean))].sort();

  const filteredMembers = allMembers.filter(m => {
    if (licenseTypeFilter && !parseLicenseTypes(m.licenseNo).includes(licenseTypeFilter)) return false;
    if (countyFilter && !allCountiesFor(m).includes(countyFilter)) return false;
    if (renewalFilter) {
      const rs = renewalStatus(m.renewalDate);
      if (renewalFilter === 'urgent') { if (rs.status !== 'urgent') return false; }
      else if (renewalFilter === 'upcoming') { if (rs.status !== 'upcoming' && rs.status !== 'urgent') return false; }
      else if (rs.status !== renewalFilter) return false;
    }
    return true;
  });
  const members = sortRecords(filteredMembers, sortBy, sortDir);

  const toggleSort = (key) => {
    setSortDir(nextSortDir(sortBy, sortDir, key));
    setSortBy(key);
  };
  const SortTh = ({ label, sortKey }) => (
    <th style={{ ...S.th, cursor: sortKey ? 'pointer' : 'default', userSelect: 'none' }} onClick={() => sortKey && toggleSort(sortKey)}>
      {label}
      {sortKey && (
        <span style={{ marginLeft: 4, opacity: sortBy === sortKey ? 1 : 0.3, fontSize: '.75rem' }}>
          {sortBy === sortKey ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      )}
    </th>
  );

  const activeFilterCount = [licenseTypeFilter, countyFilter, renewalFilter].filter(Boolean).length;
  const clearFilters = () => { setLicenseTypeFilter(''); setCountyFilter(''); setRenewalFilter(''); };

  const openAdd = () => { setForm(MEMBER_DEFAULTS); setLicenseRows([{ ...EMPTY_LICENSE_ROW }]); setEditId(null); setModal('add'); };
  const openEdit = (m) => {
    setForm({ ...MEMBER_DEFAULTS, ...m, duesAmount: m.duesAmount ?? '' });
    setLicenseRows(parseLicenses(m.licenseNo));
    setEditId(m.id); setModal('edit');
  };
  const close = () => setModal(null);

  const setLicenseField = (idx, field, val) => setLicenseRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: val } : row));
  const addLicenseRow = () => setLicenseRows(prev => [...prev, { ...EMPTY_LICENSE_ROW }]);
  const removeLicenseRow = (idx) => setLicenseRows(prev => prev.filter((_, i) => i !== idx));

  const save = async () => {
    const licenses = licenseRows.filter(r => r.number.trim() || r.type || r.county);
    const licenseNo = licenses.length > 0 ? JSON.stringify(licenses) : null;
    const licenseType = licenses.length > 0 ? licenses[0].type : null;
    // If the operator left the primary County blank but tagged each
    // license, use the first license's county as the billing/primary one.
    const primaryCounty = form.county || (licenses.find(l => l.county) || {}).county || null;
    const body = {
      ...form,
      county: primaryCounty,
      licenseNo,
      licenseType,
      duesAmount: form.duesAmount !== '' ? Number(form.duesAmount) : null,
    };
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

  // Display all license-type values used across members + any operator-defined
  // ones, so the filter dropdown reflects what's currently in the data.
  const filterTypeOptions = [...new Set([...licenseTypeOptions, ...licenseTypesInUse])];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={S.pageTitle}>Members</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btn('secondary')} onClick={() => setShowImport(true)}>Import CSV</button>
          <button style={S.btn()} onClick={openAdd}>+ Add Member</button>
        </div>
      </div>

      <div style={S.toolbar}>
        <input style={{ ...S.input, maxWidth: 320 }} placeholder="Search by name, license, email..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ ...S.toolbar, background: 'var(--card)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
        <select style={S.select} value={licenseTypeFilter} onChange={e => setLicenseTypeFilter(e.target.value)}>
          <option value="">All License Types</option>
          {filterTypeOptions.map(t => <option key={t}>{t}</option>)}
        </select>
        <select style={S.select} value={countyFilter} onChange={e => setCountyFilter(e.target.value)}>
          <option value="">All Counties</option>
          {counties.map(c => <option key={c}>{c}</option>)}
        </select>
        <select style={{
          ...S.select,
          ...(renewalFilter === 'pastDue' ? { borderColor: 'var(--color-red)', color: 'var(--color-red)' }
             : renewalFilter === 'urgent' ? { borderColor: 'var(--color-gold)', color: 'var(--color-navy)' }
             : {}),
        }} value={renewalFilter} onChange={e => setRenewalFilter(e.target.value)}>
          {RENEWAL_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} style={{ ...S.btn('secondary'), padding: '6px 12px' }}>
            Clear Filters ({activeFilterCount})
          </button>
        )}
        <span style={{ color: 'var(--color-muted)', fontSize: '.85rem', marginLeft: 'auto' }}>
          {members.length}{members.length !== allMembers.length ? ` of ${allMembers.length}` : ''} member{members.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={S.card}>
        {loading ? <div style={S.emptyState}>Loading...</div> : members.length === 0 ? (
          <div style={S.emptyState}>
            {allMembers.length === 0 ? 'No members found. Add your first member to get started.' : 'No members match your filters.'}
            {activeFilterCount > 0 && <div style={{ marginTop: 8 }}><button onClick={clearFilters} style={{ ...S.btn('secondary'), padding: '6px 14px' }}>Clear Filters</button></div>}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead><tr>
                <SortTh label="Business Name" sortKey="businessName" />
                <SortTh label="Owner" sortKey="ownerName" />
                <SortTh label="License #" />
                <SortTh label="Type" sortKey="licenseType" />
                <SortTh label="County" sortKey="county" />
                <SortTh label="Tier" sortKey="membershipTier" />
                <SortTh label="Dues" sortKey="duesAmount" />
                <SortTh label="Renewal" sortKey="renewalDate" />
                <SortTh label="Actions" />
              </tr></thead>
              <tbody>
                {members.map(m => {
                  const rs = renewalStatus(m.renewalDate);
                  const licenses = (() => {
                    try { const p = JSON.parse(m.licenseNo); return Array.isArray(p) ? p : null; } catch { return null; }
                  })();
                  const nums = parseLicenseNumbers(m.licenseNo);
                  const types = parseLicenseTypes(m.licenseNo);
                  const memberCounties = allCountiesFor(m);
                  return (
                  <tr key={m.id} style={{ cursor: 'pointer', background: rs.bgColor, transition: 'background .15s' }} onDoubleClick={() => openEdit(m)}>
                    <td style={{ ...S.td, fontWeight: 700, color: 'var(--color-navy)' }}>{m.businessName}</td>
                    <td style={S.td}>{m.ownerName || '—'}</td>
                    <td style={S.td}>
                      {licenses && licenses.length
                        ? licenses.map((l, i) => (
                            <div key={i} style={{ lineHeight: 1.5, fontSize: '.85rem' }}>
                              {l.number || '—'}
                              {l.county && <span style={{ color: 'var(--color-muted)', marginLeft: 6, fontSize: '.78rem' }}>· {l.county}</span>}
                            </div>
                          ))
                        : (nums.length ? nums.map((n, i) => <div key={i} style={{ lineHeight: 1.5, fontSize: '.85rem' }}>{n}</div>) : '—')}
                    </td>
                    <td style={S.td}>{types.length ? types.map((t, i) => <div key={i} style={{ lineHeight: 1.5, fontSize: '.85rem' }}>{t}</div>) : (m.licenseType || '—')}</td>
                    <td style={S.td}>
                      {memberCounties.length === 0 ? '—'
                        : memberCounties.length === 1 ? memberCounties[0]
                        : (
                          <div style={{ lineHeight: 1.4 }}>
                            <div style={{ fontWeight: 600, color: 'var(--color-navy)' }}>{memberCounties.length} counties</div>
                            <div style={{ fontSize: '.78rem', color: 'var(--color-muted)' }}>{memberCounties.join(', ')}</div>
                          </div>
                        )}
                    </td>
                    <td style={S.td}>{m.membershipTier ? <span style={{ ...S.badge('var(--color-navy)'), color: '#fff' }}>{m.membershipTier}</span> : '—'}</td>
                    <td style={{ ...S.td, fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--color-navy)' }}>{fmt.currency(m.duesAmount)}</td>
                    <td style={S.td}>
                      <span style={{ color: rs.color, fontWeight: rs.status !== 'ok' && rs.status !== 'none' ? 600 : 400 }}>{fmt.date(m.renewalDate)}</span>
                      {rs.label && <span style={{ ...S.badge(rs.badgeBg), marginLeft: 8 }}>{rs.label}</span>}
                    </td>
                    <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                      <button style={{ ...S.btn('secondary'), padding: '4px 10px', marginRight: 6 }} onClick={() => openEdit(m)}>Edit</button>
                      <button style={{ ...S.btn('danger'), padding: '4px 10px' }} onClick={() => remove(m.id)}>Del</button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); load(); }} />}

      {modal && (
        <Modal title={modal === 'add' ? 'Add Member' : 'Edit Member'} onClose={close}>
          <div style={S.formGrid}>
            <Field label="Business Name *"><input style={S.input} value={form.businessName} onChange={e => set('businessName', e.target.value)} /></Field>
            <Field label="Owner Name"><input style={S.input} value={form.ownerName} onChange={e => set('ownerName', e.target.value)} /></Field>
          </div>
          <div style={S.formRow}>
            <label style={S.label}>Licenses</label>
            <div style={{ fontSize: '.78rem', color: 'var(--color-muted)', marginBottom: 8 }}>
              Add a row for each license this business holds. Counties can differ —
              e.g. dispensaries in one county and cultivation in another.
            </div>
            {licenseRows.map((row, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 24px', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <input style={S.input} value={row.number} onChange={e => setLicenseField(idx, 'number', e.target.value)} placeholder={`License #${idx + 1}`} />
                <select style={S.select} value={row.type} onChange={e => setLicenseField(idx, 'type', e.target.value)}>
                  <option value="">License Type...</option>
                  {licenseTypeOptions.map(t => <option key={t}>{t}</option>)}
                </select>
                <input style={S.input} value={row.county} onChange={e => setLicenseField(idx, 'county', e.target.value)} placeholder="County" />
                {idx > 0 ? (
                  <button type="button" onClick={() => removeLicenseRow(idx)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, padding: '2px 6px', lineHeight: 1, flexShrink: 0 }}
                    title="Remove this license">&times;</button>
                ) : (
                  <span style={{ width: 22, flexShrink: 0 }} />
                )}
              </div>
            ))}
            <button type="button" onClick={addLicenseRow}
              style={{
                background: 'none', border: 'none', color: 'var(--color-navy)', cursor: 'pointer',
                fontFamily: 'var(--font-heading)', fontSize: '.7rem', fontWeight: 800,
                letterSpacing: '.08em', textTransform: 'uppercase', padding: '4px 0', marginTop: 2,
              }}>
              + Add License #
            </button>
          </div>
          <div style={S.formGrid}>
            <Field label="Primary County (billing)"><input style={S.input} value={form.county} onChange={e => set('county', e.target.value)} placeholder="Optional — defaults to first license's county" /></Field>
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
          {modal === 'edit' && <ContactsPanel entityType="member" entityId={editId} entityName={form.businessName} />}
          {modal === 'edit' && <AttachmentsPanel entityType="member" entityId={editId} />}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button style={S.btn('secondary')} onClick={close}>Cancel</button>
            <button style={S.btn()} onClick={save} disabled={!form.businessName}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
