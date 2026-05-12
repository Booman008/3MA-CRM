import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { fmt } from '../format.js';

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

  const barColors = ['var(--green-700)', 'var(--green-500)', 'var(--green-400)', 'var(--green-300)', '#66bb6a', '#a5d6a7', '#c8e6c9'];

  return (
    <div>
      <div style={S.pageTitle}>Revenue</div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={S.statsCard('var(--green-600)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Total Dues Revenue</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--green-800)' }}>{fmt.currency(totalRevenue)}</div>
        </div>
        <div style={S.statsCard('var(--green-400)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Paying Members</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--green-800)' }}>{members.filter(m => m.duesAmount > 0).length}</div>
        </div>
        <div style={S.statsCard('var(--info)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Avg Dues</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--green-800)' }}>{members.length ? fmt.currency(totalRevenue / members.length) : '—'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 16, color: 'var(--green-800)' }}>Dues by License Type</div>
          {typeEntries.length === 0 ? <div style={{ color: 'var(--text-light)', fontSize: '.9rem' }}>No data</div> : (
            typeEntries.map(([type, data], i) => (
              <div key={type} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: 3 }}>
                  <span>{type} <span style={{ color: 'var(--text-light)' }}>({data.count})</span></span>
                  <span style={{ fontWeight: 600 }}>{fmt.currency(data.total)}</span>
                </div>
                <div style={{ background: '#eee', borderRadius: 4, height: 22, overflow: 'hidden' }}>
                  <div style={{ width: `${(data.total / maxTypeTotal) * 100}%`, height: '100%', background: barColors[i % barColors.length], borderRadius: 4, transition: 'width .4s' }} />
                </div>
              </div>
            ))
          )}
        </div>

        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 16, color: 'var(--green-800)' }}>Dues by Membership Tier</div>
          {tierEntries.length === 0 ? <div style={{ color: 'var(--text-light)', fontSize: '.9rem' }}>No data</div> : (
            <table style={S.table}>
              <thead><tr><th style={S.th}>Tier</th><th style={S.th}>Members</th><th style={S.th}>Total Dues</th><th style={S.th}>Avg</th></tr></thead>
              <tbody>
                {tierEntries.map(([tier, data]) => (
                  <tr key={tier}>
                    <td style={{ ...S.td, fontWeight: 600 }}>{tier}</td>
                    <td style={S.td}>{data.count}</td>
                    <td style={S.td}>{fmt.currency(data.total)}</td>
                    <td style={S.td}>{fmt.currency(data.total / data.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ ...S.card, marginTop: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--green-800)' }}>All Member Dues</div>
        {members.length === 0 ? <div style={{ color: 'var(--text-light)', fontSize: '.9rem' }}>No members</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead><tr><th style={S.th}>Business</th><th style={S.th}>License Type</th><th style={S.th}>Tier</th><th style={S.th}>County</th><th style={S.th}>Dues</th><th style={S.th}>Renewal</th></tr></thead>
              <tbody>
                {[...members].sort((a, b) => (b.duesAmount || 0) - (a.duesAmount || 0)).map(m => (
                  <tr key={m.id}>
                    <td style={{ ...S.td, fontWeight: 500 }}>{m.businessName}</td>
                    <td style={S.td}>{m.licenseType || '—'}</td>
                    <td style={S.td}>{m.membershipTier || '—'}</td>
                    <td style={S.td}>{m.county || '—'}</td>
                    <td style={{ ...S.td, fontWeight: 600, color: 'var(--green-700)' }}>{fmt.currency(m.duesAmount)}</td>
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
