export const fmt = {
  currency: (v) => v != null ? `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
  date: (v) => v ? new Date(v + 'T00:00:00').toLocaleDateString() : '—',
};

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
