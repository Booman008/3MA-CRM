import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { fmt } from '../format.js';
import { ContactFormModal } from '../components/ContactFormModal.jsx';

const typeIcon = { Phone: '☎', Email: '✉', 'In-Person': '👤', Text: '💬', Mail: '✉', Other: '•' };
const typeBg = { Phone: 'var(--info)', Email: 'var(--green-600)', 'In-Person': '#7b1fa2', Text: 'var(--warning)', Mail: 'var(--green-500)', Other: '#666' };

export function ContactLog() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [expanded, setExpanded] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    api(`/contacts?search=${encodeURIComponent(search)}`).then(setLogs).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const remove = async (id) => {
    if (!confirm('Delete this contact log entry?')) return;
    await api(`/contacts/${id}`, { method: 'DELETE' });
    load();
  };

  const jumpToEntity = (c) => {
    if (!c.entityType || !c.entityId) return;
    sessionStorage.setItem('crm:openRecord', JSON.stringify({ kind: c.entityType, id: c.entityId }));
    location.hash = c.entityType === 'member' ? 'members' : 'leads';
    window.dispatchEvent(new Event('crm:openRecord'));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={S.pageTitle}>Contact Log</div>
        <button style={S.btn()} onClick={() => setModal(true)}>+ Log Contact</button>
      </div>

      <div style={S.toolbar}>
        <input style={{ ...S.input, maxWidth: 320 }} placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
        <span style={{ color: 'var(--text-light)', fontSize: '.85rem' }}>{logs.length} entr{logs.length !== 1 ? 'ies' : 'y'}</span>
      </div>

      {loading ? <div style={S.emptyState}>Loading...</div> : logs.length === 0 ? <div style={{ ...S.card, ...S.emptyState }}>No contact log entries yet.</div> : (
        <div>
          {logs.map(c => {
            const isOpen = expanded[c.id];
            const body = c.summary || '';
            const showExpand = body.length > 200;
            const directionLabel = c.direction === 'inbound' ? 'Received' : c.direction === 'outbound' ? 'Sent' : null;
            return (
              <div key={c.id} style={{ ...S.card, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: c.entityType === 'member' ? 'var(--green-100)' : '#e3f2fd',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem', flexShrink: 0,
                }}>{typeIcon[c.contactType] || '•'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <strong style={{ cursor: c.entityId ? 'pointer' : 'default', color: c.entityId ? 'var(--green-800)' : 'inherit' }}
                        onClick={() => jumpToEntity(c)}>{c.entityName || 'Unknown'}</strong>
                      <span style={{ ...S.badge(c.entityType === 'member' ? 'var(--green-600)' : 'var(--info)'), fontSize: '.7rem' }}>{c.entityType}</span>
                      <span style={{ ...S.badge(typeBg[c.contactType] || 'var(--green-500)'), fontSize: '.7rem' }}>{c.contactType}</span>
                      {directionLabel && <span style={{ ...S.badge('#888'), fontSize: '.7rem' }}>{directionLabel}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '.82rem', color: 'var(--text-light)' }}>{fmt.date(c.contactDate)}</span>
                      <button style={{ ...S.btn('danger'), padding: '2px 8px', fontSize: '.75rem' }} onClick={() => remove(c.id)}>Del</button>
                    </div>
                  </div>
                  {c.subject && <div style={{ fontWeight: 600, fontSize: '.92rem', marginBottom: 4 }}>{c.subject}</div>}
                  {body && (
                    <div style={{ fontSize: '.9rem', color: '#444', marginBottom: 4, whiteSpace: 'pre-wrap' }}>
                      {isOpen || !showExpand ? body : body.slice(0, 200) + '…'}
                      {showExpand && (
                        <button onClick={() => setExpanded(p => ({ ...p, [c.id]: !isOpen }))}
                          style={{ background: 'none', border: 'none', color: 'var(--green-700)', cursor: 'pointer', fontSize: '.82rem', marginLeft: 6, padding: 0 }}>
                          {isOpen ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  )}
                  {c.nextAction && <div style={{ fontSize: '.85rem', color: 'var(--green-700)' }}>Next: {c.nextAction}{c.nextActionDate ? ` (by ${fmt.date(c.nextActionDate)})` : ''}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && <ContactFormModal onClose={() => setModal(false)} onSaved={load} />}
    </div>
  );
}
