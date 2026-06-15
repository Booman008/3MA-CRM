const express = require('express');

const db = require('../database');
const r2 = require('../r2');
const {
  collectUniqueLicenseNumbers,
  expandRecordsForCsv,
} = require('../licenseUtils');

const router = express.Router();
const PROGRAM_LICENSE_TOTAL = 375;
const ARCHIVED_STAGES = new Set(['Not Pursuing', 'Closed/NA', 'Cannot Afford']);

const CSV_COLUMNS = [
  'recordType',
  'recordId',
  'businessName',
  'ownerName',
  'phone',
  'email',
  'statusOrStage',
  'priority',
  'licenseNumber',
  'licenseType',
  'licenseCounty',
  'licenseName',
  'licenseStatus',
  'primaryCounty',
  'joinDate',
  'renewalDate',
  'duesAmount',
  'lastContactDate',
  'nextContactDate',
  'notes',
  'createdAt',
];

function csvCell(value) {
  if (value == null) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function csvLine(values) {
  return values.map(csvCell).join(',');
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntilFactory() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (value) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
  };
}

function buildLicenseMetrics(members, leads) {
  const memberLicenseNumbers = collectUniqueLicenseNumbers(members);
  const leadLicenseNumbers = collectUniqueLicenseNumbers(leads);
  const allLicenseNumbers = new Set([...memberLicenseNumbers, ...leadLicenseNumbers]);
  const leadLicenseCount = [...leadLicenseNumbers].filter((number) => !memberLicenseNumbers.has(number)).length;
  const representedLicenseCount = memberLicenseNumbers.size;
  const representedLicensePercent = Number(((representedLicenseCount / PROGRAM_LICENSE_TOTAL) * 100).toFixed(1));

  return {
    totalLicenses: representedLicenseCount,
    totalTrackedLicenses: allLicenseNumbers.size,
    leadLicenseCount,
    licenseCoveragePercent: representedLicensePercent,
    programLicenseTotal: PROGRAM_LICENSE_TOTAL,
    representedLicenseCount,
    representedLicensePercent,
    unrepresentedProgramLicenseCount: Math.max(PROGRAM_LICENSE_TOTAL - representedLicenseCount, 0),
    crmTrackedLicenseCount: allLicenseNumbers.size,
    nonMemberTrackedLicenseCount: leadLicenseCount,
  };
}

function buildRenewalMetrics(members) {
  const daysUntil = daysUntilFactory();
  const pastDueMembers = members
    .filter((member) => {
      const diff = daysUntil(member.renewalDate);
      return diff != null && diff < 0;
    })
    .sort((a, b) => (a.renewalDate || '').localeCompare(b.renewalDate || ''));

  const upcomingRenewals = members
    .filter((member) => {
      const diff = daysUntil(member.renewalDate);
      return diff != null && diff >= 0 && diff <= 60;
    })
    .sort((a, b) => (a.renewalDate || '').localeCompare(b.renewalDate || ''));

  const renewals30 = upcomingRenewals.filter((member) => {
    const diff = daysUntil(member.renewalDate);
    return diff != null && diff <= 30;
  }).length;

  return {
    pastDueMembers,
    upcomingRenewals,
    renewals30,
    renewals60: upcomingRenewals.length,
  };
}

function buildDashboardPayload({ members, leads, leadsByStage, recentContacts, todayTasks, overdueTasks, logoEntities = [] }) {
  const licenseMetrics = buildLicenseMetrics(members, leads);
  const renewalMetrics = buildRenewalMetrics(members);
  const totalDues = members.reduce((sum, member) => sum + (member.duesAmount || 0), 0);

  return {
    totalMembers: members.length,
    ...licenseMetrics,
    totalDues,
    ...renewalMetrics,
    leadsByStage,
    recentContacts,
    todayTasks,
    overdueTasks,
    logoEntities,
  };
}

function memberCsvRow(item) {
  const { record, license } = item;
  return {
    recordType: 'Member',
    recordId: record.id,
    businessName: record.businessName,
    ownerName: record.ownerName,
    phone: record.phone,
    email: record.email,
    statusOrStage: record.membershipTier || 'Member',
    priority: '',
    licenseNumber: license.number,
    licenseType: license.type,
    licenseCounty: license.county,
    licenseName: license.name,
    licenseStatus: license.status,
    primaryCounty: record.county,
    joinDate: record.joinDate,
    renewalDate: record.renewalDate,
    duesAmount: record.duesAmount,
    lastContactDate: '',
    nextContactDate: '',
    notes: record.notes,
    createdAt: record.createdAt,
  };
}

function leadCsvRow(item) {
  const { record, license } = item;
  return {
    recordType: 'Lead',
    recordId: record.id,
    businessName: record.businessName,
    ownerName: record.ownerName,
    phone: record.phone,
    email: record.email,
    statusOrStage: record.stage,
    priority: record.priority,
    licenseNumber: license.number,
    licenseType: license.type,
    licenseCounty: license.county,
    licenseName: license.name,
    licenseStatus: license.status,
    primaryCounty: record.county,
    joinDate: '',
    renewalDate: '',
    duesAmount: '',
    lastContactDate: record.lastContactDate,
    nextContactDate: record.nextContactDate,
    notes: record.notes,
    createdAt: record.createdAt,
  };
}

function buildContactLicenseCsv(members, leads) {
  const memberRows = expandRecordsForCsv(members, 'Member').map(memberCsvRow);
  const leadRows = expandRecordsForCsv(leads, 'Lead').map(leadCsvRow);
  const rows = [CSV_COLUMNS, ...memberRows.concat(leadRows).map((row) => CSV_COLUMNS.map((column) => row[column]))];
  return rows.map(csvLine).join('\r\n');
}

function snapshotStat(label, value, detail = '') {
  return `
    <div class="stat">
      <div class="stat-label">${escapeHtml(label)}</div>
      <div class="stat-value">${escapeHtml(value)}</div>
      ${detail ? `<div class="stat-detail">${escapeHtml(detail)}</div>` : ''}
    </div>
  `;
}

function renewalRows(title, members) {
  const rows = members.slice(0, 15).map((member) => `
    <tr>
      <td>${escapeHtml(member.businessName || '')}</td>
      <td>${escapeHtml(member.ownerName || '')}</td>
      <td>${escapeHtml(formatDate(member.renewalDate))}</td>
      <td class="num">${escapeHtml(formatCurrency(member.duesAmount))}</td>
    </tr>
  `).join('');

  return `
    <section>
      <div class="section-title">${escapeHtml(title)}</div>
      ${members.length === 0 ? '<p class="muted">No records in this category.</p>' : `
        <table>
          <thead>
            <tr><th>Business</th><th>Owner</th><th>Renewal Date</th><th class="num">Dues</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${members.length > 15 ? `<p class="muted">Showing 15 of ${members.length} records.</p>` : ''}
      `}
    </section>
  `;
}

function buildSnapshotHtml(data) {
  const generatedDate = dateStamp();
  const representedPercent = Math.min(Number(data.representedLicensePercent || 0), 100);
  const averageDues = data.totalMembers > 0 ? data.totalDues / data.totalMembers : 0;
  const activeStages = (data.leadsByStage || []).filter((row) => !ARCHIVED_STAGES.has(row.stage));
  const archivedCount = (data.leadsByStage || [])
    .filter((row) => ARCHIVED_STAGES.has(row.stage))
    .reduce((sum, row) => sum + Number(row.count || 0), 0);
  const pipelineRows = activeStages.map((row) => `
    <tr>
      <td>${escapeHtml(row.stage || 'Unspecified')}</td>
      <td class="num">${escapeHtml(row.count || 0)}</td>
    </tr>
  `).join('');
  const contactRows = (data.recentContacts || []).map((contact) => `
    <tr>
      <td>${escapeHtml(formatDate(contact.contactDate))}</td>
      <td>${escapeHtml(contact.entityName || '')}</td>
      <td>${escapeHtml(contact.contactType || '')}</td>
      <td>${escapeHtml(contact.summary || '')}</td>
      <td>${escapeHtml(contact.nextAction || '')}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>3MA Board Snapshot - ${escapeHtml(generatedDate)}</title>
  <style>
    :root { --navy: #0b2b59; --gold: #d6a226; --red: #b3261e; --muted: #5a6d8f; --line: #d9e0ea; --light: #f5f7fa; --success: #237a57; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--light); color: #17233c; font-family: Arial, Helvetica, sans-serif; line-height: 1.45; }
    .page { width: min(1060px, calc(100% - 32px)); margin: 24px auto; background: #fff; padding: 34px; border-top: 6px solid var(--gold); box-shadow: 0 12px 32px rgba(11, 43, 89, 0.14); }
    .topbar { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; border-bottom: 1px solid var(--line); padding-bottom: 18px; margin-bottom: 22px; }
    h1 { margin: 0 0 6px; color: var(--navy); font-size: 30px; letter-spacing: 0.02em; text-transform: uppercase; }
    .date { color: var(--muted); font-size: 14px; }
    .print-btn { border: 1px solid var(--navy); background: var(--navy); color: #fff; border-radius: 6px; padding: 10px 14px; font-weight: 700; cursor: pointer; white-space: nowrap; }
    .hero { display: grid; grid-template-columns: minmax(260px, 1.1fr) minmax(220px, 0.9fr); gap: 22px; margin-bottom: 22px; }
    .coverage { border: 1px solid var(--line); border-left: 5px solid var(--gold); padding: 22px; border-radius: 8px; }
    .coverage-label { color: var(--muted); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
    .coverage-value { color: var(--navy); font-size: 44px; font-weight: 900; margin: 6px 0; }
    .progress { height: 16px; border-radius: 999px; background: var(--light); overflow: hidden; margin: 16px 0 8px; border: 1px solid var(--line); }
    .progress > div { height: 100%; background: var(--success); width: ${representedPercent}%; }
    .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .stat { border: 1px solid var(--line); border-radius: 8px; padding: 14px; }
    .stat-label, .section-title { color: var(--muted); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
    .stat-value { color: var(--navy); font-size: 24px; font-weight: 900; margin-top: 4px; }
    .stat-detail, .muted { color: var(--muted); font-size: 13px; margin: 4px 0 0; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    section { margin-top: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    th { background: var(--light); color: var(--navy); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; border-bottom: 2px solid var(--gold); padding: 9px; }
    td { border-bottom: 1px solid var(--line); padding: 9px; vertical-align: top; }
    .num { text-align: right; }
    .footer { margin-top: 26px; padding-top: 14px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }
    @media (max-width: 760px) { .hero, .grid, .stats { grid-template-columns: 1fr; } .page { width: 100%; margin: 0; padding: 22px; } .topbar { flex-direction: column; } }
    @media print {
      body { background: #fff; }
      .page { width: 100%; margin: 0; box-shadow: none; border-top-width: 4px; }
      .print-btn { display: none; }
      section, .coverage, .stat { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="page">
    <div class="topbar">
      <div>
        <h1>3MA Board Snapshot</h1>
        <div class="date">Generated ${escapeHtml(formatDate(generatedDate))}</div>
      </div>
      <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
    </div>

    <div class="hero">
      <div class="coverage">
        <div class="coverage-label">License Representation</div>
        <div class="coverage-value">${escapeHtml(data.representedLicenseCount)} of ${escapeHtml(data.programLicenseTotal)}</div>
        <div>${escapeHtml(data.representedLicensePercent)}% of MMCP program represented</div>
        <div class="progress" aria-label="${escapeHtml(data.representedLicensePercent)}% represented"><div></div></div>
        <div class="muted">${escapeHtml(data.unrepresentedProgramLicenseCount)} licenses not yet represented</div>
      </div>
      <div class="stats">
        ${snapshotStat('Total Members', data.totalMembers)}
        ${snapshotStat('CRM-Tracked Licenses', data.crmTrackedLicenseCount)}
        ${snapshotStat('Non-Member Tracked Licenses', data.nonMemberTrackedLicenseCount)}
        ${snapshotStat('Total Dues Revenue', formatCurrency(data.totalDues), data.totalMembers > 0 ? `${formatCurrency(averageDues)} average per member` : '')}
      </div>
    </div>

    <div class="grid">
      <section>
        <div class="section-title">Renewal Risk</div>
        <div class="stats" style="margin-top: 10px;">
          ${snapshotStat('Past Due', data.pastDueMembers.length)}
          ${snapshotStat('Renewing in 30 Days', data.renewals30)}
          ${snapshotStat('Renewing in 60 Days', data.renewals60)}
          ${snapshotStat('Remaining Program Licenses', data.unrepresentedProgramLicenseCount)}
        </div>
      </section>
      <section>
        <div class="section-title">Task Urgency</div>
        <div class="stats" style="margin-top: 10px;">
          ${snapshotStat('Due Today', (data.todayTasks || []).length)}
          ${snapshotStat('Overdue', (data.overdueTasks || []).length)}
        </div>
      </section>
    </div>

    <div class="grid">
      <section>
        <div class="section-title">Lead Pipeline</div>
        ${activeStages.length === 0 && archivedCount === 0 ? '<p class="muted">No lead pipeline records.</p>' : `
          <table>
            <thead><tr><th>Stage</th><th class="num">Count</th></tr></thead>
            <tbody>
              ${pipelineRows}
              <tr><td>Archived / not pursuing</td><td class="num">${escapeHtml(archivedCount)}</td></tr>
            </tbody>
          </table>
        `}
      </section>
      <section>
        <div class="section-title">Recent Contact Activity</div>
        ${(data.recentContacts || []).length === 0 ? '<p class="muted">No recent contact activity.</p>' : `
          <table>
            <thead><tr><th>Date</th><th>Name</th><th>Type</th><th>Summary</th><th>Next Action</th></tr></thead>
            <tbody>${contactRows}</tbody>
          </table>
        `}
      </section>
    </div>

    ${renewalRows('Past-Due Renewal Detail', data.pastDueMembers)}
    ${renewalRows('Upcoming Renewal Detail', data.upcomingRenewals)}

    <div class="footer">Generated from 3MA CRM on ${escapeHtml(generatedDate)}.</div>
  </main>
</body>
</html>`;
}

async function loadDashboardData() {
  const [membersResult, leadsResult, leadsByStageResult, recentContactsResult, todayTasksResult, overdueTasksResult] = await Promise.all([
    db.query(
      `
        SELECT id, "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
               "joinDate", "renewalDate", "duesAmount", "membershipTier", benefits, notes, "createdAt"
        FROM members
        ORDER BY "createdAt" DESC
      `
    ),
    db.query(
      `
        SELECT id, "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
               stage, priority, "lastContactDate", "nextContactDate", notes, "createdAt"
        FROM leads
        ORDER BY "createdAt" DESC
      `
    ),
    db.query(
      `
        SELECT stage, COUNT(*)::int AS count
        FROM leads
        GROUP BY stage
        ORDER BY count DESC
      `
    ),
    db.query(
      `
        SELECT id, "entityId", "entityType", "entityName", "contactDate", "contactType",
               summary, "nextAction", "nextActionDate", "createdAt"
        FROM contact_log
        ORDER BY "contactDate" DESC, "createdAt" DESC
        LIMIT 10
      `
    ),
    db.query(
      `SELECT id, title, "dueDate", priority, "entityType", "entityId", "entityName"
       FROM tasks
       WHERE completed = FALSE AND "dueDate" = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
       ORDER BY CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END`
    ),
    db.query(
      `SELECT id, title, "dueDate", priority, "entityType", "entityId", "entityName"
       FROM tasks
       WHERE completed = FALSE AND "dueDate" IS NOT NULL AND "dueDate" < to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
       ORDER BY "dueDate" ASC LIMIT 20`
    ),
  ]);

  return {
    members: membersResult.rows.map((row) => ({
      ...row,
      duesAmount: row.duesAmount == null ? null : Number(row.duesAmount),
    })),
    leads: leadsResult.rows,
    leadsByStage: leadsByStageResult.rows,
    recentContacts: recentContactsResult.rows,
    todayTasks: todayTasksResult.rows,
    overdueTasks: overdueTasksResult.rows,
  };
}

router.get('/export.csv', async (req, res) => {
  try {
    const [membersResult, leadsResult] = await Promise.all([
      db.query(
        `
          SELECT id, "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
                 "joinDate", "renewalDate", "duesAmount", "membershipTier", notes, "createdAt"
          FROM members
          ORDER BY "createdAt" DESC
        `
      ),
      db.query(
        `
          SELECT id, "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
                 stage, priority, "lastContactDate", "nextContactDate", notes, "createdAt"
          FROM leads
          ORDER BY "createdAt" DESC
        `
      ),
    ]);

    const csv = buildContactLicenseCsv(membersResult.rows, leadsResult.rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="3ma-crm-contacts-licenses-${dateStamp()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Failed to export dashboard CSV:', error);
    res.status(500).json({ error: 'Failed to export dashboard CSV' });
  }
});

router.get('/snapshot.html', async (req, res) => {
  try {
    const data = buildDashboardPayload(await loadDashboardData());
    const html = buildSnapshotHtml(data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="3ma-board-snapshot-${dateStamp()}.html"`);
    res.send(html);
  } catch (error) {
    console.error('Failed to generate dashboard snapshot:', error);
    res.status(500).json({ error: 'Failed to generate dashboard snapshot' });
  }
});

router.get('/', async (req, res) => {
  try {
    const [dashboardData, logoMembersResult, logoLeadsResult] = await Promise.all([
      loadDashboardData(),
      db.query(
        `SELECT m.id AS "entityId", 'member' AS "entityType", m."businessName", m."ownerName", m."membershipTier",
                m."createdAt" AS "updatedAt", a."r2Key" AS "logoR2Key"
         FROM members m
         JOIN attachments a ON a.id = m."logoAttachmentId"
         ORDER BY m."createdAt" DESC
         LIMIT 8`
      ),
      db.query(
        `SELECT l.id AS "entityId", 'lead' AS "entityType", l."businessName", l."ownerName", l.stage,
                l."createdAt" AS "updatedAt", a."r2Key" AS "logoR2Key"
         FROM leads l
         JOIN attachments a ON a.id = l."logoAttachmentId"
         ORDER BY l."createdAt" DESC
         LIMIT 8`
      ),
    ]);

    const logoEntities = [...logoMembersResult.rows, ...logoLeadsResult.rows]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 8);

    const resolvedLogoEntities = await Promise.all(logoEntities.map(async (row) => {
      let logoUrl = null;
      if (row.logoR2Key && r2.isConfigured()) {
        try { logoUrl = await r2.getInlineUrl(row.logoR2Key); } catch {}
      }
      return {
        entityType: row.entityType,
        entityId: row.entityId,
        businessName: row.businessName,
        ownerName: row.ownerName,
        stage: row.stage || null,
        membershipTier: row.membershipTier || null,
        updatedAt: row.updatedAt,
        logoUrl,
      };
    }));

    res.json(buildDashboardPayload({ ...dashboardData, logoEntities: resolvedLogoEntities }));
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

module.exports = router;
