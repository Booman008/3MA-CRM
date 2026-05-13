import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { fmt } from '../format.js';
import { Modal } from '../components/Modal.jsx';
import { Field } from '../components/Field.jsx';

const TASK_DEFAULTS = { title: '', description: '', dueDate: '', priority: 'Medium', entityType: '', entityId: '', entityName: '' };
const PRIORITIES = ['Low', 'Medium', 'High'];

// Brand priority colours.
const priorityColor = {
  Low:    'var(--color-navy)',
  Medium: 'var(--color-gold)',
  High:   'var(--color-red)',
};

const FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'open', label: 'All Open' },
  { value: 'done', label: 'Done' },
  { value: '', label: 'All' },
];

function dueStatus(dueDate, completed) {
  if (!dueDate || completed) return { color: 'inherit', label: null };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { color: 'var(--color-red)', label: `${Math.abs(diff)}d overdue`, badgeBg: 'var(--color-red)' };
  if (diff === 0) return { color: 'var(--color-navy)', label: 'Today', badgeBg: 'var(--color-gold)' };
  if (diff <= 3) return { color: 'var(--color-navy)', label: `${diff}d`, badgeBg: 'var(--color-gold)' };
  return { color: 'inherit', label: null };
}

export function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(TASK_DEFAULTS);
  const [editId, setEditId] = useState(null);
  const [entities, setEntities] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    api(`/tasks?${params}`).then(setTasks).finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const loadEntities = () => {
    Promise.all([api('/members'), api('/leads')]).then(([m, l]) => {
      setEntities([
        ...m.map(x => ({ id: x.id, type: 'member', name: x.businessName })),
        ...l.map(x => ({ id: x.id, type: 'lead', name: x.businessName })),
      ]);
    });
  };

  const openAdd = () => {
    setForm({ ...TASK_DEFAULTS, dueDate: new Date().toISOString().split('T')[0] });
    setEditId(null); setModal('add'); loadEntities();
  };
  const openEdit = (t) => {
    setForm({ ...TASK_DEFAULTS, ...t, entityType: t.entityType || '', entityId: t.entityId || '', entityName: t.entityName || '' });
    setEditId(t.id); setModal('edit'); loadEntities();
  };
  const close = () => setModal(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const pickEntity = (val) => {
    if (!val) { setForm(f => ({ ...f, entityType: '', entityId: '', entityName: '' })); return; }
    const [type, id] = val.split(':');
    const ent = entities.find(e => e.type === type && e.id === Number(id));
    setForm(f => ({ ...f, entityType: type, entityId: Number(id), entityName: ent ? ent.name : '' }));
  };

  const save = async () => {
    const body = { ...form, entityId: form.entityId || null, entityType: form.entityType || null };
    if (modal === 'add') await api('/tasks', { method: 'POST', body });
    else await api(`/tasks/${editId}`, { method: 'PUT', body });
    close(); load();
  };

  const toggleDone = async (task) => {
    await api(`/tasks/${task.id}`, { method: 'PUT', body: { completed: !task.completed } });
    load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this task?')) return;
    await api(`/tasks/${id}`, { method: 'DELETE' });
    load();
  };

  const jumpToEntity = (task) => {
    if (!task.entityType || !task.entityId) return;
    sessionStorage.setItem('crm:openRecord', JSON.stringify({ kind: task.entityType, id: task.entityId }));
    location.hash = task.entityType === 'member' ? 'members' : 'leads';
    window.dispatchEvent(new Event('crm:openRecord'));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={S.pageTitle}>Tasks &amp; Reminders</div>
        <button style={S.btn()} onClick={openAdd}>+ Add Task</button>
      </div>

      {/* Tab-style filter row (brand: navy text, gold underline on active) */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-divider)', marginBottom: 18 }}>
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)} style={{
            padding: '10px 18px', cursor: 'pointer', background: 'transparent', border: 'none',
            fontFamily: 'var(--font-heading)', fontSize: '0.72rem', fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: filter === f.value ? 'var(--color-navy)' : 'var(--color-muted)',
            borderBottom: `3px solid ${filter === f.value ? 'var(--color-gold)' : 'transparent'}`,
            marginBottom: -1,
            transition: 'color .15s, border-color .15s',
          }}>{f.label}</button>
        ))}
        <span style={{ marginLeft: 'auto', alignSelf: 'center', color: 'var(--color-muted)', fontSize: '0.82rem' }}>
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={S.card}>
        {loading ? <div style={S.emptyState}>Loading...</div> : tasks.length === 0 ? (
          <div style={S.emptyState}>No tasks. Click "+ Add Task" to create one.</div>
        ) : (
          <div>
            {tasks.map(t => {
              const ds = dueStatus(t.dueDate, t.completed);
              return (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 4px', borderBottom: '1px solid var(--color-divider)',
                  opacity: t.completed ? 0.55 : 1,
                }}>
                  <input type="checkbox" checked={t.completed} onChange={() => toggleDone(t)}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--color-gold)' }} />
                  <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => openEdit(t)}>
                    <div style={{
                      fontSize: '0.92rem', fontWeight: 600, color: 'var(--color-navy)',
                      textDecoration: t.completed ? 'line-through' : 'none',
                      opacity: t.completed ? 0.6 : 1,
                    }}>{t.title}</div>
                    {(t.description || t.entityName) && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 2 }}>
                        {t.entityName && (
                          <span style={{ color: 'var(--color-navy)', cursor: 'pointer', marginRight: 8, fontWeight: 600 }}
                            onClick={e => { e.stopPropagation(); jumpToEntity(t); }}>
                            ↗ {t.entityName}
                          </span>
                        )}
                        {t.description && <span>{t.description.slice(0, 80)}{t.description.length > 80 ? '…' : ''}</span>}
                      </div>
                    )}
                  </div>
                  <span style={{ ...S.badge(priorityColor[t.priority] || 'var(--color-gold)'), color: t.priority === 'Medium' ? 'var(--color-navy)' : '#fff' }}>{t.priority}</span>
                  <div style={{ minWidth: 110, textAlign: 'right' }}>
                    {t.dueDate && (
                      <>
                        <div style={{ fontSize: '0.8rem', color: ds.color, fontWeight: ds.label ? 700 : 400 }}>{fmt.date(t.dueDate)}</div>
                        {ds.label && <span style={{ ...S.badge(ds.badgeBg), marginTop: 2, color: ds.badgeBg === 'var(--color-gold)' ? 'var(--color-navy)' : '#fff' }}>{ds.label}</span>}
                      </>
                    )}
                  </div>
                  <button onClick={() => remove(t.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', fontSize: '0.7rem', opacity: 0.6, fontFamily: 'var(--font-heading)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}
                    onMouseEnter={e => e.target.style.opacity = '1'} onMouseLeave={e => e.target.style.opacity = '0.6'}>
                    Del
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Task' : 'Edit Task'} onClose={close}>
          <Field label="Title *">
            <input style={S.input} value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
          </Field>
          <Field label="Description">
            <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={form.description || ''} onChange={e => set('description', e.target.value)} />
          </Field>
          <div style={S.formGrid}>
            <Field label="Due Date">
              <input style={S.input} type="date" value={form.dueDate || ''} onChange={e => set('dueDate', e.target.value)} />
            </Field>
            <Field label="Priority">
              <select style={{ ...S.select, width: '100%' }} value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Link to Member or Lead (optional)">
            <select style={{ ...S.select, width: '100%' }}
              value={form.entityId ? `${form.entityType}:${form.entityId}` : ''}
              onChange={e => pickEntity(e.target.value)}>
              <option value="">— None —</option>
              {entities.filter(e => e.type === 'member').length > 0 && <optgroup label="Members">
                {entities.filter(e => e.type === 'member').map(e => <option key={`m${e.id}`} value={`member:${e.id}`}>{e.name}</option>)}
              </optgroup>}
              {entities.filter(e => e.type === 'lead').length > 0 && <optgroup label="Leads">
                {entities.filter(e => e.type === 'lead').map(e => <option key={`l${e.id}`} value={`lead:${e.id}`}>{e.name}</option>)}
              </optgroup>}
            </select>
          </Field>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button style={S.btn('secondary')} onClick={close}>Cancel</button>
            <button style={S.btn()} onClick={save} disabled={!form.title?.trim()}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
