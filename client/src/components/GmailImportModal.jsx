import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { fmt } from '../format.js';
import { Modal } from './Modal.jsx';

export function GmailImportModal({ entityType, entityId, entityName, entityEmail, onClose, onImported }) {
  const [status, setStatus] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setStatus(null);
    api(`/google/gmail/search?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}&maxResults=10`)
      .then((result) => {
        if (cancelled) return;
        setThreads(result.threads || []);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error?.message || String(error);
        setStatus(message.includes('google_not_connected') || message.includes('status 409')
          ? 'Connect Google in Settings before importing Gmail conversations.'
          : message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  const importThread = async (threadId) => {
    setImporting(prev => ({ ...prev, [threadId]: true }));
    try {
      const result = await api('/google/gmail/import-thread', {
        method: 'POST',
        body: { entityType, entityId, threadId },
      });
      setThreads(prev => prev.map(thread => thread.threadId === threadId ? { ...thread, imported: true } : thread));
      setStatus(result.alreadyImported ? 'This Gmail thread was already imported.' : 'Gmail thread imported.');
      onImported?.();
    } catch (error) {
      setStatus(error?.message || String(error));
    } finally {
      setImporting(prev => ({ ...prev, [threadId]: false }));
    }
  };

  return (
    <Modal title="Import Gmail Conversation" onClose={onClose}>
      <div style={{ marginBottom: 14, color: 'var(--color-muted)', fontSize: '.88rem' }}>
        Searching Gmail conversations for <strong style={{ color: 'var(--color-navy)' }}>{entityName}</strong>
        {entityEmail ? ` (${entityEmail})` : ''}.
      </div>
      {status && (
        <div style={{ ...S.card, padding: '10px 12px', marginBottom: 12, background: 'var(--color-callout-gold-bg)', color: 'var(--color-navy)' }}>
          {status}
        </div>
      )}
      {loading ? (
        <div style={S.emptyState}>Loading Gmail threads...</div>
      ) : threads.length === 0 ? (
        <div style={S.emptyState}>No Gmail threads found for this contact.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {threads.map(thread => (
            <div key={thread.threadId} className="gmail-thread-card" style={{ border: '1px solid var(--color-divider)', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontWeight: 800, color: 'var(--color-navy)', fontSize: '.94rem' }}>{thread.subject || '(No subject)'}</div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '.78rem', marginTop: 3 }}>
                    {fmt.date(thread.lastMessageDate)} - {thread.messageCount} message{thread.messageCount === 1 ? '' : 's'}
                  </div>
                </div>
                <button
                  style={S.btn(thread.imported ? 'secondary' : 'primary')}
                  onClick={() => importThread(thread.threadId)}
                  disabled={thread.imported || importing[thread.threadId]}
                >
                  {thread.imported ? 'Imported' : importing[thread.threadId] ? 'Importing...' : 'Import'}
                </button>
              </div>
              {thread.participants?.length > 0 && (
                <div style={{ color: 'var(--color-muted)', fontSize: '.78rem', marginTop: 8, overflowWrap: 'anywhere' }}>
                  {thread.participants.join(', ')}
                </div>
              )}
              {thread.snippet && <div style={{ fontSize: '.84rem', marginTop: 8, color: 'var(--color-dark-gray)' }}>{thread.snippet}</div>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
