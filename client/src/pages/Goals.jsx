import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { fmt } from '../format.js';
import { Modal } from '../components/Modal.jsx';
import { Field } from '../components/Field.jsx';

const CATEGORY_META = {
  fundraising: { label: 'Fundraising',  color: '#0d7a3a', unit: 'currency', auto: true  },
  membership:  { label: 'Membership',   color: '#1f4d8a', unit: 'count',    auto: true  },
  conversions: { label: 'Conversions',  color: '#7a3aa6', unit: 'count',    auto: true  },
  custom:      { label: 'Custom',       color: '#a36b1a', unit: 'count',    auto: false },
};

const FILTERS = [
  { key: 'all',         label: 'All Active' },
  { key: 'fundraising', label: 'Fundraising' },
  { key: 'membership',  label: 'Membership' },
  { key: 'conversions', label: 'Conversions' },
  { key: 'custom',      label: 'Custom' },
  { key: 'archived',    label: 'Archived' },
];

const DEFAULT_FORM = {
  category: 'fundraising',
  title: '',
  description: '',
  targetValue: '',
  manualValue: '',
  startDate: '',
  endDate: '',
  status: 'active',
};

function formatValue(category, value) {
  if (CATEGORY_META[category]?.unit === 'currency') return fmt.currency(value);
  return Number(value || 0).toLocaleString('en-US');
}

function daysBetween(fromISO, toISO) {
  if (!fromISO || !toISO) return null;
  const from = new Date(fromISO + 'T00:00:00');
  const to = new Date(toISO + 'T00:00:00');
  if (isNaN(from) || isNaN(to)) return null;
  return Math.round((to - from) / 86400000);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // null | 'new' | goal object
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/goals');
      setGoals(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'archived') return goals.filter(g => g.status === 'archived');
    const active = goals.filter(g => g.status !== 'archived');
    if (filter === 'all') return active;
    return active.filter(g => g.category === filter);
  }, [goals, filter]);

  const openCreate = () => {
    const today = todayISO();
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);
    const endDefault = oneYear.toISOString().slice(0, 10);
    setForm({ ...DEFAULT_FORM, startDate: today, endDate: endDefault });
    setEditing('new');
  };

  const openEdit = (goal) => {
    setForm({
      category: goal.category,
      title: goal.title || '',
      description: goal.description || '',
      targetValue: String(goal.targetValue ?? ''),
      manualValue: String(goal.manualValue ?? ''),
      startDate: goal.startDate ? String(goal.startDate).slice(0, 10) : '',
      endDate: goal.endDate ? String(goal.endDate).slice(0, 10) : '',
      status: goal.status || 'active',
    });
    setEditing(goal);
  };

  const closeModal = () => { setEditing(null); setForm(DEFAULT_FORM); };

  const save = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.targetValue || Number(form.targetValue) <= 0) { setError('Target value must be greater than 0'); return; }
    if (!form.startDate || !form.endDate) { setError('Start and end dates are required'); return; }
    if (form.startDate > form.endDate) { setError('Start date must be before end date'); return; }

    setSaving(true);
    setError('');
    try {
      const body = {
        category: form.category,
        title: form.title.trim(),
        description: form.description || null,
        targetValue: Number(form.targetValue),
        manualValue: form.category === 'custom' ? Number(form.manualValue || 0) : 0,
        startDate: form.startDate,
        endDate: form.endDate,
        status: form.status,
      };
      if (editing === 'new') {
        await api('/goals', { method: 'POST', body });
      } else {
        await api(`/goals/${editing.id}`, { method: 'PUT', body });
      }
      closeModal();
      await load();
    } catch (e) {
      setError(e.message || 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  const updateManualValue = async (goal, newValue) => {
    const value = Number(newValue);
    if (!Number.isFinite(value) || value < 0) return;
    try {
      await api(`/goals/${goal.id}`, { method: 'PUT', body: { manualValue: value } });
      await load();
    } catch (e) {
      setError(e.message || 'Failed to update progress');
    }
  };

  const remove = async (goal) => {
    try {
      await api(`/goals/${goal.id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setError(e.message || 'Failed to delete goal');
    }
  };

  return (
    <div style={S.main}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={S.pageTitle}>Goals</div>
        <button style={S.btn('primary')} onClick={openCreate}>+ New Goal</button>
      </div>

      <div style={S.toolbar}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              ...S.btn(filter === f.key ? 'navy' : 'secondary'),
              padding: '7px 14px',
              fontSize: '0.68rem',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: '#fde2e2', color: '#a11d1d', padding: '10px 14px', borderRadius: 6, marginBottom: 14, fontSize: '0.88rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={S.emptyState}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={S.emptyState}>
          No goals yet. Click <strong>+ New Goal</strong> to set your first target.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filtered.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => openEdit(goal)}
              onDelete={() => setConfirmDelete(goal)}
              onManualUpdate={(v) => updateManualValue(goal, v)}
            />
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing === 'new' ? 'New Goal' : 'Edit Goal'} onClose={closeModal}>
          <GoalForm form={form} setForm={setForm} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <button style={S.btn('secondary')} onClick={closeModal} disabled={saving}>Cancel</button>
            <button style={S.btn('primary')} onClick={save} disabled={saving}>
              {saving ? 'Saving…' : (editing === 'new' ? 'Create Goal' : 'Save Changes')}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete Goal" onClose={() => setConfirmDelete(null)}>
          <div style={{ marginBottom: 18 }}>
            Delete <strong>{confirmDelete.title}</strong>? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button style={S.btn('secondary')} onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button style={S.btn('danger')} onClick={() => remove(confirmDelete)}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function GoalCard({ goal, onEdit, onDelete, onManualUpdate }) {
  const meta = CATEGORY_META[goal.category] || CATEGORY_META.custom;
  const pct = Math.max(0, Math.min(100, Number(goal.progressPct || 0)));
  const remaining = daysBetween(todayISO(), goal.endDate);
  const isOverdue = remaining != null && remaining < 0;
  const isArchived = goal.status === 'archived';

  const [manualInput, setManualInput] = useState(String(goal.manualValue ?? ''));
  useEffect(() => { setManualInput(String(goal.manualValue ?? '')); }, [goal.manualValue]);

  const submitManual = () => {
    if (manualInput === '' || Number(manualInput) === Number(goal.manualValue || 0)) return;
    onManualUpdate(manualInput);
  };

  return (
    <div style={{ ...S.statsCard(meta.color), opacity: isArchived ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div>
          <span style={S.badge(meta.color)}>{meta.label}</span>
          {isArchived && <span style={{ ...S.badge('#888'), marginLeft: 6 }}>Archived</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ ...S.btn('secondary'), padding: '5px 10px', fontSize: '0.62rem' }} onClick={onEdit}>Edit</button>
          <button style={{ ...S.btn('danger'),    padding: '5px 10px', fontSize: '0.62rem' }} onClick={onDelete}>Delete</button>
        </div>
      </div>

      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1rem', color: 'var(--color-navy)', marginBottom: 4 }}>
        {goal.title}
      </div>

      {goal.description && (
        <div style={{ color: 'var(--color-muted)', fontSize: '0.84rem', marginBottom: 8 }}>
          {goal.description}
        </div>
      )}

      <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: 10 }}>
        {fmt.date(String(goal.startDate).slice(0, 10))} → {fmt.date(String(goal.endDate).slice(0, 10))}
        {remaining != null && !isArchived && (
          <span style={{ marginLeft: 8, color: isOverdue ? 'var(--color-red)' : 'var(--color-muted)' }}>
            ({isOverdue ? `${Math.abs(remaining)}d overdue` : `${remaining}d left`})
          </span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1rem', color: 'var(--color-navy)' }}>
          {formatValue(goal.category, goal.currentValue)}
        </span>
        <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
          of {formatValue(goal.category, goal.targetValue)} ({pct.toFixed(1)}%)
        </span>
      </div>

      <div style={{ background: 'var(--color-light-gray)', borderRadius: 999, height: 10, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: meta.color, borderRadius: 999, transition: 'width .4s' }} />
      </div>

      {goal.category === 'custom' && !isArchived && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ ...S.label, marginBottom: 0 }}>Update progress</label>
          <input
            type="number"
            min="0"
            step="any"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onBlur={submitManual}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            style={{ ...S.input, width: 120 }}
          />
        </div>
      )}
    </div>
  );
}

function GoalForm({ form, setForm }) {
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const isCustom = form.category === 'custom';
  const meta = CATEGORY_META[form.category];

  return (
    <>
      <div style={S.formGrid}>
        <Field label="Category">
          <select style={S.select} value={form.category} onChange={set('category')}>
            {Object.entries(CATEGORY_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select style={S.select} value={form.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
      </div>

      <Field label="Title">
        <input style={S.input} value={form.title} onChange={set('title')} placeholder="e.g. Raise $50K by end of fiscal year" />
      </Field>

      <Field label="Description (optional)">
        <textarea
          style={{ ...S.input, minHeight: 60, resize: 'vertical' }}
          value={form.description}
          onChange={set('description')}
        />
      </Field>

      <div style={S.formGrid}>
        <Field label={meta?.unit === 'currency' ? 'Target ($)' : 'Target (count)'}>
          <input type="number" min="0" step="any" style={S.input} value={form.targetValue} onChange={set('targetValue')} />
        </Field>
        {isCustom && (
          <Field label="Current Progress">
            <input type="number" min="0" step="any" style={S.input} value={form.manualValue} onChange={set('manualValue')} />
          </Field>
        )}
      </div>

      <div style={S.formGrid}>
        <Field label="Start Date">
          <input type="date" style={S.input} value={form.startDate} onChange={set('startDate')} />
        </Field>
        <Field label="End Date">
          <input type="date" style={S.input} value={form.endDate} onChange={set('endDate')} />
        </Field>
      </div>

      {meta?.auto && (
        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 4 }}>
          Progress for {meta.label.toLowerCase()} goals is calculated automatically from members created within the date window.
        </div>
      )}
    </>
  );
}
