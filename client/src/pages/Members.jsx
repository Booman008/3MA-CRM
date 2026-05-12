import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { fmt, renewalStatus } from '../format.js';
import { Modal } from '../components/Modal.jsx';
import { Field } from '../components/Field.jsx';
import { AttachmentsPanel } from '../components/AttachmentsPanel.jsx';
import { ContactsPanel } from '../components/ContactsPanel.jsx';

const MEMBER_DEFAULTS = { businessName: '', licenseNo: '', licenseType: '', county: '', ownerName: '', phone: '', email: '', joinDate: '', renewalDate: '', duesAmount: '', membershipTier: '', notes: '' };
const LICENSE_TYPES = ['Dispensary', 'Cultivator Facility', 'Micro-Cultivation', 'Processing Facility', 'Micro-Processing', 'Transportation Entity', 'Testing Facility', 'Disposal Entity', 'Ancillary', 'Practitioner'];
const EMPTY_LICENSE_ROW = { number: '', type: '' };

function parseLicenses(licenseNo) {
  if (!licenseNo) return [{ ...EMPTY_LICENSE_ROW }];
  try {
    const parsed = JSON.parse(licenseNo);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(l => ({ number: l.number || '', type: l.type || '' }));
  } catch {}
  const parts = licenseNo.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length > 0) return parts.map(n => ({ number: n, type: '' }));
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

const RENEWAL_FILTERS = [
  { value: '', label: 'All Renewal Status' },
  { value: 'pastDue', label: 'Past Due' },
  { value: 'urgent', label: 'Within 30 Days' },
  { value: 'upcoming', label: 'Within 60 Days' },
  { value: 'ok', label: 'Current (60+ Days)' },
  { value: 'none', label: 'No Renewal Date' },
];

export function Members() {
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

  const licenseTypes = [...new Set(allMembers.flatMap(m => parseLicenseTypes(m.licenseNo)).filter(Boolean))].sort();
  const counties = [...new Set(allMembers.map(m => m.county).filter(Boolean))].sort();

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

  const setLicenseField = (idx, field, val) => setLicenseRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: val } : row));
  const addLicenseRow = () => setLicenseRows(prev => [...prev, { ...EMPTY_LICENSE_ROW }]);
  const removeLicenseRow = (idx) => setLicenseRows(prev => prev.filter((_, i) => i !== idx));

  const save = async () => {
    const licenses = licenseRows.filter(r => r.number.trim() || r.type);
    const licenseNo = licenses.length > 0 ? JSON.stringify(licenses) : null;
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

      <div style={S.toolbar}>
        <input style={{ ...S.input, maxWidth: 320 }} placeholder="Search by name, license, email..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

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
