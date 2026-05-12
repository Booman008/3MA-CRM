import { useState, useEffect, useRef } from 'react';
import { TOKEN_KEY, api } from '../api.js';
import { S } from '../styles.js';
import { fmt } from '../format.js';

function fileIcon(mimeType, name) {
  const ext = (name || '').split('.').pop()?.toLowerCase();
  if (mimeType?.startsWith('image/')) return '🖼';
  if (mimeType?.includes('pdf') || ext === 'pdf') return '📄';
  if (['xlsx', 'xls', 'csv'].includes(ext) || mimeType?.includes('sheet')) return '📊';
  if (['docx', 'doc'].includes(ext) || mimeType?.includes('word')) return '📝';
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜';
  return '📎';
}

function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsPanel({ entityType, entityId }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const load = () => {
    setLoading(true);
    api(`/attachments?entityType=${entityType}&entityId=${entityId}`).then(setFiles).finally(() => setLoading(false));
  };

  useEffect(() => { if (entityId) load(); }, [entityType, entityId]);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('entityType', entityType);
      form.append('entityId', entityId);
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch('/api/attachments', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Upload failed');
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const download = async (att) => {
    try {
      const { url } = await api(`/attachments/${att.id}/download`);
      window.open(url, '_blank');
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this attachment? This cannot be undone.')) return;
    try {
      await api(`/attachments/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!entityId) return null;

  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: '.92rem', fontWeight: 600, color: 'var(--green-800)' }}>Attachments</div>
        <label style={{ ...S.btn('secondary'), padding: '5px 12px', fontSize: '.8rem', cursor: uploading ? 'wait' : 'pointer' }}>
          {uploading ? 'Uploading...' : '+ Upload File'}
          <input ref={inputRef} type="file" onChange={upload} disabled={uploading} style={{ display: 'none' }} />
        </label>
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: '.82rem', marginBottom: 8 }}>{error}</div>}
      {loading ? (
        <div style={{ fontSize: '.85rem', color: 'var(--text-light)' }}>Loading...</div>
      ) : files.length === 0 ? (
        <div style={{ fontSize: '.85rem', color: 'var(--text-light)', fontStyle: 'italic' }}>No attachments yet. Files up to 25 MB.</div>
      ) : (
        <div>
          {files.map(f => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 4px', borderBottom: '1px solid var(--border)', fontSize: '.85rem',
            }}>
              <span style={{ fontSize: '1.2rem' }}>{fileIcon(f.mimeType, f.filename)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename}</div>
                <div style={{ fontSize: '.72rem', color: 'var(--text-light)' }}>
                  {formatSize(f.sizeBytes)} · {new Date(f.uploadedAt).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => download(f)} style={{ ...S.btn('secondary'), padding: '4px 10px', fontSize: '.75rem' }}>Download</button>
              <button onClick={() => remove(f.id)} style={{ ...S.btn('danger'), padding: '4px 10px', fontSize: '.75rem' }}>Del</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
