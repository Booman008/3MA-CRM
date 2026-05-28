import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { fmt } from '../format.js';
import { ContactFormModal } from '../components/ContactFormModal.jsx';

const typeIcon = { Phone: '☎', Email: '✉', 'In-Person': '◉', Text: '✎', Mail: '✉', Other: '•' };
// Contact type badge colours — brand-aligned.
const typeBg = {
  Phone:       'var(--color-navy)',
  Email:       'var(--color-navy-hover)',
  'In-Person': 'var(--color-gold)',
  Text:        'var(--color-gold-hover)',
  Mail:        'var(--color-navy)',
  Other:       'var(--color-muted)',
};
// Some badges (gold ones) need navy text instead of white for legibility.
const typeText = {
  'In-Person': 'var(--color-navy)',
  Text:        'var(--color-navy)',
};

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
    location.hash = c.entityType === 'member' ? 'members' : c.entityType === 'legislator' ? 'legislators' : 'leads';
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
        <span style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>{logs.length} entr{logs.length !== 1 ? 'ies' : 'y'}</span>
      </div>

      {loading ? <div style={S.emptyState}>Loading...</div> : logs.length === 0 ? <div style={{ ...S.card, ...S.emptyState }}>No contact log entries yet.</div> : (
        <div>
          {logs.map(c => {
            const isOpen = expanded[c.id];
            const body = c.summary || '';
            const showExpand = body.length > 200;
            const directionLabel = c.direction === 'inbound' ? 'Received' : c.direction === 'outbound' ? 'Sent' : null;
            const badgeBg = typeBg[c.contactType] || 'var(--color-muted)';
            const badgeText = typeText[c.contactType] || '#fff';
            return (
              <div key={c.id} style={{ ...S.card, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: c.entityType === 'member' ? 'var(--color-callout-gold-bg)' : c.entityType === 'legislator' ? 'var(--color-callout-red-bg)' : 'var(--color-callout-navy-bg)',
                  color: c.entityType === 'member' ? 'var(--color-gold)' : c.entityType === 'legislator' ? 'var(--color-red)' : 'var(--color-navy)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem', flexShrink: 0,
                }}>{typeIcon[c.contactType] || '•'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <strong style={{ cursor: c.entityId ? 'pointer' : 'default', color: 'var(--color-navy)', fontSize: '0.95rem' }}
                        onClick={() => jumpToEntity(c)}>{c.entityName || 'Unknown'}</strong>
                      <span style={{
                        ...S.badge(c.entityType === 'member' ? 'var(--color-gold)' : c.entityType === 'legislator' ? 'var(--color-red)' : 'var(--color-navy)'),
                        color: c.entityType === 'member' ? 'var(--color-navy)' : '#fff',
                      }}>{c.entityType}</span>
                      <span style={{ ...S.badge(badgeBg), color: badgeText }}>{c.contactType}</span>
                      {directionLabel && <span style={S.badge('var(--color-muted)')}>{directionLabel}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>{fmt.date(c.contactDate)}</span>
                      <button style={{ ...S.btn('danger'), padding: '2px 8px' }} onClick={() => remove(c.id)}>Del</button>
                    </div>
                  </div>
                  {c.subject && <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 4, color: 'var(--color-navy)' }}>{c.subject}</div>}
                  {body && (
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-dark-gray)', marginBottom: 4, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                      {isOpen || !showExpand ? body : body.slice(0, 200) + '…'}
                      {showExpand && (
                        <button onClick={() => setExpanded(p => ({ ...p, [c.id]: !isOpen }))}
                          style={{ background: 'none', border: 'none', color: 'var(--color-navy)', cursor: 'pointer', fontSize: '0.82rem', marginLeft: 6, padding: 0, fontWeight: 700 }}>
                          {isOpen ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  )}
                  {c.nextAction && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-navy)', marginTop: 6, fontWeight: 600 }}>
                      → {c.nextAction}{c.nextActionDate ? ` (by ${fmt.date(c.nextActionDate)})` : ''}
                    </div>
                  )}
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
