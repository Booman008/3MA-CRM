import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { fmt, renewalStatus } from '../format.js';
import { isArchivedStage, stageColor as stageColorMap } from '../stages.js';

const priorityColor = { Low: 'var(--info)', Medium: 'var(--warning)', High: 'var(--danger)' };

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

  const stageColors = stageColorMap;
  const activeLeadsByStage = data.leadsByStage.filter(s => !isArchivedStage(s.stage));
  const archivedLeadsByStage = data.leadsByStage.filter(s => isArchivedStage(s.stage));
  const maxStageCount = Math.max(...(activeLeadsByStage.map(s => s.count)), 1);
  const activeLeadCount = activeLeadsByStage.reduce((a, s) => a + s.count, 0);
  const archivedLeadCount = archivedLeadsByStage.reduce((a, s) => a + s.count, 0);
  const totalTracked = data.totalMembers + activeLeadCount + archivedLeadCount;
  const pct = (n) => totalTracked > 0 ? ((n / totalTracked) * 100).toFixed(1) : '0.0';

  return (
    <div>
      <div style={S.pageTitle}>Dashboard</div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={S.statsCard('var(--green-600)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Total Members</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--green-800)' }}>{data.totalMembers}</div>
        </div>
        <div style={S.statsCard('var(--info)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Total Licenses</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--green-800)' }}>{data.totalLicenses}</div>
        </div>
        <div style={S.statsCard('var(--green-400)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Total Dues Revenue</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--green-800)' }}>{fmt.currency(data.totalDues)}</div>
        </div>
        <div style={S.statsCard('var(--danger)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Past Due</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: data.pastDueMembers.length > 0 ? 'var(--danger)' : 'var(--green-800)' }}>{data.pastDueMembers.length}</div>
        </div>
        <div style={S.statsCard('var(--warning)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Renewing in 60 Days</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: data.upcomingRenewals.length > 0 ? 'var(--warning)' : 'var(--green-800)' }}>{data.upcomingRenewals.length}</div>
        </div>
        <div style={S.statsCard('var(--green-500)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Tasks Due Today</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--green-800)' }}>{(data.todayTasks || []).length}</div>
        </div>
        <div style={S.statsCard('var(--danger)')}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-light)', marginBottom: 4 }}>Overdue Tasks</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: (data.overdueTasks || []).length > 0 ? 'var(--danger)' : 'var(--green-800)' }}>{(data.overdueTasks || []).length}</div>
        </div>
      </div>

      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, color: 'var(--green-800)' }}>Marketplace Coverage</div>
          <div style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>
            {totalTracked} total license{totalTracked === 1 ? '' : 's'} tracked
          </div>
        </div>
        {totalTracked === 0 ? (
          <div style={{ color: 'var(--text-light)', fontSize: '.9rem' }}>No records yet</div>
        ) : (
          <>
            <div style={{ display: 'flex', height: 28, borderRadius: 6, overflow: 'hidden', marginBottom: 14, background: '#eee' }}>
              {data.totalMembers > 0 && (
                <div title={`Members: ${data.totalMembers}`} style={{ width: `${pct(data.totalMembers)}%`, background: 'var(--green-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '.78rem', fontWeight: 600 }}>
                  {pct(data.totalMembers) >= 6 ? `${pct(data.totalMembers)}%` : ''}
                </div>
              )}
              {activeLeadCount > 0 && (
                <div title={`Active pipeline: ${activeLeadCount}`} style={{ width: `${pct(activeLeadCount)}%`, background: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '.78rem', fontWeight: 600 }}>
                  {pct(activeLeadCount) >= 6 ? `${pct(activeLeadCount)}%` : ''}
                </div>
              )}
              {archivedLeadCount > 0 && (
                <div title={`Archived: ${archivedLeadCount}`} style={{ width: `${pct(archivedLeadCount)}%`, background: '#9e9e9e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '.78rem', fontWeight: 600 }}>
                  {pct(archivedLeadCount) >= 6 ? `${pct(archivedLeadCount)}%` : ''}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, fontSize: '.88rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--green-700)', display: 'inline-block' }} />
                <span>Members <strong>{data.totalMembers}</strong> ({pct(data.totalMembers)}%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--info)', display: 'inline-block' }} />
                <span>Active pipeline <strong>{activeLeadCount}</strong> ({pct(activeLeadCount)}%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: '#9e9e9e', display: 'inline-block' }} />
                <span>Archived / not pursuing <strong>{archivedLeadCount}</strong> ({pct(archivedLeadCount)}%)</span>
              </div>
            </div>
            {archivedLeadsByStage.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: '.82rem', color: 'var(--text-light)' }}>
                Archived breakdown:{' '}
                {archivedLeadsByStage.map((s, i) => (
                  <span key={s.stage}>
                    {i > 0 ? ' · ' : ''}
                    {s.stage} <strong>{s.count}</strong>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {((data.todayTasks || []).length > 0 || (data.overdueTasks || []).length > 0) && (
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: 'var(--green-800)' }}>Today &amp; Overdue Tasks</div>
            <button onClick={() => { location.hash = 'tasks'; }} style={{ ...S.btn('secondary'), padding: '4px 12px', fontSize: '.8rem' }}>View All</button>
          </div>
          {[...(data.overdueTasks || []), ...(data.todayTasks || [])].map(t => {
            const isOverdue = (data.overdueTasks || []).some(o => o.id === t.id);
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
                <input type="checkbox" onChange={() => toggleTaskDone(t.id, true, load)}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--green-600)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.9rem', fontWeight: 500 }}>{t.title}</div>
                  {t.entityName && (
                    <span style={{ fontSize: '.78rem', color: 'var(--green-700)', cursor: 'pointer' }} onClick={() => jumpToTaskEntity(t)}>
                      ↗ {t.entityName}
                    </span>
                  )}
                </div>
                <span style={{ ...S.badge(priorityColor[t.priority] || 'var(--warning)'), fontSize: '.7rem' }}>{t.priority}</span>
                <span style={{ ...S.badge(isOverdue ? 'var(--danger)' : 'var(--warning)'), fontSize: '.7rem' }}>
                  {isOverdue ? fmt.date(t.dueDate) : 'Today'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--green-800)' }}>Lead Pipeline <span style={{ fontSize: '.75rem', color: 'var(--text-light)', fontWeight: 400 }}>(active only)</span></div>
          {activeLeadsByStage.length === 0 && <div style={{ color: 'var(--text-light)', fontSize: '.9rem' }}>No active leads</div>}
          {activeLeadsByStage.map(s => (
            <div key={s.stage} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: 3 }}>
                <span>{s.stage}</span><span style={{ fontWeight: 600 }}>{s.count}</span>
              </div>
              <div style={{ background: '#eee', borderRadius: 4, height: 22, overflow: 'hidden' }}>
                <div style={{ width: `${(s.count / maxStageCount) * 100}%`, height: '100%', background: stageColors[s.stage] || 'var(--green-500)', borderRadius: 4, transition: 'width .4s' }} />
              </div>
            </div>
          ))}
        </div>

        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--green-800)' }}>Renewal Alerts</div>
          {data.pastDueMembers.length === 0 && data.upcomingRenewals.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: '.9rem' }}>No upcoming renewals or past-due members</div>
          ) : (
            <div>
              {data.pastDueMembers.length > 0 && (
                <div style={{ padding: '10px 14px', background: '#ffebee', borderRadius: 8, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #ffcdd2' }}>
                  <span style={{ fontSize: '1.1rem' }}>&#9888;</span>
                  <span style={{ color: '#b71c1c', fontWeight: 600 }}>{data.pastDueMembers.length} past-due member{data.pastDueMembers.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              {data.upcomingRenewals.length > 0 && (
                <div style={{ padding: '10px 14px', background: '#fff8e1', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #ffecb3' }}>
                  <span style={{ fontSize: '1.1rem' }}>&#8505;</span>
                  <span style={{ color: '#e65100', fontWeight: 600 }}>{data.upcomingRenewals.length} renewing within 60 days</span>
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
                        <td style={{ ...S.td, fontWeight: 600, color: rs.color }}>{m.businessName}</td>
                        <td style={S.td}>{m.ownerName || '—'}</td>
                        <td style={{ ...S.td, fontWeight: 600, color: rs.color }}>{fmt.date(m.renewalDate)}</td>
                        <td style={S.td}>{fmt.currency(m.duesAmount)}</td>
                      </tr>
                    );
                  })}
                  {data.upcomingRenewals.map(m => {
                    const rs = renewalStatus(m.renewalDate);
                    return (
                      <tr key={`ur-${m.id}`} style={{ background: rs.bgColor }}>
                        <td style={S.td}><span style={S.badge(rs.badgeBg)}>{rs.label}</span></td>
                        <td style={{ ...S.td, fontWeight: 600, color: rs.color }}>{m.businessName}</td>
                        <td style={S.td}>{m.ownerName || '—'}</td>
                        <td style={{ ...S.td, fontWeight: 600, color: rs.color }}>{fmt.date(m.renewalDate)}</td>
                        <td style={S.td}>{fmt.currency(m.duesAmount)}</td>
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
        <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--green-800)' }}>Recent Contacts</div>
        {data.recentContacts.length === 0 ? (
          <div style={{ color: 'var(--text-light)', fontSize: '.9rem' }}>No contact log entries yet</div>
        ) : (
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Date</th><th style={S.th}>Name</th><th style={S.th}>Type</th><th style={S.th}>Summary</th><th style={S.th}>Next Action</th>
            </tr></thead>
            <tbody>
              {data.recentContacts.map(c => (
                <tr key={c.id}>
                  <td style={S.td}>{fmt.date(c.contactDate)}</td>
                  <td style={{ ...S.td, fontWeight: 500 }}>{c.entityName || '—'}</td>
                  <td style={S.td}><span style={S.badge('var(--green-600)')}>{c.contactType || '—'}</span></td>
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
