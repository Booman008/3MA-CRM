import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import { fmt } from '../format.js';

const EMPTY = { members: [], leads: [], contacts: [] };

export function SearchBar() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults(EMPTY); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api(`/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal });
        setResults(r);
        setActiveIdx(-1);
      } catch {} finally { setLoading(false); }
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  useEffect(() => {
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const flat = [
    ...results.members.map(m => ({ kind: 'member', id: m.id, label: m.businessName, sub: [m.ownerName, m.county, m.email].filter(Boolean).join(' · ') })),
    ...results.leads.map(l => ({ kind: 'lead', id: l.id, label: l.businessName, sub: [l.ownerName, l.stage, l.county].filter(Boolean).join(' · ') })),
    ...results.contacts.map(c => ({ kind: 'contact', id: c.id, entityType: c.entityType, entityId: c.entityId, label: c.entityName || 'Contact', sub: `${fmt.date(c.contactDate)} · ${c.contactType || ''} · ${(c.summary || '').slice(0, 50)}` })),
  ];

  const pick = (item) => {
    setOpen(false);
    setQ('');
    if (item.kind === 'contact') {
      location.hash = 'contacts';
    } else {
      const page = item.kind === 'member' ? 'members' : 'leads';
      sessionStorage.setItem('crm:openRecord', JSON.stringify({ kind: item.kind, id: item.id }));
      location.hash = page;
      window.dispatchEvent(new Event('crm:openRecord'));
    }
  };

  const onKeyDown = (e) => {
    if (!open || flat.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIdx >= 0) pick(flat[activeIdx]); else if (flat.length) pick(flat[0]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const sectionTitle = {
    padding: '8px 14px 4px',
    fontFamily: 'var(--font-heading)',
    fontSize: '0.6rem', fontWeight: 700,
    color: 'var(--color-muted)',
    textTransform: 'uppercase', letterSpacing: '0.14em',
  };
  const itemStyle = (active) => ({
    padding: '9px 14px',
    cursor: 'pointer',
    background: active ? 'var(--color-callout-gold-bg)' : 'transparent',
    borderLeft: active ? '3px solid var(--color-gold)' : '3px solid transparent',
  });

  let cursor = 0;
  const renderSection = (title, list, kind) => {
    if (list.length === 0) return null;
    const start = cursor;
    cursor += list.length;
    return (
      <div>
        <div style={sectionTitle}>{title}</div>
        {list.map((item, i) => {
          const idx = start + i;
          const sub = kind === 'member'
            ? [item.ownerName, item.county, item.email].filter(Boolean).join(' · ')
            : kind === 'lead'
              ? [item.ownerName, item.stage, item.county].filter(Boolean).join(' · ')
              : `${fmt.date(item.contactDate)} · ${item.contactType || ''} · ${(item.summary || '').slice(0, 50)}`;
          return (
            <div key={`${kind}-${item.id}`} style={itemStyle(activeIdx === idx)}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseDown={(e) => { e.preventDefault(); pick(flat[idx]); }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-navy)' }}>
                {kind === 'contact' ? (item.entityName || 'Contact') : item.businessName}
              </div>
              {sub && <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: 1 }}>{sub}</div>}
            </div>
          );
        })}
      </div>
    );
  };

  const hasResults = flat.length > 0;

  return (
    <div ref={wrapRef} style={{ position: 'relative', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <input
        type="text"
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search members, leads, contacts…"
        style={{
          width: '100%', padding: '9px 12px', borderRadius: 6, border: 'none',
          background: 'rgba(255,255,255,0.12)', color: '#fff',
          fontSize: '0.82rem', outline: 'none',
          fontFamily: 'var(--font-body)',
        }}
      />
      {open && q.trim().length >= 2 && (
        <div style={{
          position: 'absolute', top: '100%', left: 16, right: 16, marginTop: 4,
          background: '#fff', color: 'var(--text)', borderRadius: 8,
          boxShadow: '0 12px 32px rgba(7,31,64,0.25)',
          maxHeight: '70vh', overflowY: 'auto', zIndex: 1100,
          borderTop: '3px solid var(--color-gold)',
        }}>
          {loading && !hasResults ? (
            <div style={{ padding: 16, fontSize: '0.85rem', color: 'var(--color-muted)' }}>Searching...</div>
          ) : !hasResults ? (
            <div style={{ padding: 16, fontSize: '0.85rem', color: 'var(--color-muted)' }}>No matches</div>
          ) : (
            <>
              {renderSection('Members', results.members, 'member')}
              {renderSection('Leads', results.leads, 'lead')}
              {renderSection('Contact Log', results.contacts, 'contact')}
            </>
          )}
        </div>
      )}
    </div>
  );
}
