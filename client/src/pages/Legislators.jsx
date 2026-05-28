import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { fmt, sortRecords, nextSortDir } from '../format.js';
import { Modal } from '../components/Modal.jsx';
import { Field } from '../components/Field.jsx';
import { ContactsPanel } from '../components/ContactsPanel.jsx';
import { AttachmentsPanel } from '../components/AttachmentsPanel.jsx';
import { LegislatorEventsPanel } from '../components/LegislatorEventsPanel.jsx';

const DEFAULTS = {
  name: '',
  slug: '',
  chamber: '',
  district: '',
  party: '',
  score: '',
  grade: '',
  classification: '',
  historicalVoteScore: '',
  summary: '',
  contactLink: '',
  eligibleWeight: '',
  publish: true,
  featured: false,
  voteRecord: {},
  notes: '',
};

const voteColor = {
  SUPPORT: 'var(--color-navy)',
  OPPOSE: 'var(--color-red)',
  ABSENT: 'var(--color-gold)',
  'N/A': 'var(--color-muted)',
};

function gradeColor(grade) {
  if (grade === 'A') return 'var(--color-navy)';
  if (grade === 'B' || grade === 'C') return 'var(--color-gold)';
  if (grade === 'D' || grade === 'F') return 'var(--color-red)';
  return 'var(--color-muted)';
}

function numberOrNull(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

export function Legislators() {
  const [allLegislators, setAllLegislators] = useState([]);
  const [search, setSearch] = useState('');
  const [chamberFilter, setChamberFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(DEFAULTS);
  const [editId, setEditId] = useState(null);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [activeNameId, setActiveNameId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    api(`/legislators?${params}`).then(setAllLegislators).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const openEdit = useCallback((legislator) => {
    setForm({
      ...DEFAULTS,
      ...legislator,
      score: legislator.score ?? '',
      historicalVoteScore: legislator.historicalVoteScore ?? '',
      eligibleWeight: legislator.eligibleWeight ?? '',
      voteRecord: legislator.voteRecord || {},
      publish: legislator.publish !== false,
      featured: legislator.featured === true,
    });
    setEditId(legislator.id);
    setModal('edit');
  }, []);

  useEffect(() => {
    const checkOpen = async () => {
      const raw = sessionStorage.getItem('crm:openRecord');
      if (!raw) return;
      try {
        const { kind, id } = JSON.parse(raw);
        if (kind !== 'legislator') return;
        sessionStorage.removeItem('crm:openRecord');
        const legislator = await api(`/legislators/${id}`);
        openEdit(legislator);
      } catch {}
    };
    checkOpen();
    window.addEventListener('crm:openRecord', checkOpen);
    return () => window.removeEventListener('crm:openRecord', checkOpen);
  }, [openEdit]);

  const chambers = [...new Set(allLegislators.map((l) => l.chamber).filter(Boolean))].sort();
  const parties = [...new Set(allLegislators.map((l) => l.party).filter(Boolean))].sort();
  const classifications = [...new Set(allLegislators.map((l) => l.classification).filter(Boolean))].sort();
  const grades = [...new Set(allLegislators.map((l) => l.grade).filter(Boolean))].sort();

  const filtered = allLegislators.filter((l) => {
    if (chamberFilter && l.chamber !== chamberFilter) return false;
    if (partyFilter && l.party !== partyFilter) return false;
    if (classificationFilter && l.classification !== classificationFilter) return false;
    if (gradeFilter && l.grade !== gradeFilter) return false;
    return true;
  });
  const legislators = sortRecords(filtered, sortBy, sortDir);
  const upcomingEvents = allLegislators.filter((l) => l.nextEventDate).length;
  const strongSupporters = allLegislators.filter((l) => /strong|champion/i.test(l.classification || '')).length;
  const weakInconsistent = allLegislators.filter((l) => /weak|inconsistent/i.test(l.classification || '')).length;
  const activeFilters = [chamberFilter, partyFilter, classificationFilter, gradeFilter].filter(Boolean).length;

  const clearFilters = () => {
    setChamberFilter('');
    setPartyFilter('');
    setClassificationFilter('');
    setGradeFilter('');
  };

  const toggleSort = (key) => {
    setSortDir(nextSortDir(sortBy, sortDir, key));
    setSortBy(key);
  };

  const SortTh = ({ label, sortKey }) => (
    <th style={{ ...S.th, cursor: sortKey ? 'pointer' : 'default', userSelect: 'none' }} onClick={() => sortKey && toggleSort(sortKey)}>
      {label}
      {sortKey && (
        <span style={{ marginLeft: 4, opacity: sortBy === sortKey ? 1 : 0.3, fontSize: '.75rem' }}>
          {sortBy === sortKey ? (sortDir === 'asc' ? '^' : 'v') : '<>'}
        </span>
      )}
    </th>
  );

  const openAdd = () => {
    setForm(DEFAULTS);
    setEditId(null);
    setModal('add');
  };

  const close = () => setModal(null);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const body = {
      ...form,
      score: numberOrNull(form.score),
      historicalVoteScore: numberOrNull(form.historicalVoteScore),
      eligibleWeight: numberOrNull(form.eligibleWeight),
    };
    if (modal === 'add') await api('/legislators', { method: 'POST', body });
    else await api(`/legislators/${editId}`, { method: 'PUT', body });
    close();
    load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this legislator and all linked legislator history?')) return;
    await api(`/legislators/${id}`, { method: 'DELETE' });
    load();
  };

  const Stat = ({ label, value, accent }) => (
    <div style={S.statsCard(accent)}>
      <div style={{ fontSize: '.72rem', color: 'var(--color-muted)', fontFamily: 'var(--font-heading)', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', color: 'var(--color-navy)', fontFamily: 'var(--font-heading)', fontWeight: 900, marginTop: 5 }}>{value}</div>
    </div>
  );

  const VoteRecord = () => {
    const entries = Object.entries(form.voteRecord || {});
    if (entries.length === 0) {
      return <div style={{ fontSize: '.85rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>No vote record available.</div>;
    }
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={S.table}>
          <thead><tr><th style={S.th}>Bill</th><th style={S.th}>Vote</th></tr></thead>
          <tbody>
            {entries.map(([bill, vote]) => {
              const value = String(vote || '').trim() || 'N/A';
              const bg = voteColor[value] || 'var(--color-muted)';
              return (
                <tr key={bill}>
                  <td style={S.td}>{bill}</td>
                  <td style={S.td}>
                    <span style={{ ...S.badge(bg), color: value === 'ABSENT' ? 'var(--color-navy)' : '#fff' }}>{value}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={S.pageTitle}>Legislators</div>
        <button style={S.btn()} onClick={openAdd}>+ Add Legislator</button>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <Stat label="Total Legislators" value={allLegislators.length} accent="var(--color-navy)" />
        <Stat label="Strong / Champion" value={strongSupporters} accent="var(--color-gold)" />
        <Stat label="Weak / Inconsistent" value={weakInconsistent} accent="var(--color-red)" />
        <Stat label="Upcoming Events" value={upcomingEvents} accent="var(--color-navy-hover)" />
      </div>

      <div style={S.toolbar}>
        <input style={{ ...S.input, maxWidth: 320 }} placeholder="Search legislators..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div style={{ ...S.toolbar, background: 'var(--card)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
        <select style={S.select} value={chamberFilter} onChange={(e) => setChamberFilter(e.target.value)}>
          <option value="">All Chambers</option>
          {chambers.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select style={S.select} value={partyFilter} onChange={(e) => setPartyFilter(e.target.value)}>
          <option value="">All Parties</option>
          {parties.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select style={S.select} value={classificationFilter} onChange={(e) => setClassificationFilter(e.target.value)}>
          <option value="">All Classifications</option>
          {classifications.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select style={S.select} value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
          <option value="">All Grades</option>
          {grades.map((value) => <option key={value}>{value}</option>)}
        </select>
        {activeFilters > 0 && <button style={{ ...S.btn('secondary'), padding: '6px 12px' }} onClick={clearFilters}>Clear Filters ({activeFilters})</button>}
        <span style={{ color: 'var(--color-muted)', fontSize: '.85rem', marginLeft: 'auto' }}>
          {legislators.length}{legislators.length !== allLegislators.length ? ` of ${allLegislators.length}` : ''} legislator{legislators.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={S.card}>
        {loading ? <div style={S.emptyState}>Loading...</div> : legislators.length === 0 ? (
          <div style={S.emptyState}>
            {allLegislators.length === 0 ? 'No legislators found. Run the legislator import to load the initial data.' : 'No legislators match your filters.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead><tr>
                <SortTh label="Name" sortKey="name" />
                <SortTh label="Chamber" sortKey="chamber" />
                <SortTh label="District" sortKey="district" />
                <SortTh label="Party" sortKey="party" />
                <SortTh label="Classification" sortKey="classification" />
                <SortTh label="Grade" sortKey="grade" />
                <SortTh label="Score" sortKey="score" />
                <SortTh label="Upcoming Event" sortKey="nextEventDate" />
                <SortTh label="Actions" />
              </tr></thead>
              <tbody>
                {legislators.map((legislator) => (
                  <tr key={legislator.id}>
                    <td style={{ ...S.td, fontWeight: 700, color: 'var(--color-navy)' }}>
                      <button
                        type="button"
                        onClick={() => openEdit(legislator)}
                        onMouseEnter={() => setActiveNameId(legislator.id)}
                        onMouseLeave={() => setActiveNameId((current) => current === legislator.id ? null : current)}
                        onFocus={() => setActiveNameId(legislator.id)}
                        onBlur={() => setActiveNameId((current) => current === legislator.id ? null : current)}
                        style={S.openableName(activeNameId === legislator.id)}
                      >
                        {legislator.name}
                      </button>
                    </td>
                    <td style={S.td}>{legislator.chamber || '-'}</td>
                    <td style={S.td}>{legislator.district || '-'}</td>
                    <td style={S.td}>{legislator.party || '-'}</td>
                    <td style={S.td}>{legislator.classification || '-'}</td>
                    <td style={S.td}>{legislator.grade ? <span style={{ ...S.badge(gradeColor(legislator.grade)), color: legislator.grade === 'B' || legislator.grade === 'C' ? 'var(--color-navy)' : '#fff' }}>{legislator.grade}</span> : '-'}</td>
                    <td style={S.td}>{legislator.score ?? '-'}</td>
                    <td style={S.td}>
                      {legislator.nextEventDate ? (
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--color-navy)' }}>{fmt.date(dateOnly(legislator.nextEventDate))}</div>
                          <div style={{ fontSize: '.78rem', color: 'var(--color-muted)' }}>{legislator.nextEventTitle}</div>
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                      <button style={{ ...S.btn('secondary'), padding: '4px 10px', marginRight: 6 }} onClick={() => openEdit(legislator)}>Edit</button>
                      <button style={{ ...S.btn('danger'), padding: '4px 10px' }} onClick={() => remove(legislator.id)}>Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Legislator' : 'Edit Legislator'} onClose={close}>
          <div style={S.formGrid}>
            <Field label="Name *"><input style={S.input} value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Slug"><input style={S.input} value={form.slug || ''} onChange={(e) => set('slug', e.target.value)} /></Field>
            <Field label="Chamber">
              <select style={{ ...S.select, width: '100%' }} value={form.chamber || ''} onChange={(e) => set('chamber', e.target.value)}>
                <option value="">Select...</option>
                <option>House</option>
                <option>Senate</option>
              </select>
            </Field>
            <Field label="District"><input style={S.input} value={form.district || ''} onChange={(e) => set('district', e.target.value)} /></Field>
            <Field label="Party"><input style={S.input} value={form.party || ''} onChange={(e) => set('party', e.target.value)} /></Field>
            <Field label="Classification"><input style={S.input} value={form.classification || ''} onChange={(e) => set('classification', e.target.value)} /></Field>
            <Field label="Grade"><input style={S.input} value={form.grade || ''} onChange={(e) => set('grade', e.target.value)} /></Field>
            <Field label="Score"><input style={S.input} type="number" step="0.01" value={form.score} onChange={(e) => set('score', e.target.value)} /></Field>
            <Field label="Historical Vote Score"><input style={S.input} type="number" step="0.01" value={form.historicalVoteScore} onChange={(e) => set('historicalVoteScore', e.target.value)} /></Field>
            <Field label="Eligible Weight"><input style={S.input} type="number" step="0.01" value={form.eligibleWeight} onChange={(e) => set('eligibleWeight', e.target.value)} /></Field>
          </div>
          <Field label="Contact Link"><input style={S.input} value={form.contactLink || ''} onChange={(e) => set('contactLink', e.target.value)} /></Field>
          <div style={{ display: 'flex', gap: 18, marginBottom: 14 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--color-muted)', fontSize: '.85rem' }}>
              <input type="checkbox" checked={form.publish} onChange={(e) => set('publish', e.target.checked)} style={{ accentColor: 'var(--color-gold)' }} />
              Publish
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--color-muted)', fontSize: '.85rem' }}>
              <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} style={{ accentColor: 'var(--color-gold)' }} />
              Featured
            </label>
          </div>
          <Field label="Summary"><textarea style={{ ...S.input, minHeight: 90, resize: 'vertical' }} value={form.summary || ''} onChange={(e) => set('summary', e.target.value)} /></Field>
          <Field label="Internal Notes"><textarea style={{ ...S.input, minHeight: 70, resize: 'vertical' }} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-divider)' }}>
            <div style={{ fontSize: '.92rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: 10 }}>Vote Record</div>
            <VoteRecord />
          </div>
          {modal === 'edit' && <LegislatorEventsPanel legislatorId={editId} />}
          {modal === 'edit' && <ContactsPanel entityType="legislator" entityId={editId} entityName={form.name} />}
          {modal === 'edit' && <AttachmentsPanel entityType="legislator" entityId={editId} />}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button style={S.btn('secondary')} onClick={close}>Cancel</button>
            <button style={S.btn()} onClick={save} disabled={!form.name?.trim()}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
