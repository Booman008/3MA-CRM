export const fmt = {
  currency: (v) => v != null ? `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
  date: (v) => v ? new Date(v + 'T00:00:00').toLocaleDateString() : '—',
};

export function sortRecords(records, sortBy, sortDir) {
  if (!sortBy) return records;
  const dir = sortDir === 'desc' ? -1 : 1;
  return [...records].sort((a, b) => {
    const av = a[sortBy];
    const bv = b[sortBy];
    const aEmpty = av == null || av === '';
    const bEmpty = bv == null || bv === '';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    const aIso = /^\d{4}-\d{2}-\d{2}/.test(String(av));
    const bIso = /^\d{4}-\d{2}-\d{2}/.test(String(bv));
    if (aIso && bIso) return (String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0) * dir;
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
  });
}

export function nextSortDir(currentBy, currentDir, key) {
  if (currentBy !== key) return 'asc';
  return currentDir === 'asc' ? 'desc' : 'asc';
}

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const stripped = text.replace(/^﻿/, '');
  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i];
    if (inQuotes) {
      if (c === '"') {
        if (stripped[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c === '\r') { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(v => v && v.trim()));
}

export function parseFlexibleDate(s) {
  if (!s) return null;
  const t = String(s).trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [, mo, d, y] = m;
    if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

// renewalStatus — uses 3MA brand callout / red / gold colours.
// Row background tints come from the brand callout palette so they read
// like formal alerts (navy/gold/red) rather than Material colour chips.
export function renewalStatus(renewalDate) {
  if (!renewalDate) {
    return { status: 'none', color: 'inherit', bgColor: 'transparent', label: null };
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const renewal = new Date(renewalDate + 'T00:00:00');
  const diffDays = Math.ceil((renewal - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'pastDue',
      color: 'var(--color-red)',
      bgColor: 'var(--color-callout-red-bg)',
      label: `${Math.abs(diffDays)}d overdue`,
      badgeBg: 'var(--color-red)',
    };
  }
  if (diffDays <= 30) {
    return {
      status: 'urgent',
      color: 'var(--color-navy)',
      bgColor: 'var(--color-callout-gold-bg)',
      label: `${diffDays}d left`,
      badgeBg: 'var(--color-red)', // urgent → red badge, gold row
    };
  }
  if (diffDays <= 60) {
    return {
      status: 'upcoming',
      color: 'var(--color-navy)',
      bgColor: '#fbf3d6', // softer gold than 30-day urgent
      label: `${diffDays}d left`,
      badgeBg: 'var(--color-gold)',
    };
  }
  return { status: 'ok', color: 'inherit', bgColor: 'transparent', label: null };
}
