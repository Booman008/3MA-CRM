#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const db = require('../server/database');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CSV_SYNC_MARKER = '--- CSV Sync ---';

const STATUS_TO_STAGE = {
  'possible member': 'New',
  'in pipeline': 'Qualified',
  'firecraft': 'FireCraft',
  'closed / na': 'Closed/NA',
  'closed/na': 'Closed/NA',
  'cannot afford / not interested': 'Cannot Afford',
  'cannot afford': 'Cannot Afford',
  'not interested': 'Cannot Afford',
};

const MERGE_MODES = new Set(['owned-by', 'email', 'none']);

function parseArgs(argv) {
  const args = {
    file: '',
    apply: false,
    mergeBy: 'owned-by',
    reportDir: path.join(PROJECT_ROOT, 'reports'),
    backupDir: path.join(PROJECT_ROOT, 'backups'),
    verbose: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--file') args.file = argv[++i] || '';
    else if (arg === '--dry-run') args.apply = false;
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--merge-by') args.mergeBy = (argv[++i] || 'owned-by').toLowerCase();
    else if (arg === '--report-dir') args.reportDir = path.resolve(PROJECT_ROOT, argv[++i] || 'reports');
    else if (arg === '--backup-dir') args.backupDir = path.resolve(PROJECT_ROOT, argv[++i] || 'backups');
    else if (arg === '--verbose') args.verbose = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!MERGE_MODES.has(args.mergeBy)) {
    throw new Error(`--merge-by must be one of: ${[...MERGE_MODES].join(', ')}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/reconcile-leads-from-csv.js --file "<csv path>" --dry-run
  node scripts/reconcile-leads-from-csv.js --file "<csv path>" --apply

Options:
  --file <path>         CSV file to import
  --dry-run             Build report only; do not mutate the database (default)
  --apply               Apply the import transaction
  --merge-by <mode>     How to merge multi-license leads (default: owned-by)
                          owned-by  Group by 'Owned By' column; fall back to email,
                                    then to one-lead-per-row.
                          email     Group strictly by email.
                          none      Never merge — one lead per CSV row.
  --report-dir <path>   Directory for JSON reports (default: reports/)
  --backup-dir <path>   Directory for JSON backups taken before --apply (default: backups/)
  --verbose             Print per-group progress logs

CSV Status column → lead stage mapping:
  Possible Member                  → New
  In Pipeline                      → Qualified
  FireCraft                        → FireCraft
  Closed / NA                      → Closed/NA
  Cannot Afford / Not interested   → Cannot Afford
`);
}

function logVerbose(enabled, ...args) {
  if (enabled) console.log(...args);
}

function timestampSlug(date = new Date()) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function ensureDir(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const stripped = String(text).replace(/^﻿/, '');
  for (let i = 0; i < stripped.length; i++) {
    const char = stripped[i];
    if (inQuotes) {
      if (char === '"') {
        if (stripped[i + 1] === '"') { cell += '"'; i += 1; }
        else inQuotes = false;
      } else cell += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (char !== '\r') cell += char;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v || '').trim()));
}

function parseFlexibleDate(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;
  let [, month, day, year] = match;
  if (year.length === 2) year = `${Number(year) > 50 ? '19' : '20'}${year}`;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function normalizeText(v) { return String(v || '').trim().replace(/\s+/g, ' ').toLowerCase(); }

function uniqueNonEmpty(values) {
  const out = [];
  for (const v of values || []) {
    const t = String(v || '').trim();
    if (!t) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

function firstNonEmpty(values) { return uniqueNonEmpty(values)[0] || null; }

function latestDate(values) {
  const dates = uniqueNonEmpty(values).map(parseFlexibleDate).filter(Boolean).sort();
  return dates[dates.length - 1] || null;
}

function normalizeLicenseRow(row) {
  return {
    number: String(row?.number || '').trim(),
    type: String(row?.type || '').trim(),
    county: String(row?.county || '').trim(),
    name: String(row?.name || '').trim(),
    status: row?.status === 'Inactive' ? 'Inactive' : 'Active',
  };
}

function parseExistingLicenseRows(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeLicenseRow).filter((r) => r.number || r.type || r.county || r.name);
    }
  } catch {}
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((number) => normalizeLicenseRow({ number }));
}

function licenseKey(row) {
  const n = normalizeLicenseRow(row);
  return [n.number, n.type, n.county, n.name, n.status].join('');
}

function dedupeLicenseRows(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows || []) {
    const n = normalizeLicenseRow(r);
    if (!(n.number || n.type || n.county || n.name)) continue;
    const k = licenseKey(n);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out;
}

function serializeLicenseRows(rows) {
  const n = dedupeLicenseRows(rows);
  return n.length ? JSON.stringify(n) : null;
}

function headerIndexMap(headerRow) {
  const headers = headerRow.map(normalizeText);
  const aliases = {
    licenseNo: ['license no.', 'license no', 'license number', 'license #', 'license'],
    businessName: ['business name', 'business', 'name'],
    dba: ['dba'],
    lastTouch: ['last touch'],
    county: ['county'],
    facebook: ['facebook'],
    licenseType: ['business type', 'license type', 'type'],
    status: ['status'],
    ownedBy: ['owned by', 'member name'],
    expiration: ['expiration', 'expiration date'],
    issueDate: ['license issue date', 'issue date', 'join date'],
    ownerName: ['owner name', 'owner', 'owners'],
    physicalAddress: ['physical address', 'address'],
    mailingAddress: ['mailing address'],
    phone: ['phone number', 'phone'],
    email: ['email address', 'email'],
  };
  const map = {};
  for (const [field, names] of Object.entries(aliases)) {
    const idx = headers.findIndex((h) => names.includes(h));
    if (idx >= 0) map[field] = idx;
  }
  return map;
}

function csvCell(row, map, field) {
  const idx = map[field];
  if (idx == null) return '';
  return String(row[idx] || '').trim();
}

function mapStatusToStage(status) {
  const key = normalizeText(status);
  return STATUS_TO_STAGE[key] || null;
}

function parseCsvLeads(csvText) {
  const rows = parseCSV(csvText);
  if (rows.length < 2) throw new Error('CSV has no data rows');
  const map = headerIndexMap(rows[0]);
  if (map.licenseNo == null || map.businessName == null || map.status == null) {
    throw new Error('CSV is missing one of the required columns: License No., Business Name, Status');
  }

  return rows.slice(1).map((row, i) => {
    const businessName = csvCell(row, map, 'businessName');
    const status = csvCell(row, map, 'status');
    return {
      csvRowNumber: i + 2,
      licenseNo: csvCell(row, map, 'licenseNo'),
      businessName,
      dba: csvCell(row, map, 'dba'),
      lastTouch: csvCell(row, map, 'lastTouch'),
      county: csvCell(row, map, 'county'),
      facebook: csvCell(row, map, 'facebook'),
      licenseType: csvCell(row, map, 'licenseType'),
      status,
      stage: mapStatusToStage(status),
      ownedBy: csvCell(row, map, 'ownedBy'),
      expiration: csvCell(row, map, 'expiration'),
      issueDate: csvCell(row, map, 'issueDate'),
      ownerName: csvCell(row, map, 'ownerName'),
      physicalAddress: csvCell(row, map, 'physicalAddress'),
      mailingAddress: csvCell(row, map, 'mailingAddress'),
      phone: csvCell(row, map, 'phone'),
      email: csvCell(row, map, 'email'),
    };
  }).filter((r) => r.businessName);
}

function groupRows(rows, mergeBy) {
  const groups = new Map();
  for (const row of rows) {
    let key = null;
    let displayName = row.ownedBy || row.businessName || `row-${row.csvRowNumber}`;
    let mergeReason = 'individual';

    if (mergeBy === 'owned-by') {
      if (row.ownedBy.trim()) { key = `owned-by:${normalizeText(row.ownedBy)}`; mergeReason = 'owned-by'; }
      else if (row.email.trim()) { key = `email:${normalizeText(row.email)}`; displayName = row.businessName; mergeReason = 'email'; }
      else { key = `row:${row.csvRowNumber}`; displayName = row.businessName; }
    } else if (mergeBy === 'email') {
      if (row.email.trim()) { key = `email:${normalizeText(row.email)}`; displayName = row.ownedBy || row.businessName; mergeReason = 'email'; }
      else { key = `row:${row.csvRowNumber}`; displayName = row.businessName; }
    } else {
      key = `row:${row.csvRowNumber}`;
      displayName = row.businessName;
    }

    if (!groups.has(key)) {
      groups.set(key, { groupKey: key, displayName, mergeReason, rows: [] });
    }
    groups.get(key).rows.push(row);
  }
  return [...groups.values()];
}

function buildCsvSyncBlock(rows) {
  const sections = [
    ['DBA', uniqueNonEmpty(rows.map((r) => r.dba))],
    ['Physical', uniqueNonEmpty(rows.map((r) => r.physicalAddress))],
    ['Mailing', uniqueNonEmpty(rows.map((r) => r.mailingAddress))],
    ['Last Touch', uniqueNonEmpty(rows.map((r) => r.lastTouch))],
    ['Facebook', uniqueNonEmpty(rows.map((r) => r.facebook))],
    ['License Expirations', uniqueNonEmpty(rows.map((r) => r.expiration))],
    ['License Issue Dates', uniqueNonEmpty(rows.map((r) => r.issueDate))],
    ['CSV Status', uniqueNonEmpty(rows.map((r) => r.status))],
  ].filter(([, v]) => v.length > 0);
  if (sections.length === 0) return '';
  return [CSV_SYNC_MARKER, ...sections.map(([label, v]) => `${label}: ${v.join(' | ')}`)].join('\n');
}

function stripCsvSyncBlock(notes) {
  const text = String(notes || '').trim();
  if (!text) return '';
  const idx = text.indexOf(CSV_SYNC_MARKER);
  if (idx < 0) return text;
  return text.slice(0, idx).trim();
}

function mergeNotes(existingNotes, csvRows) {
  const base = stripCsvSyncBlock(existingNotes);
  const block = buildCsvSyncBlock(csvRows);
  if (!base && !block) return null;
  if (!base) return block;
  if (!block) return base;
  return `${base}\n\n${block}`;
}

function buildLicenseRowsFromGroup(group) {
  return dedupeLicenseRows(group.rows.map((r) => ({
    number: r.licenseNo,
    type: r.licenseType,
    county: r.county,
    name: r.businessName,
    status: 'Active',
  })));
}

function pickStageForGroup(group) {
  const stages = uniqueNonEmpty(group.rows.map((r) => r.stage));
  if (stages.length === 0) return { stage: 'New', mixed: false };
  if (stages.length === 1) return { stage: stages[0], mixed: false };
  const priority = ['Qualified', 'FireCraft', 'New', 'Cannot Afford', 'Closed/NA'];
  const chosen = priority.find((s) => stages.includes(s)) || stages[0];
  return { stage: chosen, mixed: true, allStages: stages };
}

function buildLeadDraft(group, existingSurvivor) {
  const licenseRows = buildLicenseRowsFromGroup(group);
  const owners = uniqueNonEmpty(group.rows.map((r) => r.ownerName));
  const phones = uniqueNonEmpty(group.rows.map((r) => r.phone));
  const emails = uniqueNonEmpty(group.rows.map((r) => r.email));
  const businessNames = uniqueNonEmpty(group.rows.map((r) => r.businessName));
  const ownedBy = uniqueNonEmpty(group.rows.map((r) => r.ownedBy));
  const stageInfo = pickStageForGroup(group);

  const displayBusinessName = ownedBy[0] || group.displayName || businessNames[0] || 'Unnamed lead';

  return {
    groupKey: group.groupKey,
    mergeReason: group.mergeReason,
    businessNames,
    licenseRows,
    stageInfo,
    businessName: existingSurvivor?.businessName || displayBusinessName,
    licenseNo: serializeLicenseRows(licenseRows),
    licenseType: firstNonEmpty(licenseRows.map((r) => r.type)) || existingSurvivor?.licenseType || null,
    county: firstNonEmpty(licenseRows.map((r) => r.county)) || existingSurvivor?.county || null,
    ownerName: owners.length === 0 ? (existingSurvivor?.ownerName || null) : owners.join(', '),
    phone: firstNonEmpty(phones) || existingSurvivor?.phone || null,
    email: firstNonEmpty(emails) || existingSurvivor?.email || null,
    stage: existingSurvivor?.stage || stageInfo.stage,
    priority: existingSurvivor?.priority || 'Medium',
    lastContactDate: latestDate(group.rows.map((r) => r.lastTouch)) || existingSurvivor?.lastContactDate || null,
    nextContactDate: existingSurvivor?.nextContactDate || null,
    notes: mergeNotes(existingSurvivor?.notes, group.rows),
  };
}

function buildLicenseNumberSet(rows) {
  return new Set((rows || []).map((r) => normalizeText(r.number)).filter(Boolean));
}

function buildNameSet(values) {
  return new Set(uniqueNonEmpty(values).map(normalizeText).filter(Boolean));
}

function pickSurvivor(candidates, group) {
  const groupName = normalizeText(group.displayName);
  const licenseNumbers = buildLicenseNumberSet(buildLicenseRowsFromGroup(group));
  const businessNames = buildNameSet(group.rows.map((r) => r.businessName));

  const sorted = [...candidates].sort((a, b) => {
    const aExact = normalizeText(a.businessName) === groupName ? 1 : 0;
    const bExact = normalizeText(b.businessName) === groupName ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    const aOverlap = a.parsedLicenseRows.reduce((c, r) => c + (licenseNumbers.has(normalizeText(r.number)) ? 1 : 0), 0);
    const bOverlap = b.parsedLicenseRows.reduce((c, r) => c + (licenseNumbers.has(normalizeText(r.number)) ? 1 : 0), 0);
    if (aOverlap !== bOverlap) return bOverlap - aOverlap;

    const aBusiness = businessNames.has(normalizeText(a.businessName)) ? 1 : 0;
    const bBusiness = businessNames.has(normalizeText(b.businessName)) ? 1 : 0;
    if (aBusiness !== bBusiness) return bBusiness - aBusiness;

    return a.id - b.id;
  });

  return sorted[0] || null;
}

async function loadExistingLeads() {
  const result = await db.query('SELECT * FROM leads ORDER BY id');
  return result.rows.map((lead) => ({
    ...lead,
    parsedLicenseRows: parseExistingLicenseRows(lead.licenseNo),
    normalizedBusinessName: normalizeText(lead.businessName),
  }));
}

function buildPlans(groups, existingLeads) {
  const leadMatches = new Map();
  const plans = groups.map((group) => {
    const groupLicenseNumbers = buildLicenseNumberSet(buildLicenseRowsFromGroup(group));
    const groupBusinessNames = buildNameSet(group.rows.map((r) => r.businessName));
    const groupName = normalizeText(group.displayName);

    const candidates = existingLeads.filter((lead) => {
      const licenseOverlap = lead.parsedLicenseRows.some((r) => groupLicenseNumbers.has(normalizeText(r.number)));
      const nameMatch = lead.normalizedBusinessName === groupName || groupBusinessNames.has(lead.normalizedBusinessName);
      return licenseOverlap || nameMatch;
    });

    const survivor = pickSurvivor(candidates, group);
    const duplicateIds = candidates.filter((l) => l.id !== survivor?.id).map((l) => l.id);
    const draft = buildLeadDraft(group, survivor);

    for (const c of candidates) {
      if (!leadMatches.has(c.id)) leadMatches.set(c.id, []);
      leadMatches.get(c.id).push(group.groupKey);
    }

    return {
      groupKey: group.groupKey,
      displayName: group.displayName,
      mergeReason: group.mergeReason,
      csvRowCount: group.rows.length,
      businessNames: uniqueNonEmpty(group.rows.map((r) => r.businessName)),
      matchedLeadIds: candidates.map((c) => c.id),
      survivorId: survivor?.id || null,
      duplicateIds,
      action: survivor ? 'update' : 'create',
      stageInfo: draft.stageInfo,
      draft,
      csvRows: group.rows,
      ambiguousExistingLeadIds: [],
    };
  });

  const ambiguousExisting = [...leadMatches.entries()]
    .filter(([, keys]) => new Set(keys).size > 1)
    .map(([leadId, keys]) => ({ leadId, groupKeys: [...new Set(keys)] }));

  const ambiguousGroupKeys = new Set(ambiguousExisting.flatMap((e) => e.groupKeys));
  for (const plan of plans) {
    plan.ambiguousExistingLeadIds = ambiguousExisting
      .filter((e) => e.groupKeys.includes(plan.groupKey))
      .map((e) => e.leadId);
    if (ambiguousGroupKeys.has(plan.groupKey)) plan.action = 'ambiguous';
  }

  return { plans, ambiguousExistingLeads: ambiguousExisting };
}

function summarize(plans, csvRowCount, ambiguousExistingLeads) {
  return {
    csvRowCount,
    groupCount: plans.length,
    creates: plans.filter((p) => p.action === 'create').length,
    updates: plans.filter((p) => p.action === 'update').length,
    ambiguous: plans.filter((p) => p.action === 'ambiguous').length,
    mixedStageGroups: plans.filter((p) => p.stageInfo.mixed).length,
    multiLicenseGroups: plans.filter((p) => p.draft.licenseRows.length > 1).length,
    ambiguousExistingLeads: ambiguousExistingLeads.length,
    stageBreakdown: plans.reduce((acc, p) => {
      acc[p.draft.stage] = (acc[p.draft.stage] || 0) + 1;
      return acc;
    }, {}),
  };
}

async function exportBackup(dirPath) {
  ensureDir(dirPath);
  const [leads, contactLog, tasks, attachments] = await Promise.all([
    db.query('SELECT * FROM leads ORDER BY id'),
    db.query(`SELECT * FROM contact_log WHERE "entityType" = 'lead' ORDER BY id`),
    db.query(`SELECT * FROM tasks WHERE "entityType" = 'lead' ORDER BY id`),
    db.query(`SELECT * FROM attachments WHERE "entityType" = 'lead' ORDER BY id`),
  ]);
  writeJson(path.join(dirPath, 'leads.json'), leads.rows);
  writeJson(path.join(dirPath, 'contact_log.json'), contactLog.rows);
  writeJson(path.join(dirPath, 'tasks.json'), tasks.rows);
  writeJson(path.join(dirPath, 'attachments.json'), attachments.rows);
}

async function createLead(client, draft) {
  const result = await client.query(
    `
      INSERT INTO leads (
        "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
        stage, priority, "lastContactDate", "nextContactDate", notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `,
    [
      draft.businessName, draft.licenseNo, draft.licenseType, draft.county,
      draft.ownerName, draft.phone, draft.email, draft.stage, draft.priority,
      draft.lastContactDate, draft.nextContactDate, draft.notes,
    ]
  );
  return result.rows[0].id;
}

async function updateLead(client, leadId, draft) {
  await client.query(
    `
      UPDATE leads
      SET "businessName" = $1,
          "licenseNo" = $2,
          "licenseType" = $3,
          county = $4,
          "ownerName" = $5,
          phone = $6,
          email = $7,
          "lastContactDate" = $8,
          notes = $9
      WHERE id = $10
    `,
    [
      draft.businessName, draft.licenseNo, draft.licenseType, draft.county,
      draft.ownerName, draft.phone, draft.email, draft.lastContactDate,
      draft.notes, leadId,
    ]
  );
}

async function reassignDuplicateLead(client, duplicate, survivorId, survivorName) {
  const [contactResult, taskResult, attachmentResult] = await Promise.all([
    client.query(
      `UPDATE contact_log SET "entityId" = $1, "entityName" = $2 WHERE "entityType" = 'lead' AND "entityId" = $3`,
      [survivorId, survivorName, duplicate.id]
    ),
    client.query(
      `UPDATE tasks SET "entityId" = $1, "entityName" = $2 WHERE "entityType" = 'lead' AND "entityId" = $3`,
      [survivorId, survivorName, duplicate.id]
    ),
    client.query(
      `UPDATE attachments SET "entityId" = $1 WHERE "entityType" = 'lead' AND "entityId" = $2`,
      [survivorId, duplicate.id]
    ),
  ]);

  if (duplicate.logoAttachmentId) {
    const survivor = await client.query('SELECT "logoAttachmentId" FROM leads WHERE id = $1', [survivorId]);
    if (!survivor.rows[0]?.logoAttachmentId) {
      await client.query('UPDATE leads SET "logoAttachmentId" = $1 WHERE id = $2', [duplicate.logoAttachmentId, survivorId]);
    }
  }

  await client.query('DELETE FROM leads WHERE id = $1', [duplicate.id]);

  return {
    duplicateId: duplicate.id,
    contactLogReassigned: contactResult.rowCount,
    tasksReassigned: taskResult.rowCount,
    attachmentsReassigned: attachmentResult.rowCount,
  };
}

async function applyPlans(plans, existingById, verbose) {
  const applied = { created: [], updated: [], mergedDuplicates: [] };
  await db.transaction(async (client) => {
    for (const plan of plans) {
      if (plan.action === 'ambiguous') {
        throw new Error(`Ambiguous match for group "${plan.displayName}". Resolve the report before applying.`);
      }
      let survivorId = plan.survivorId;

      if (plan.action === 'create') {
        survivorId = await createLead(client, plan.draft);
        applied.created.push({
          groupKey: plan.groupKey, displayName: plan.displayName,
          survivorId, licenseCount: plan.draft.licenseRows.length, stage: plan.draft.stage,
        });
        logVerbose(verbose, `Created lead ${survivorId} for ${plan.displayName}`);
      } else {
        await updateLead(client, survivorId, plan.draft);
        applied.updated.push({
          groupKey: plan.groupKey, displayName: plan.displayName,
          survivorId, duplicateIds: plan.duplicateIds, licenseCount: plan.draft.licenseRows.length,
        });
        logVerbose(verbose, `Updated lead ${survivorId} for ${plan.displayName}`);
      }

      for (const dupId of plan.duplicateIds) {
        const dup = existingById.get(dupId);
        if (!dup) continue;
        const merge = await reassignDuplicateLead(client, dup, survivorId, plan.draft.businessName);
        applied.mergedDuplicates.push({ groupKey: plan.groupKey, survivorId, ...merge });
        logVerbose(verbose, `Merged duplicate lead ${dupId} into ${survivorId}`);
      }
    }
  });
  return applied;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }
  if (!args.file) { printHelp(); throw new Error('--file is required'); }

  const absolute = path.resolve(PROJECT_ROOT, args.file);
  if (!fs.existsSync(absolute)) throw new Error(`CSV file not found: ${absolute}`);

  const runSlug = timestampSlug();
  const reportPath = path.join(args.reportDir, `lead-import-${runSlug}.json`);
  const backupPath = path.join(args.backupDir, `lead-import-${runSlug}`);
  const csvText = fs.readFileSync(absolute, 'utf8');
  const parsedRows = parseCsvLeads(csvText);

  const unmappedStatuses = uniqueNonEmpty(
    parsedRows.filter((r) => !r.stage).map((r) => r.status)
  );

  const groups = groupRows(parsedRows, args.mergeBy);
  logVerbose(args.verbose, `Parsed ${parsedRows.length} CSV rows into ${groups.length} groups (merge-by=${args.mergeBy})`);

  const existingLeads = await loadExistingLeads();
  const existingById = new Map(existingLeads.map((l) => [l.id, l]));
  const { plans, ambiguousExistingLeads } = buildPlans(groups, existingLeads);
  const summary = summarize(plans, parsedRows.length, ambiguousExistingLeads);
  summary.mergeBy = args.mergeBy;
  summary.unmappedStatuses = unmappedStatuses;

  const report = {
    generatedAt: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    file: absolute,
    mergeBy: args.mergeBy,
    summary,
    ambiguousExistingLeads,
    groups: plans.map((p) => ({
      groupKey: p.groupKey,
      displayName: p.displayName,
      mergeReason: p.mergeReason,
      csvRowCount: p.csvRowCount,
      businessNames: p.businessNames,
      matchedLeadIds: p.matchedLeadIds,
      survivorId: p.survivorId,
      duplicateIds: p.duplicateIds,
      action: p.action,
      stage: p.draft.stage,
      stageMixed: p.stageInfo.mixed || false,
      stageOptions: p.stageInfo.allStages || null,
      licenseCount: p.draft.licenseRows.length,
      licenseNumbers: p.draft.licenseRows.map((r) => r.number),
      ambiguousExistingLeadIds: p.ambiguousExistingLeadIds,
    })),
  };

  if (args.apply) {
    if (summary.ambiguous > 0) {
      writeJson(reportPath, report);
      throw new Error(`Apply aborted: ${summary.ambiguous} ambiguous group(s) detected. Review ${reportPath}`);
    }
    await exportBackup(backupPath);
    report.applied = await applyPlans(plans, existingById, args.verbose);
    report.backupPath = backupPath;
  }

  writeJson(reportPath, report);
  console.log(`Report written to ${reportPath}`);
  if (args.apply) {
    console.log(`Backup written to ${backupPath}`);
    console.log(`Applied ${report.applied.created.length} creates, ${report.applied.updated.length} updates, ${report.applied.mergedDuplicates.length} duplicate merges.`);
  } else {
    console.log(`Dry run: ${summary.groupCount} groups (${summary.creates} create, ${summary.updates} update, ${summary.ambiguous} ambiguous) from ${summary.csvRowCount} CSV rows. merge-by=${args.mergeBy}`);
    console.log(`Stage breakdown: ${JSON.stringify(summary.stageBreakdown)}`);
    if (unmappedStatuses.length) console.log(`WARNING: unmapped CSV statuses (defaulted to 'New'): ${unmappedStatuses.join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
