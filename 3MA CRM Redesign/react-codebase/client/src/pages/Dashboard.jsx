import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { fmt, renewalStatus } from '../format.js';

// Priority + stage colours: tuned to the 3MA brand palette.
// Priority: Low=navy (informational), Medium=gold (attention), High=red (urgent).
const priorityColor = {
  Low:    'var(--color-navy)',
  Medium: 'var(--color-gold)',
  High:   'var(--color-red)',
};
// Stage colours: navy for early funnel, gold for mid, success-green for Won, red for Lost.
const stageColors = {
  New:        'var(--color-navy)',
  Contacted:  'var(--color-navy-hover)',
  Qualified:  'var(--color-gold)',
  Proposal:   'var(--color-gold-hover)',
  Won:        'var(--color-success)',
  Lost:       'var(--color-red)',
};

function jumpToTaskEntity(t) {
  if (!t.entityType || !t.entityId) return;
  sessionStorage.setItem('crm:openRecord', JSON.stringify({ kind: t.entityType, id: t.entityId }));
  location.hash = t.entityType === 'member' ? 'members' : 'leads';
  window.dispatchEvent(new Event('crm:openRecord'));
}

async function toggleTaskDone(id, completed, reload) {
  await api(`/tasks/${id}`, { method: 'PUT', body: { completed } });
  reload();
}

export function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => api('/dashboard').then(setData).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  if (loading) return <div style={S.emptyState}>Loading dashboard...</div>;
  if (!data) return <div style={S.emptyState}>Failed to load dashboard</div>;

  const maxStageCount = Math.max(...(data.leadsByStage.map(s => s.count)), 1);

  return (
    <div>
      <div style={S.pageTitle}>Dashboard</div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={S.statsCard('var(--color-gold)')}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>Total Members</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: 'var(--color-navy)' }}>{data.totalMembers}</div>
        </div>
        <div style={S.statsCard('var(--color-navy)')}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>Total Licenses</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: 'var(--color-navy)' }}>{data.totalLicenses}</div>
        </div>
        <div style={S.statsCard('var(--color-gold)')}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>Total Dues Revenue</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: 'var(--color-navy)' }}>{fmt.currency(data.totalDues)}</div>
        </div>
        <div style={S.statsCard('var(--color-red)')}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>Past Due</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: data.pastDueMembers.length > 0 ? 'var(--color-red)' : 'var(--color-navy)' }}>{data.pastDueMembers.length}</div>
        </div>
        <div style={S.statsCard('var(--color-gold)')}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>Renewing in 60 Days</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: 'var(--color-navy)' }}>{data.upcomingRenewals.length}</div>
        </div>
        <div style={S.statsCard('var(--color-navy)')}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>Tasks Due Today</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: 'var(--color-navy)' }}>{(data.todayTasks || []).length}</div>
        </div>
        <div style={S.statsCard('var(--color-red)')}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>Overdue Tasks</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, color: (data.overdueTasks || []).length > 0 ? 'var(--color-red)' : 'var(--color-navy)' }}>{(data.overdueTasks || []).length}</div>
        </div>
      </div>

      {((data.todayTasks || []).length > 0 || (data.overdueTasks || []).length > 0) && (
        <div style={{ ...S.card, marginBottom: 16, borderTop: '3px solid var(--color-gold)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.82rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-navy)' }}>Today &amp; Overdue Tasks</div>
            <button onClick={() => { location.hash = 'tasks'; }} style={{ ...S.btn('secondary'), padding: '4px 12px' }}>View All</button>
          </div>
          {[...(data.overdueTasks || []), ...(data.todayTasks || [])].map(t => {
            const isOverdue = (data.overdueTasks || []).some(o => o.id === t.id);
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--color-divider)' }}>
                <input type="checkbox" onChange={() => toggleTaskDone(t.id, true, load)}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-gold)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-navy)' }}>{t.title}</div>
                  {t.entityName && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-navy)', cursor: 'pointer', fontWeight: 600 }} onClick={() => jumpToTaskEntity(t)}>
                      ↗ {t.entityName}
                    </span>
                  )}
                </div>
                <span style={{ ...S.badge(priorityColor[t.priority] || 'var(--color-gold)'), color: t.priority === 'Medium' ? 'var(--color-navy)' : '#fff' }}>{t.priority}</span>
                <span style={S.badge(isOverdue ? 'var(--color-red)' : 'var(--color-gold)')}>
                  {isOverdue ? fmt.date(t.dueDate) : 'Today'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={S.card}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.82rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-navy)', marginBottom: 14 }}>Lead Pipeline</div>
          {data.leadsByStage.length === 0 && <div style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>No leads yet</div>}
          {data.leadsByStage.map(s => (
            <div key={s.stage} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-navy)' }}>{s.stage}</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.85rem', color: 'var(--color-navy)' }}>{s.count}</span>
              </div>
              <div style={{ background: 'var(--color-light-gray)', borderRadius: 999, height: 10, overflow: 'hidden' }}>
                <div style={{ width: `${(s.count / maxStageCount) * 100}%`, height: '100%', background: stageColors[s.stage] || 'var(--color-gold)', borderRadius: 999, transition: 'width .4s' }} />
              </div>
            </div>
          ))}
        </div>

        <div style={S.card}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.82rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-navy)', marginBottom: 14 }}>Renewal Alerts</div>
          {data.pastDueMembers.length === 0 && data.upcomingRenewals.length === 0 ? (
            <div style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>No upcoming renewals or past-due members</div>
          ) : (
            <div>
              {data.pastDueMembers.length > 0 && (
                <div style={{ padding: '10px 14px', background: 'var(--color-callout-red-bg)', borderRadius: 6, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, borderLeft: '4px solid var(--color-red)' }}>
                  <span style={{ fontSize: '1.1rem', color: 'var(--color-red)' }}>&#9888;</span>
                  <span style={{ color: 'var(--color-red)', fontWeight: 700 }}>{data.pastDueMembers.length} past-due member{data.pastDueMembers.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              {data.upcomingRenewals.length > 0 && (
                <div style={{ padding: '10px 14px', background: 'var(--color-callout-gold-bg)', borderRadius: 6, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, borderLeft: '4px solid var(--color-gold)' }}>
                  <span style={{ fontSize: '1.1rem', color: 'var(--color-gold)' }}>&#8505;</span>
                  <span style={{ color: 'var(--color-navy)', fontWeight: 700 }}>{data.upcomingRenewals.length} renewing within 60 days</span>
                </div>
              )}
              <table style={S.table}>
                <thead><tr>
                  <th style={S.th}>Status</th><th style={S.th}>Business</th><th style={S.th}>Owner</th><th style={S.th}>Renewal Date</th><th style={S.th}>Dues</th>
                </tr></thead>
                <tbody>
                  {data.pastDueMembers.map(m => {
                    const rs = renewalStatus(m.renewalDate);
                    return (
                      <tr key={`pd-${m.id}`} style={{ background: rs.bgColor }}>
                        <td style={S.td}><span style={S.badge(rs.badgeBg)}>{rs.label}</span></td>
                        <td style={{ ...S.td, fontWeight: 700, color: 'var(--color-navy)' }}>{m.businessName}</td>
                        <td style={S.td}>{m.ownerName || '—'}</td>
                        <td style={{ ...S.td, fontWeight: 600, color: rs.color }}>{fmt.date(m.renewalDate)}</td>
                        <td style={{ ...S.td, fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--color-navy)' }}>{fmt.currency(m.duesAmount)}</td>
                      </tr>
                    );
                  })}
                  {data.upcomingRenewals.map(m => {
                    const rs = renewalStatus(m.renewalDate);
                    return (
                      <tr key={`ur-${m.id}`} style={{ background: rs.bgColor }}>
                        <td style={S.td}><span style={S.badge(rs.badgeBg)}>{rs.label}</span></td>
                        <td style={{ ...S.td, fontWeight: 700, color: 'var(--color-navy)' }}>{m.businessName}</td>
                        <td style={S.td}>{m.ownerName || '—'}</td>
                        <td style={{ ...S.td, fontWeight: 600, color: rs.color }}>{fmt.date(m.renewalDate)}</td>
                        <td style={{ ...S.td, fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--color-navy)' }}>{fmt.currency(m.duesAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div style={{ ...S.card, marginTop: 8 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.82rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-navy)', marginBottom: 14 }}>Recent Contacts</div>
        {data.recentContacts.length === 0 ? (
          <div style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>No contact log entries yet</div>
        ) : (
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Date</th><th style={S.th}>Name</th><th style={S.th}>Type</th><th style={S.th}>Summary</th><th style={S.th}>Next Action</th>
            </tr></thead>
            <tbody>
              {data.recentContacts.map(c => (
                <tr key={c.id}>
                  <td style={S.td}>{fmt.date(c.contactDate)}</td>
                  <td style={{ ...S.td, fontWeight: 600, color: 'var(--color-navy)' }}>{c.entityName || '—'}</td>
                  <td style={S.td}><span style={S.badge('var(--color-navy)')}>{c.contactType || '—'}</span></td>
                  <td style={{ ...S.td, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.summary || '—'}</td>
                  <td style={S.td}>{c.nextAction || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
