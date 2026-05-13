import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { fmt, sortRecords, nextSortDir } from '../format.js';
import { Modal } from '../components/Modal.jsx';
import { Field } from '../components/Field.jsx';
import { AttachmentsPanel } from '../components/AttachmentsPanel.jsx';
import { ContactsPanel } from '../components/ContactsPanel.jsx';

import { ACTIVE_STAGES, ARCHIVED_STAGES, ALL_STAGES, STAGES, isArchivedStage, stageColor, stageHeaderBg } from '../stages.js';

const LEAD_DEFAULTS = { businessName: '', licenseNo: '', licenseType: '', county: '', ownerName: '', phone: '', email: '', stage: 'New', priority: 'Medium', lastContactDate: '', nextContactDate: '', notes: '' };
export { STAGES, stageColor };
const PRIORITIES = ['Low', 'Medium', 'High'];
const priorityColor = { Low: 'var(--info)', Medium: 'var(--warning)', High: 'var(--danger)' };

export function Leads() {
  const [allLeads, setAllLeads] = useState([]);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [countyFilter, setCountyFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(LEAD_DEFAULTS);
  const [editId, setEditId] = useState(null);
  const [view, setView] = useState('kanban');
  const [dragId, setDragId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    api(`/leads?${params}`).then(setAllLeads).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

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
    // Hide archived leads unless toggle is on OR the user explicitly filtered to an archived stage
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
    setAllLeads(prev => prev.map(l => l.id === id ? { ...l, stage } : l));
    await api(`/leads/${id}`, { method: 'PUT', body: { stage } });
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
    padding: '6px 14px', fontSize: '.85rem', fontWeight: 500, cursor: 'pointer', border: '1px solid var(--green-300)',
    background: view === v ? 'var(--green-700)' : '#fff', color: view === v ? '#fff' : 'var(--green-700)',
    borderRadius: v === 'table' ? '6px 0 0 6px' : '0 6px 6px 0', transition: 'all .15s',
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
        <div style={{ flex: 1, padding: 8, minHeight: 80, overflowY: 'auto' }}>
          {stageLead.map(l => <KanbanCard key={l.id} lead={l} />)}
          {stageLead.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 8px', color: '#aaa', fontSize: '.82rem', fontStyle: 'italic' }}>
              {isOver ? 'Drop here' : 'No leads'}
            </div>
          )}
        </div>
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

      <div style={{ ...S.toolbar, background: 'var(--card)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <select style={S.select} value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
          <option value="">All Stages</option>
          <optgroup label="Active">
            {ACTIVE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </optgroup>
          <optgroup label="Archived">
            {ARCHIVED_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </optgroup>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.85rem', color: 'var(--text-light)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}
            style={{ accentColor: 'var(--green-600)', cursor: 'pointer' }} />
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
          <button onClick={clearLeadFilters} style={{ ...S.btn('secondary'), padding: '6px 12px', fontSize: '.82rem' }}>
            Clear Filters ({activeLeadFilters})
          </button>
        )}
        <span style={{ color: 'var(--text-light)', fontSize: '.85rem', marginLeft: 'auto' }}>
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
              {activeLeadFilters > 0 && <div style={{ marginTop: 8 }}><button onClick={clearLeadFilters} style={{ ...S.btn('secondary'), padding: '6px 14px', fontSize: '.85rem' }}>Clear Filters</button></div>}
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
                      <td style={{ ...S.td, fontWeight: 600 }}>{l.businessName}</td>
                      <td style={S.td}>{l.ownerName || '—'}</td>
                      <td style={S.td}>{l.licenseNo || '—'}</td>
                      <td style={S.td}>{l.county || '—'}</td>
                      <td style={S.td}>
                        <select value={l.stage} onChange={e => updateStage(l.id, e.target.value)} style={{ ...S.select, padding: '3px 8px', fontSize: '.82rem', background: stageColor[l.stage] || 'var(--green-500)', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
                          <optgroup label="Active" style={{ color: '#333', background: '#fff' }}>
                            {ACTIVE_STAGES.map(s => <option key={s} style={{ color: '#333', background: '#fff' }}>{s}</option>)}
                          </optgroup>
                          <optgroup label="Archived" style={{ color: '#333', background: '#fff' }}>
                            {ARCHIVED_STAGES.map(s => <option key={s} style={{ color: '#333', background: '#fff' }}>{s}</option>)}
                          </optgroup>
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
