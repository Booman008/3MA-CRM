import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { fmt, sortRecords, nextSortDir } from '../format.js';
import { Modal } from '../components/Modal.jsx';
import { Field } from '../components/Field.jsx';
import { AttachmentsPanel } from '../components/AttachmentsPanel.jsx';
import { ContactsPanel } from '../components/ContactsPanel.jsx';
import { LogoUploader } from '../components/LogoUploader.jsx';
import {
  ACTIVE_STAGES, ARCHIVED_STAGES, ALL_STAGES, STAGES,
  isArchivedStage, stageColor, stageHeaderBg, stageNeedsDarkText,
} from '../stages.js';
import { useSettings } from '../useSettings.js';
import { getAllLicenseTypes } from '../licenseTypes.js';
import {
  EMPTY_LICENSE_ROW,
  LICENSE_STATUS_OPTIONS,
  firstLicenseType,
  parseLicenseRows,
  serializeLicenseRows,
} from '../licenses.js';

const LEAD_DEFAULTS = {
  businessName: '', licenseNo: '', licenseType: '', county: '',
  ownerName: '', phone: '', email: '',
  stage: 'New', priority: 'Medium',
  lastContactDate: '', nextContactDate: '', notes: '',
  logoAttachmentId: null, logoUrl: null,
};
export { STAGES, stageColor };
const PRIORITIES = ['Low', 'Medium', 'High'];

const priorityColor = {
  Low: 'var(--color-navy)',
  Medium: 'var(--color-gold)',
  High: 'var(--color-red)',
};

function licenseSummary(licenseNo) {
  const rows = parseLicenseRows(licenseNo).filter(row => row.number || row.type || row.county || row.name);
  if (rows.length === 0) return '—';
  if (rows.length === 1) return rows[0].number || rows[0].name || rows[0].type || '—';
  const first = rows[0].number || rows[0].name || rows[0].type || 'License';
  return `${first} +${rows.length - 1} more`;
}

export function Leads() {
  const settings = useSettings();
  const licenseTypeOptions = getAllLicenseTypes(settings);

  const [allLeads, setAllLeads] = useState([]);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [countyFilter, setCountyFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(LEAD_DEFAULTS);
  const [licenseRows, setLicenseRows] = useState([{ ...EMPTY_LICENSE_ROW }]);
  const [editId, setEditId] = useState(null);
  const [view, setView] = useState('kanban');
  const [dragId, setDragId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [showArchived, setShowArchived] = useState(false);
  const [activeNameKey, setActiveNameKey] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    api(`/leads?${params}`).then(setAllLeads).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  useEffect(() => {
    if (dragId == null) return;
    const scroller = document.querySelector('main');
    if (!scroller) return;
    const EDGE = 90;
    const MAX_SPEED = 22;
    let pointerY = 0;
    let hasPointer = false;
    let frame = null;
    const tick = () => {
      if (hasPointer) {
        const h = scroller.clientHeight;
        let dy = 0;
        if (pointerY < EDGE) dy = -MAX_SPEED * (1 - pointerY / EDGE);
        else if (pointerY > h - EDGE) dy = MAX_SPEED * (1 - (h - pointerY) / EDGE);
        if (dy !== 0) scroller.scrollBy(0, dy);
      }
      frame = requestAnimationFrame(tick);
    };
    const onDrag = (e) => { pointerY = e.clientY; hasPointer = true; };
    window.addEventListener('dragover', onDrag);
    frame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('dragover', onDrag);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [dragId]);

  useEffect(() => {
    const checkOpen = async () => {
      const raw = sessionStorage.getItem('crm:openRecord');
      if (!raw) return;
      try {
        const { kind, id } = JSON.parse(raw);
        if (kind !== 'lead') return;
        sessionStorage.removeItem('crm:openRecord');
        const l = await api(`/leads/${id}`);
        openEdit(l);
      } catch {}
    };
    checkOpen();
    window.addEventListener('crm:openRecord', checkOpen);
    return () => window.removeEventListener('crm:openRecord', checkOpen);
  }, []);

  const leadCounties = [...new Set(allLeads.map(l => l.county).filter(Boolean))].sort();

  const archivedCount = allLeads.filter(l => isArchivedStage(l.stage)).length;
  const filteredLeads = allLeads.filter(l => {
    if (!showArchived && isArchivedStage(l.stage) && stageFilter !== l.stage) return false;
    if (stageFilter && l.stage !== stageFilter) return false;
    if (priorityFilter && l.priority !== priorityFilter) return false;
    if (countyFilter && l.county !== countyFilter) return false;
    return true;
  });
  const leads = view === 'table' ? sortRecords(filteredLeads, sortBy, sortDir) : filteredLeads;
  const visibleKanbanStages = showArchived ? ALL_STAGES : ACTIVE_STAGES;

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

  const activeLeadFilters = [stageFilter, priorityFilter, countyFilter].filter(Boolean).length;
  const clearLeadFilters = () => { setStageFilter(''); setPriorityFilter(''); setCountyFilter(''); };

  const openAdd = (presetStage) => {
    setForm({ ...LEAD_DEFAULTS, stage: presetStage || 'New' });
    setLicenseRows([{ ...EMPTY_LICENSE_ROW }]);
    setEditId(null); setModal('add');
  };
  const openEdit = (l) => {
    setForm({ ...LEAD_DEFAULTS, ...l });
    setLicenseRows(parseLicenseRows(l.licenseNo));
    setEditId(l.id);
    setModal('edit');
  };
  const close = () => setModal(null);

  const save = async () => {
    const licenseNo = serializeLicenseRows(licenseRows);
    const primaryCounty = form.county || (licenseRows.find(l => l.county) || {}).county || null;
    const body = {
      ...form,
      county: primaryCounty,
      licenseNo,
      licenseType: firstLicenseType(licenseNo),
    };
    if (modal === 'add') await api('/leads', { method: 'POST', body });
    else await api(`/leads/${editId}`, { method: 'PUT', body });
    close(); load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this lead?')) return;
    await api(`/leads/${id}`, { method: 'DELETE' });
    load();
  };

  const updateStage = async (id, stage) => {
    setAllLeads(prev => prev.map(l => l.id === id ? { ...l, stage } : l));
    await api(`/leads/${id}`, { method: 'PUT', body: { stage } });
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setLicenseField = (idx, field, val) => setLicenseRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: val } : row));
  const addLicenseRow = () => setLicenseRows(prev => [...prev, { ...EMPTY_LICENSE_ROW }]);
  const removeLicenseRow = (idx) => setLicenseRows(prev => prev.filter((_, i) => i !== idx));

  const onDragStart = (e, leadId) => {
    setDragId(leadId);
    e.dataTransfer.effectAllowed = 'move';
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

  const viewBtn = (v) => ({
    padding: '7px 16px',
    fontFamily: 'var(--font-heading)',
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    border: '1px solid var(--color-divider)',
    background: view === v ? 'var(--color-navy)' : '#fff',
    color: view === v ? '#fff' : 'var(--color-navy)',
    borderRadius: v === 'table' ? '6px 0 0 6px' : '0 6px 6px 0',
    transition: 'all .15s',
  });

  const KanbanCard = ({ lead }) => {
    const isDragging = dragId === lead.id;
    return (
      <div
        draggable
        onDragStart={e => onDragStart(e, lead.id)}
        onDragEnd={onDragEnd}
        onClick={() => openEdit(lead)}
        style={{
          background: '#fff', borderRadius: 6, padding: '12px 13px', marginBottom: 8,
          boxShadow: isDragging ? 'var(--shadow-md)' : '0 1px 2px rgba(7,31,64,0.06)',
          cursor: 'grab', transition: 'box-shadow .15s, transform .15s',
          transform: isDragging ? 'rotate(2deg) scale(1.02)' : 'none',
          borderLeft: `3px solid ${priorityColor[lead.priority] || 'var(--color-gold)'}`,
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
        onMouseLeave={e => { if (!isDragging) e.currentTarget.style.boxShadow = '0 1px 2px rgba(7,31,64,0.06)'; }}
      >
        <div
          style={{
            ...S.openableName(activeNameKey === `kanban-${lead.id}`),
            display: 'inline-block',
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '0.82rem',
            marginBottom: 4,
          }}
          onMouseEnter={() => setActiveNameKey(`kanban-${lead.id}`)}
          onMouseLeave={() => setActiveNameKey(current => current === `kanban-${lead.id}` ? null : current)}
        >
          {lead.businessName}
        </div>
        {lead.ownerName && <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: 8 }}>{lead.ownerName}</div>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ ...S.badge(priorityColor[lead.priority] || 'var(--color-gold)'), color: lead.priority === 'Medium' ? 'var(--color-navy)' : '#fff' }}>{lead.priority}</span>
          {lead.county && <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{lead.county}</span>}
        </div>
        {lead.nextContactDate && (
          <div style={{ fontSize: '0.74rem', color: 'var(--color-muted)', marginTop: 8, paddingTop: 7, borderTop: '1px dashed var(--color-divider)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Next contact</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--color-navy)' }}>{fmt.date(lead.nextContactDate)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); remove(lead.id); }}
            style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', fontSize: '0.7rem', padding: '2px 4px', opacity: 0.6, fontFamily: 'var(--font-heading)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}
            onMouseEnter={e => e.target.style.opacity = '1'} onMouseLeave={e => e.target.style.opacity = '0.6'}>
            Del
          </button>
        </div>
      </div>
    );
  };

  const KanbanColumn = ({ stage }) => {
    const stageLead = leads.filter(l => l.stage === stage);
    const isOver = dragOverStage === stage;
    return (
      <div
        onDragOver={e => onDragOver(e, stage)}
        onDragLeave={onDragLeave}
        onDrop={e => onDrop(e, stage)}
        style={{
          flex: '1 1 0', minWidth: 220, maxWidth: 300, display: 'flex', flexDirection: 'column',
          background: isOver ? 'var(--color-callout-gold-bg)' : 'var(--color-light-gray)',
          borderRadius: 10, transition: 'background .2s, box-shadow .2s',
          boxShadow: isOver ? 'inset 0 0 0 2px var(--color-gold)' : 'none',
          border: '1px solid var(--color-divider)',
        }}
      >
        <div style={{
          padding: '11px 14px', borderRadius: '10px 10px 0 0',
          background: stageHeaderBg[stage] || 'var(--color-light-gray)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: `2px solid ${stageColor[stage] || 'var(--color-gold)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: stageColor[stage], display: 'inline-block' }} />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-navy)' }}>{stage}</span>
          </div>
          <span style={{
            background: '#fff', color: 'var(--color-navy)', borderRadius: 999, padding: '2px 9px',
            fontFamily: 'var(--font-heading)', fontSize: '0.7rem', fontWeight: 800, minWidth: 24, textAlign: 'center',
            border: '1px solid var(--color-divider)',
          }}>{stageLead.length}</span>
        </div>
        <div style={{ flex: 1, padding: 10, minHeight: 80, overflowY: 'auto' }}>
          {stageLead.map(l => <KanbanCard key={l.id} lead={l} />)}
          {stageLead.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--color-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>
              {isOver ? 'Drop here' : 'No leads'}
            </div>
          )}
        </div>
        <div style={{ padding: '0 10px 10px' }}>
          <button onClick={() => openAdd(stage)} style={{
            width: '100%', padding: '8px', background: 'transparent', border: '1px dashed var(--color-divider)',
            borderRadius: 6, cursor: 'pointer', color: 'var(--color-muted)',
            fontFamily: 'var(--font-heading)', fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            transition: 'border-color .15s, color .15s',
          }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--color-gold)'; e.target.style.color = 'var(--color-navy)'; }}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--color-divider)'; e.target.style.color = 'var(--color-muted)'; }}>
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
          <div>
            <button style={viewBtn('table')} onClick={() => setView('table')}>Table</button>
            <button style={viewBtn('kanban')} onClick={() => setView('kanban')}>Kanban</button>
          </div>
          <button style={S.btn()} onClick={() => openAdd()}>+ Add Lead</button>
        </div>
      </div>

      <div style={S.toolbar}>
        <input style={{ ...S.input, maxWidth: 280 }} placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ ...S.toolbar, background: 'var(--card)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
        <select style={S.select} value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
          <option value="">All Stages</option>
          <optgroup label="Active">
            {ACTIVE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </optgroup>
          <optgroup label="Archived">
            {ARCHIVED_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </optgroup>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.85rem', color: 'var(--color-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}
            style={{ accentColor: 'var(--color-gold)', cursor: 'pointer' }} />
          Show archived{archivedCount > 0 ? ` (${archivedCount})` : ''}
        </label>
        <select style={S.select} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        <select style={S.select} value={countyFilter} onChange={e => setCountyFilter(e.target.value)}>
          <option value="">All Counties</option>
          {leadCounties.map(c => <option key={c}>{c}</option>)}
        </select>
        {activeLeadFilters > 0 && (
          <button onClick={clearLeadFilters} style={{ ...S.btn('secondary'), padding: '6px 12px' }}>
            Clear Filters ({activeLeadFilters})
          </button>
        )}
        <span style={{ color: 'var(--color-muted)', fontSize: '0.82rem', marginLeft: 'auto' }}>
          {leads.length}{leads.length !== allLeads.length ? ` of ${allLeads.length}` : ''} lead{leads.length !== 1 ? 's' : ''}
        </span>
      </div>

      {view === 'kanban' && (
        loading ? <div style={S.emptyState}>Loading...</div> : (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
            {visibleKanbanStages.map(stage => <KanbanColumn key={stage} stage={stage} />)}
          </div>
        )
      )}

      {view === 'table' && (
        <div style={S.card}>
          {loading ? <div style={S.emptyState}>Loading...</div> : leads.length === 0 ? (
            <div style={S.emptyState}>
              {allLeads.length === 0 ? 'No leads found. Add your first lead to get started.' : 'No leads match your filters.'}
              {activeLeadFilters > 0 && <div style={{ marginTop: 8 }}><button onClick={clearLeadFilters} style={{ ...S.btn('secondary'), padding: '6px 14px' }}>Clear Filters</button></div>}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead><tr>
                  <SortTh label="Business Name" sortKey="businessName" />
                  <SortTh label="Owner" sortKey="ownerName" />
                  <SortTh label="License #" sortKey="licenseNo" />
                  <SortTh label="County" sortKey="county" />
                  <SortTh label="Stage" sortKey="stage" />
                  <SortTh label="Priority" sortKey="priority" />
                  <SortTh label="Next Contact" sortKey="nextContactDate" />
                  <SortTh label="Actions" />
                </tr></thead>
                <tbody>
                  {leads.map(l => (
                    <tr key={l.id}>
                      <td style={{ ...S.td, fontWeight: 700, color: 'var(--color-navy)' }}>
                        <button
                          type="button"
                          onClick={() => openEdit(l)}
                          onMouseEnter={() => setActiveNameKey(`table-${l.id}`)}
                          onMouseLeave={() => setActiveNameKey(current => current === `table-${l.id}` ? null : current)}
                          onFocus={() => setActiveNameKey(`table-${l.id}`)}
                          onBlur={() => setActiveNameKey(current => current === `table-${l.id}` ? null : current)}
                          style={S.openableName(activeNameKey === `table-${l.id}`)}
                          title={`Open ${l.businessName}`}
                        >
                          {l.businessName}
                        </button>
                      </td>
                      <td style={S.td}>{l.ownerName || '—'}</td>
                      <td style={S.td}>{licenseSummary(l.licenseNo)}</td>
                      <td style={S.td}>{l.county || '—'}</td>
                      <td style={S.td}>
                        <select value={l.stage} onChange={e => updateStage(l.id, e.target.value)} style={{
                          ...S.select, padding: '4px 10px',
                          fontFamily: 'var(--font-heading)', fontSize: '0.68rem', fontWeight: 800,
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                          background: stageColor[l.stage] || 'var(--color-gold)',
                          color: stageNeedsDarkText(l.stage) ? 'var(--color-navy)' : '#fff',
                          border: 'none', borderRadius: 999, cursor: 'pointer',
                        }}>
                          <optgroup label="Active" style={{ color: '#333', background: '#fff' }}>
                            {ACTIVE_STAGES.map(s => <option key={s} style={{ color: '#333', background: '#fff' }}>{s}</option>)}
                          </optgroup>
                          <optgroup label="Archived" style={{ color: '#333', background: '#fff' }}>
                            {ARCHIVED_STAGES.map(s => <option key={s} style={{ color: '#333', background: '#fff' }}>{s}</option>)}
                          </optgroup>
                        </select>
                      </td>
                      <td style={S.td}><span style={{ ...S.badge(priorityColor[l.priority] || 'var(--color-gold)'), color: l.priority === 'Medium' ? 'var(--color-navy)' : '#fff' }}>{l.priority}</span></td>
                      <td style={S.td}>{fmt.date(l.nextContactDate)}</td>
                      <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                        <button style={{ ...S.btn('secondary'), padding: '4px 10px', marginRight: 6 }} onClick={() => openEdit(l)}>Edit</button>
                        <button style={{ ...S.btn('danger'), padding: '4px 10px' }} onClick={() => remove(l.id)}>Del</button>
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
          {modal === 'edit' && (
            <LogoUploader
              entityType="lead"
              entityId={editId}
              entityName={form.businessName}
              logoUrl={form.logoUrl}
              onChange={(updated) => setForm(f => ({ ...f, ...updated }))}
            />
          )}
          <div style={S.formGrid}>
            <Field label="Business Name *"><input style={S.input} value={form.businessName} onChange={e => set('businessName', e.target.value)} /></Field>
            <Field label="Owner Name"><input style={S.input} value={form.ownerName} onChange={e => set('ownerName', e.target.value)} /></Field>
            <Field label="County"><input style={S.input} value={form.county} onChange={e => set('county', e.target.value)} /></Field>
            <Field label="Phone"><input style={S.input} value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
            <Field label="Email"><input style={S.input} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
            <Field label="Stage">
              <select style={{ ...S.select, width: '100%' }} value={form.stage} onChange={e => set('stage', e.target.value)}>
                <optgroup label="Active">
                  {ACTIVE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </optgroup>
                <optgroup label="Archived">
                  {ARCHIVED_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </optgroup>
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
          <div style={S.formRow}>
            <label style={S.label}>Licenses</label>
            <div style={{ fontSize: '.78rem', color: 'var(--color-muted)', marginBottom: 8 }}>
              Leads can also track multiple licenses, names, and active/inactive status.
            </div>
            {licenseRows.map((row, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.05fr 1.05fr 0.9fr 1.1fr 0.78fr 24px', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <input style={S.input} value={row.number} onChange={e => setLicenseField(idx, 'number', e.target.value)} placeholder={`License #${idx + 1}`} />
                <select style={S.select} value={row.type} onChange={e => setLicenseField(idx, 'type', e.target.value)}>
                  <option value="">License Type...</option>
                  {licenseTypeOptions.map(t => <option key={t}>{t}</option>)}
                </select>
                <input style={S.input} value={row.county} onChange={e => setLicenseField(idx, 'county', e.target.value)} placeholder="County" />
                <input style={S.input} value={row.name} onChange={e => setLicenseField(idx, 'name', e.target.value)} placeholder="License Name" />
                <select style={S.select} value={row.status} onChange={e => setLicenseField(idx, 'status', e.target.value)}>
                  {LICENSE_STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
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
          <Field label="Notes"><textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
          {modal === 'edit' && <ContactsPanel entityType="lead" entityId={editId} entityName={form.businessName} />}
          {modal === 'edit' && <AttachmentsPanel entityType="lead" entityId={editId} />}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button style={S.btn('secondary')} onClick={close}>Cancel</button>
            <button style={S.btn()} onClick={save} disabled={!form.businessName}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
