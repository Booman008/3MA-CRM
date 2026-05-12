import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { Modal } from './Modal.jsx';
import { Field } from './Field.jsx';

export const CONTACT_TYPES = ['Phone', 'Email', 'In-Person', 'Text', 'Mail', 'Other'];

const DEFAULTS = {
  entityType: '', entityId: '', entityName: '',
  contactDate: new Date().toISOString().split('T')[0],
  contactType: 'Phone',
  subject: '', direction: '', summary: '',
  nextAction: '', nextActionDate: '',
};

const titleForType = (t) => ({ Email: 'Log Email', Text: 'Log SMS', Phone: 'Log Call', 'In-Person': 'Log Meeting', Mail: 'Log Mail', Other: 'Log Contact' }[t] || 'Log Contact');

export function ContactFormModal({ onClose, onSaved, initial = {}, lockEntity = false }) {
  const [form, setForm] = useState({ ...DEFAULTS, ...initial });
  const [entities, setEntities] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lockEntity) return;
    Promise.all([api('/members'), api('/leads')]).then(([m, l]) => {
      setEntities([
        ...m.map(x => ({ id: x.id, type: 'member', name: x.businessName })),
        ...l.map(x => ({ id: x.id, type: 'lead', name: x.businessName })),
      ]);
    });
  }, [lockEntity]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const pickEntity = (val) => {
    if (!val) { setForm(f => ({ ...f, entityType: '', entityId: '', entityName: '' })); return; }
    const [type, id] = val.split(':');
    const ent = entities.find(e => e.type === type && e.id === Number(id));
    setForm(f => ({ ...f, entityType: type, entityId: Number(id), entityName: ent ? ent.name : '' }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api('/contacts', { method: 'POST', body: form });
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const showSubject = form.contactType === 'Email';
  const showDirection = form.contactType === 'Email' || form.contactType === 'Text' || form.contactType === 'Phone' || form.contactType === 'Mail';
  const bodyLabel = form.contactType === 'Email' ? 'Email Body' : form.contactType === 'Text' ? 'Message' : 'Notes';

  return (
    <Modal title={titleForType(form.contactType)} onClose={onClose}>
      {!lockEntity && (
        <Field label="Member or Lead *">
          <select style={{ ...S.select, width: '100%' }}
            value={form.entityId ? `${form.entityType}:${form.entityId}` : ''}
            onChange={e => pickEntity(e.target.value)}>
            <option value="">Select...</option>
            {entities.filter(e => e.type === 'member').length > 0 && <optgroup label="Members">
              {entities.filter(e => e.type === 'member').map(e => <option key={`m${e.id}`} value={`member:${e.id}`}>{e.name}</option>)}
            </optgroup>}
            {entities.filter(e => e.type === 'lead').length > 0 && <optgroup label="Leads">
              {entities.filter(e => e.type === 'lead').map(e => <option key={`l${e.id}`} value={`lead:${e.id}`}>{e.name}</option>)}
            </optgroup>}
          </select>
        </Field>
      )}

      {lockEntity && form.entityName && (
        <div style={{ marginBottom: 14, padding: '6px 10px', background: 'var(--green-50)', borderRadius: 6, fontSize: '.85rem' }}>
          <strong>{form.entityName}</strong> <span style={{ color: 'var(--text-light)' }}>({form.entityType})</span>
        </div>
      )}

      <div style={S.formGrid}>
        <Field label="Date *"><input style={S.input} type="date" value={form.contactDate} onChange={e => set('contactDate', e.target.value)} /></Field>
        <Field label="Type">
          <select style={{ ...S.select, width: '100%' }} value={form.contactType} onChange={e => set('contactType', e.target.value)}>
            {CONTACT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
      </div>

      {showDirection && (
        <Field label="Direction">
          <div style={{ display: 'flex', gap: 6 }}>
            {[['outbound', form.contactType === 'Email' ? 'Sent' : form.contactType === 'Phone' ? 'Outgoing' : 'Sent'],
              ['inbound', form.contactType === 'Email' ? 'Received' : form.contactType === 'Phone' ? 'Incoming' : 'Received']].map(([val, label]) => (
              <button key={val} type="button" onClick={() => set('direction', form.direction === val ? '' : val)} style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid var(--green-300)',
                background: form.direction === val ? 'var(--green-700)' : '#fff',
                color: form.direction === val ? '#fff' : 'var(--green-700)',
                cursor: 'pointer', fontSize: '.85rem',
              }}>{label}</button>
            ))}
          </div>
        </Field>
      )}

      {showSubject && (
        <Field label="Subject"><input style={S.input} value={form.subject || ''} onChange={e => set('subject', e.target.value)} placeholder="Email subject line" /></Field>
      )}

      <Field label={bodyLabel}>
        <textarea style={{ ...S.input, minHeight: form.contactType === 'Email' ? 140 : 80, resize: 'vertical', fontFamily: 'inherit' }}
          value={form.summary || ''} onChange={e => set('summary', e.target.value)}
          placeholder={form.contactType === 'Email' ? 'Paste the email body or write notes about it...' : 'Notes about the conversation...'} />
      </Field>

      <div style={S.formGrid}>
        <Field label="Next Action"><input style={S.input} value={form.nextAction || ''} onChange={e => set('nextAction', e.target.value)} placeholder="e.g. Follow up about pricing" /></Field>
        <Field label="Next Action Date"><input style={S.input} type="date" value={form.nextActionDate || ''} onChange={e => set('nextActionDate', e.target.value)} /></Field>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
        <button style={S.btn('secondary')} onClick={onClose}>Cancel</button>
        <button style={S.btn()} onClick={save} disabled={saving || !form.entityId || !form.contactDate}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}
