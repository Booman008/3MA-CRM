import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { fmt } from '../format.js';

// Brand bar colours: alternating gold + navy keeps brand discipline.
const BAR_COLORS = [
  'var(--color-gold)',
  'var(--color-navy)',
  'var(--color-gold-hover)',
  'var(--color-navy-hover)',
];

export function Revenue() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api('/members').then(setMembers).finally(() => setLoading(false)); }, []);

  if (loading) return <div style={S.emptyState}>Loading...</div>;

  const totalRevenue = members.reduce((s, m) => s + (m.duesAmount || 0), 0);

  const byType = {};
  members.forEach(m => {
    const type = m.licenseType || 'Unspecified';
    if (!byType[type]) byType[type] = { count: 0, total: 0 };
    byType[type].count++;
    byType[type].total += m.duesAmount || 0;
  });
  const typeEntries = Object.entries(byType).sort((a, b) => b[1].total - a[1].total);
  const maxTypeTotal = Math.max(...typeEntries.map(([, v]) => v.total), 1);

  const byTier = {};
  members.forEach(m => {
    const tier = m.membershipTier || 'No Tier';
    if (!byTier[tier]) byTier[tier] = { count: 0, total: 0 };
    byTier[tier].count++;
    byTier[tier].total += m.duesAmount || 0;
  });
  const tierEntries = Object.entries(byTier).sort((a, b) => b[1].total - a[1].total);

  const sectionTitle = {
    fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.82rem',
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--color-navy)', marginBottom: 16,
  };
  const statLabel = {
    fontFamily: 'var(--font-heading)', fontSize: '0.66rem', fontWeight: 700,
    letterSpacing: '0.14em', textTransform: 'uppercase',
    color: 'var(--color-muted)', marginBottom: 6,
  };
  const statValue = {
    fontFamily: 'var(--font-heading)', fontSize: '1.9rem', fontWeight: 900,
    color: 'var(--color-navy)',
  };

  return (
    <div>
      <div style={S.pageTitle}>Revenue</div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={S.statsCard('var(--color-gold)')}>
          <div style={statLabel}>Total Dues Revenue</div>
          <div style={statValue}>{fmt.currency(totalRevenue)}</div>
        </div>
        <div style={S.statsCard('var(--color-navy)')}>
          <div style={statLabel}>Paying Members</div>
          <div style={statValue}>{members.filter(m => m.duesAmount > 0).length}</div>
        </div>
        <div style={S.statsCard('var(--color-gold)')}>
          <div style={statLabel}>Average Dues</div>
          <div style={statValue}>{members.length ? fmt.currency(totalRevenue / members.length) : '—'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={S.card}>
          <div style={sectionTitle}>Dues by License Type</div>
          {typeEntries.length === 0 ? <div style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>No data</div> : (
            typeEntries.map(([type, data], i) => (
              <div key={type} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-navy)' }}>
                    {type} <span style={{ color: 'var(--color-muted)', fontWeight: 500, marginLeft: 4 }}>({data.count})</span>
                  </span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.82rem', color: 'var(--color-navy)' }}>{fmt.currency(data.total)}</span>
                </div>
                <div style={{ background: 'var(--color-light-gray)', borderRadius: 999, height: 10, overflow: 'hidden' }}>
                  <div style={{ width: `${(data.total / maxTypeTotal) * 100}%`, height: '100%', background: BAR_COLORS[i % BAR_COLORS.length], borderRadius: 999, transition: 'width .4s' }} />
                </div>
              </div>
            ))
          )}
        </div>

        <div style={S.card}>
          <div style={sectionTitle}>Dues by Membership Tier</div>
          {tierEntries.length === 0 ? <div style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>No data</div> : (
            <table style={S.table}>
              <thead><tr><th style={S.th}>Tier</th><th style={S.th}>Members</th><th style={S.th}>Total Dues</th><th style={S.th}>Avg</th></tr></thead>
              <tbody>
                {tierEntries.map(([tier, data]) => (
                  <tr key={tier}>
                    <td style={{ ...S.td, fontWeight: 700, color: 'var(--color-navy)' }}>{tier}</td>
                    <td style={S.td}>{data.count}</td>
                    <td style={{ ...S.td, fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--color-navy)' }}>{fmt.currency(data.total)}</td>
                    <td style={S.td}>{fmt.currency(data.total / data.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ ...S.card, marginTop: 8 }}>
        <div style={sectionTitle}>All Member Dues</div>
        {members.length === 0 ? <div style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>No members</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead><tr><th style={S.th}>Business</th><th style={S.th}>License Type</th><th style={S.th}>Tier</th><th style={S.th}>County</th><th style={S.th}>Dues</th><th style={S.th}>Renewal</th></tr></thead>
              <tbody>
                {[...members].sort((a, b) => (b.duesAmount || 0) - (a.duesAmount || 0)).map(m => (
                  <tr key={m.id}>
                    <td style={{ ...S.td, fontWeight: 600, color: 'var(--color-navy)' }}>{m.businessName}</td>
                    <td style={S.td}>{m.licenseType || '—'}</td>
                    <td style={S.td}>{m.membershipTier || '—'}</td>
                    <td style={S.td}>{m.county || '—'}</td>
                    <td style={{ ...S.td, fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--color-navy)' }}>{fmt.currency(m.duesAmount)}</td>
                    <td style={S.td}>{fmt.date(m.renewalDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
