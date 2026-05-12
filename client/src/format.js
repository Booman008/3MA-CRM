export const fmt = {
  currency: (v) => v != null ? `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
  date: (v) => v ? new Date(v + 'T00:00:00').toLocaleDateString() : '—',
};

export function renewalStatus(renewalDate) {
  if (!renewalDate) return { status: 'none', color: 'inherit', bgColor: 'transparent', label: null };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const renewal = new Date(renewalDate + 'T00:00:00');
  const diffDays = Math.ceil((renewal - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { status: 'pastDue', color: '#b71c1c', bgColor: '#ffebee', label: `${Math.abs(diffDays)}d overdue`, badgeBg: 'var(--danger)' };
  if (diffDays <= 30) return { status: 'urgent', color: '#e65100', bgColor: '#fff8e1', label: `${diffDays}d left`, badgeBg: 'var(--warning)' };
  if (diffDays <= 60) return { status: 'upcoming', color: '#f57f17', bgColor: '#fffde7', label: `${diffDays}d left`, badgeBg: '#fbc02d' };
  return { status: 'ok', color: 'inherit', bgColor: 'transparent', label: null };
}
