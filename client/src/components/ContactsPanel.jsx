import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { fmt } from '../format.js';
import { ContactFormModal } from './ContactFormModal.jsx';

const typeIcon = { Phone: '☎', Email: '✉', 'In-Person': '👤', Text: '💬', Mail: '✉', Other: '•' };
const typeBg = { Phone: 'var(--info)', Email: 'var(--green-600)', 'In-Person': '#7b1fa2', Text: 'var(--warning)', Mail: 'var(--green-500)', Other: '#666' };

export function ContactsPanel({ entityType, entityId, entityName }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [logging, setLogging] = useState(null);

  const load = () => {
    setLoading(true);
    api(`/contacts?entityType=${entityType}&entityId=${entityId}`).then(setContacts).finally(() => setLoading(false));
  };

  useEffect(() => { if (entityId) load(); }, [entityType, entityId]);

  const openLog = (type) => {
    setLogging({
      entityType, entityId, entityName,
      contactDate: new Date().toISOString().split('T')[0],
      contactType: type,
      direction: type === 'Email' || type === 'Text' ? 'outbound' : '',
    });
  };

  if (!entityId) return null;

  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: '.92rem', fontWeight: 600, color: 'var(--green-800)' }}>Activity</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Email', 'Text', 'Phone', 'In-Person', 'Other'].map(t => (
            <button key={t} onClick={() => openLog(t)} style={{
              ...S.btn('secondary'), padding: '4px 10px', fontSize: '.75rem',
              background: '#fff', color: 'var(--green-700)', border: '1px solid var(--green-300)',
            }}>+ Log {t === 'Text' ? 'SMS' : t === 'Other' ? 'Other' : t}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: '.85rem', color: 'var(--text-light)' }}>Loading...</div>
      ) : contacts.length === 0 ? (
        <div style={{ fontSize: '.85rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
          No activity logged yet. Use the buttons above to log a contact.
        </div>
      ) : (
        <div>
          {contacts.map(c => {
            const isOpen = expanded[c.id];
            const body = c.summary || '';
            const showExpand = body.length > 120;
            const directionLabel = c.direction === 'inbound' ? 'In' : c.direction === 'outbound' ? 'Out' : null;
            return (
              <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ ...S.badge(typeBg[c.contactType] || 'var(--green-500)'), fontSize: '.68rem' }}>
                    {typeIcon[c.contactType] || '•'} {c.contactType}{directionLabel ? ` · ${directionLabel}` : ''}
                  </span>
                  <span style={{ fontSize: '.78rem', color: 'var(--text-light)' }}>{fmt.date(c.contactDate)}</span>
                </div>
                {c.subject && <div style={{ fontWeight: 600, fontSize: '.88rem', marginTop: 4 }}>{c.subject}</div>}
                {body && (
                  <div style={{ fontSize: '.83rem', color: '#444', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                    {isOpen || !showExpand ? body : body.slice(0, 120) + '…'}
                    {showExpand && (
                      <button onClick={() => setExpanded(p => ({ ...p, [c.id]: !isOpen }))}
                        style={{ background: 'none', border: 'none', color: 'var(--green-700)', cursor: 'pointer', fontSize: '.78rem', marginLeft: 6, padding: 0 }}>
                        {isOpen ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>
                )}
                {c.nextAction && (
                  <div style={{ fontSize: '.8rem', color: 'var(--green-700)', marginTop: 4 }}>
                    → {c.nextAction}{c.nextActionDate ? ` (by ${fmt.date(c.nextActionDate)})` : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {logging && (
        <ContactFormModal
          initial={logging}
          lockEntity
          onClose={() => setLogging(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
