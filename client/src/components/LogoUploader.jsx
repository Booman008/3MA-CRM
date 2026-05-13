import { useRef, useState } from 'react';
import { TOKEN_KEY } from '../api.js';
import { S } from '../styles.js';

export function LogoUploader({ entityType, entityId, entityName, logoUrl, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!entityId) return null;

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`/api/${entityType}s/${entityId}/logo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Logo upload failed');
      }
      const updated = await res.json();
      onChange?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!confirm('Remove this logo?')) return;
    setBusy(true);
    setError('');
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`/api/${entityType}s/${entityId}/logo`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to remove logo');
      }
      onChange?.({ logoUrl: null, logoAttachmentId: null });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '96px 1fr',
      gap: 16,
      padding: '14px 0 18px',
      marginBottom: 12,
      borderBottom: '1px solid var(--color-divider)',
    }}>
      <div style={{
        width: 96,
        height: 96,
        borderRadius: 12,
        background: 'var(--color-light-gray)',
        border: '1px solid var(--color-divider)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {logoUrl ? (
          <img src={logoUrl} alt={`${entityName || entityType} logo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.64rem',
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-muted)',
            textAlign: 'center',
            padding: 10,
          }}>
            No Logo
          </div>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '0.68rem',
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-muted)',
          marginBottom: 6,
        }}>
          Brand Logo
        </div>
        <div style={{ color: 'var(--color-muted)', fontSize: '.84rem', marginBottom: 10 }}>
          PNG, JPG, WebP, or SVG up to 5 MB.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ ...S.btn('secondary'), cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? 'Uploading...' : (logoUrl ? 'Replace Logo' : 'Upload Logo')}
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={upload} disabled={busy} style={{ display: 'none' }} />
          </label>
          {logoUrl && (
            <button type="button" style={S.btn('danger')} onClick={remove} disabled={busy}>
              Remove Logo
            </button>
          )}
        </div>
        {error && <div style={{ color: 'var(--color-red)', fontSize: '.82rem', marginTop: 10 }}>{error}</div>}
      </div>
    </div>
  );
}
