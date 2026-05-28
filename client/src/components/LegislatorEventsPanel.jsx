import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { fmt } from '../format.js';
import { Modal } from './Modal.jsx';
import { Field } from './Field.jsx';

const EVENT_DEFAULTS = {
  title: '',
  eventDate: new Date().toISOString().split('T')[0],
  startTime: '',
  location: '',
  topic: '',
  organizer: '',
  status: 'planned',
  notes: '',
};

const STATUS_OPTIONS = [
  ['planned', 'Planned'],
  ['confirmed', 'Confirmed'],
  ['completed', 'Completed'],
  ['canceled', 'Canceled'],
];

const statusColor = {
  planned: 'var(--color-navy)',
  confirmed: 'var(--color-gold)',
  completed: 'var(--color-muted)',
  canceled: 'var(--color-red)',
};

function normalizeDate(value) {
  return value ? String(value).slice(0, 10) : '';
}

export function LegislatorEventsPanel({ legislatorId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EVENT_DEFAULTS);
  const [editId, setEditId] = useState(null);

  const load = () => {
    setLoading(true);
    api(`/legislators/${legislatorId}/events`).then(setEvents).finally(() => setLoading(false));
  };

  useEffect(() => { if (legislatorId) load(); }, [legislatorId]);

  const openAdd = () => {
    setForm(EVENT_DEFAULTS);
    setEditId(null);
    setModal('add');
  };

  const openEdit = (event) => {
    setForm({ ...EVENT_DEFAULTS, ...event, eventDate: normalizeDate(event.eventDate) });
    setEditId(event.id);
    setModal('edit');
  };

  const close = () => setModal(null);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (modal === 'add') await api(`/legislators/${legislatorId}/events`, { method: 'POST', body: form });
    else await api(`/legislators/${legislatorId}/events/${editId}`, { method: 'PUT', body: form });
    close();
    load();
  };

  const remove = async (event) => {
    if (!confirm('Delete this legislator event?')) return;
    await api(`/legislators/${legislatorId}/events/${event.id}`, { method: 'DELETE' });
    load();
  };

  if (!legislatorId) return null;

  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-divider)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
        <div style={{ fontSize: '.92rem', fontWeight: 700, color: 'var(--color-navy)' }}>Speaking Events</div>
        <button style={{ ...S.btn('secondary'), padding: '5px 12px', fontSize: '.78rem' }} onClick={openAdd}>+ Add Event</button>
      </div>

      {loading ? (
        <div style={{ fontSize: '.85rem', color: 'var(--color-muted)' }}>Loading...</div>
      ) : events.length === 0 ? (
        <div style={{ fontSize: '.85rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>No speaking events tracked yet.</div>
      ) : (
        <div>
          {events.map((event) => (
            <div key={event.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--color-divider)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 92, fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--color-navy)', fontSize: '.82rem' }}>
                {fmt.date(normalizeDate(event.eventDate))}
                {event.startTime && <div style={{ fontSize: '.72rem', color: 'var(--color-muted)', fontWeight: 600, marginTop: 2 }}>{event.startTime}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => openEdit(event)} style={{ ...S.openableName(false), fontWeight: 700, color: 'var(--color-navy)' }}>
                    {event.title}
                  </button>
                  <span style={{ ...S.badge(statusColor[event.status] || 'var(--color-muted)'), color: event.status === 'confirmed' ? 'var(--color-navy)' : '#fff' }}>
                    {(STATUS_OPTIONS.find(([value]) => value === event.status) || [null, event.status])[1]}
                  </span>
                </div>
                {[event.topic, event.location, event.organizer].filter(Boolean).length > 0 && (
                  <div style={{ fontSize: '.8rem', color: 'var(--color-muted)', marginTop: 3 }}>
                    {[event.topic, event.location, event.organizer].filter(Boolean).join(' | ')}
                  </div>
                )}
                {event.notes && <div style={{ fontSize: '.82rem', color: 'var(--color-dark-gray)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{event.notes}</div>}
              </div>
              <button style={{ ...S.btn('danger'), padding: '3px 8px', fontSize: '.68rem' }} onClick={() => remove(event)}>Del</button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal === 'add' ? 'Add Speaking Event' : 'Edit Speaking Event'} onClose={close}>
          <Field label="Title *"><input style={S.input} value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <div style={S.formGrid}>
            <Field label="Event Date *"><input style={S.input} type="date" value={form.eventDate} onChange={(e) => set('eventDate', e.target.value)} /></Field>
            <Field label="Start Time"><input style={S.input} value={form.startTime || ''} onChange={(e) => set('startTime', e.target.value)} placeholder="e.g. 10:30 AM" /></Field>
            <Field label="Location"><input style={S.input} value={form.location || ''} onChange={(e) => set('location', e.target.value)} /></Field>
            <Field label="Topic"><input style={S.input} value={form.topic || ''} onChange={(e) => set('topic', e.target.value)} /></Field>
            <Field label="Organizer"><input style={S.input} value={form.organizer || ''} onChange={(e) => set('organizer', e.target.value)} /></Field>
            <Field label="Status">
              <select style={{ ...S.select, width: '100%' }} value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notes"><textarea style={{ ...S.input, minHeight: 70, resize: 'vertical' }} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button style={S.btn('secondary')} onClick={close}>Cancel</button>
            <button style={S.btn()} onClick={save} disabled={!form.title?.trim() || !form.eventDate}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
