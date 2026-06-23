#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const db = require('../server/database');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATUS = 'Member';
const CSV_SYNC_MARKER = '--- CSV Sync ---';

function parseArgs(argv) {
  const args = {
    file: '',
    dryRun: false,
    apply: false,
    groupStatus: DEFAULT_STATUS,
    reportDir: path.join(PROJECT_ROOT, 'reports'),
    backupDir: path.join(PROJECT_ROOT, 'backups'),
    verbose: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--file') args.file = argv[++i] || '';
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--group-status') args.groupStatus = argv[++i] || DEFAULT_STATUS;
    else if (arg === '--report-dir') args.reportDir = path.resolve(PROJECT_ROOT, argv[++i] || 'reports');
    else if (arg === '--backup-dir') args.backupDir = path.resolve(PROJECT_ROOT, argv[++i] || 'backups');
    else if (arg === '--verbose') args.verbose = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.apply) args.dryRun = true;
  if (args.apply) args.dryRun = false;
  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/reconcile-members-from-csv.js --file "<csv path>" --dry-run
  node scripts/reconcile-members-from-csv.js --file "<csv path>" --apply

Options:
  --file <path>         CSV file to reconcile from
  --dry-run             Build report only; do not mutate the database
  --apply               Apply the reconciliation transaction
  --group-status <val>  CSV Status value to treat as members (default: Member)
  --report-dir <path>   Directory for JSON reports (default: reports/)
  --backup-dir <path>   Directory for JSON backups (default: backups/)
  --verbose             Print detailed progress logs
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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const stripped = String(text).replace(/^\uFEFF/, '');

  for (let i = 0; i < stripped.length; i++) {
    const char = stripped[i];
    if (inQuotes) {
      if (char === '"') {
        if (stripped[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((currentRow) => currentRow.some((value) => String(value || '').trim()));
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

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function uniqueNonEmpty(values) {
  const output = [];
  for (const value of values || []) {
    const trimmed = String(value || '').trim();
    if (!trimmed) continue;
    if (!output.includes(trimmed)) output.push(trimmed);
  }
  return output;
}

function firstNonEmpty(values) {
  return uniqueNonEmpty(values)[0] || null;
}

function earliestDate(values) {
  const dates = uniqueNonEmpty(values).map(parseFlexibleDate).filter(Boolean).sort();
  return dates[0] || null;
}

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
    expirationDate: parseFlexibleDate(row?.expirationDate || row?.expiration || row?.renewalDate) || '',
    status: row?.status === 'Inactive' ? 'Inactive' : 'Active',
  };
}

function parseExistingLicenseRows(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeLicenseRow).filter((row) => row.number || row.type || row.county || row.name || row.expirationDate);
    }
  } catch {}

  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((number) => normalizeLicenseRow({ number }));
}

function licenseKey(row) {
  const normalized = normalizeLicenseRow(row);
  return [normalized.number, normalized.type, normalized.county, normalized.name, normalized.expirationDate, normalized.status].join('\u001f');
}

function dedupeLicenseRows(rows) {
  const seen = new Set();
  const output = [];
  for (const row of rows || []) {
    const normalized = normalizeLicenseRow(row);
    if (!(normalized.number || normalized.type || normalized.county || normalized.name || normalized.expirationDate)) continue;
    const key = licenseKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function serializeLicenseRows(rows) {
  const normalized = dedupeLicenseRows(rows);
  return normalized.length ? JSON.stringify(normalized) : null;
}

function headerIndexMap(headerRow) {
  const normalizedHeaders = headerRow.map((header) => normalizeText(header));
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
    renewalDate: ['expiration', 'expiration date', 'renewal', 'renewal date', '3ma membership renewal date'],
    licenseExpiration: ['expiration', 'expiration date'],
    joinDate: ['license issue date', 'issue date', 'join date'],
    ownerName: ['owner name', 'owner', 'owners'],
    physicalAddress: ['physical address', 'address'],
    mailingAddress: ['mailing address'],
    phone: ['phone number', 'phone'],
    email: ['email address', 'email'],
  };

  const map = {};
  for (const [field, names] of Object.entries(aliases)) {
    const index = normalizedHeaders.findIndex((header) => names.includes(header));
    if (index >= 0) map[field] = index;
  }
  return map;
}

function csvCell(row, map, field) {
  const index = map[field];
  if (index == null) return '';
  return String(row[index] || '').trim();
}

function parseCsvMembers(csvText, memberStatus) {
  const rows = parseCSV(csvText);
  if (rows.length < 2) throw new Error('CSV has no data rows');
  const map = headerIndexMap(rows[0]);
  if (map.licenseNo == null || map.businessName == null || map.status == null) {
    throw new Error('CSV is missing one of the required columns: License No., Business Name, Status');
  }

  const parsedRows = rows.slice(1).map((row, index) => {
    const businessName = csvCell(row, map, 'businessName');
    const ownedBy = csvCell(row, map, 'ownedBy');
    return {
      csvRowNumber: index + 2,
      licenseNo: csvCell(row, map, 'licenseNo'),
      businessName,
      dba: csvCell(row, map, 'dba'),
      lastTouch: csvCell(row, map, 'lastTouch'),
      county: csvCell(row, map, 'county'),
      facebook: csvCell(row, map, 'facebook'),
      licenseType: csvCell(row, map, 'licenseType'),
      status: csvCell(row, map, 'status'),
      ownedBy,
      renewalDate: csvCell(row, map, 'licenseExpiration') || csvCell(row, map, 'renewalDate'),
      joinDate: csvCell(row, map, 'joinDate'),
      ownerName: csvCell(row, map, 'ownerName'),
      physicalAddress: csvCell(row, map, 'physicalAddress'),
      mailingAddress: csvCell(row, map, 'mailingAddress'),
      phone: csvCell(row, map, 'phone'),
      email: csvCell(row, map, 'email'),
      ownedByMissing: !ownedBy.trim(),
    };
  }).filter((row) => row.businessName);

  const memberRows = parsedRows.filter((row) => normalizeText(row.status) === normalizeText(memberStatus));
  const groups = new Map();

  for (const row of memberRows) {
    const fallbackName = row.businessName || row.licenseNo || `row-${row.csvRowNumber}`;
    const ownedByDisplay = row.ownedBy || fallbackName;
    const groupKey = normalizeText(ownedByDisplay);
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        groupKey,
        ownedByDisplay,
        ownedByMissing: row.ownedByMissing,
        rows: [],
      });
    }
    groups.get(groupKey).rows.push(row);
  }

  return {
    allRows: parsedRows,
    memberRows,
    groups: [...groups.values()],
  };
}

function buildCsvSyncBlock(rows) {
  const sections = [
    ['DBA', uniqueNonEmpty(rows.map((row) => row.dba))],
    ['Physical', uniqueNonEmpty(rows.map((row) => row.physicalAddress))],
    ['Mailing', uniqueNonEmpty(rows.map((row) => row.mailingAddress))],
    ['Last Touch', uniqueNonEmpty(rows.map((row) => row.lastTouch))],
    ['Facebook', uniqueNonEmpty(rows.map((row) => row.facebook))],
  ].filter(([, values]) => values.length > 0);

  if (sections.length === 0) return '';
  return [CSV_SYNC_MARKER, ...sections.map(([label, values]) => `${label}: ${values.join(' | ')}`)].join('\n');
}

function stripCsvSyncBlock(notes) {
  const text = String(notes || '').trim();
  if (!text) return '';
  const markerIndex = text.indexOf(CSV_SYNC_MARKER);
  if (markerIndex < 0) return text;
  return text.slice(0, markerIndex).trim();
}

function mergeNotes(existingNotes, csvRows) {
  const baseNotes = stripCsvSyncBlock(existingNotes);
  const csvBlock = buildCsvSyncBlock(csvRows);
  if (!baseNotes && !csvBlock) return null;
  if (!baseNotes) return csvBlock;
  if (!csvBlock) return baseNotes;
  return `${baseNotes}\n\n${csvBlock}`;
}

function buildLicenseRowsFromGroup(group) {
  return dedupeLicenseRows(group.rows.map((row) => ({
    number: row.licenseNo,
    type: row.licenseType,
    county: row.county,
    name: row.businessName,
    expirationDate: row.renewalDate,
    status: 'Active',
  })));
}

function buildMemberDraft(group, survivor) {
  const licenseRows = buildLicenseRowsFromGroup(group);
  const ownerNames = uniqueNonEmpty(group.rows.map((row) => row.ownerName));
  const phones = uniqueNonEmpty(group.rows.map((row) => row.phone));
  const emails = uniqueNonEmpty(group.rows.map((row) => row.email));
  const businessNames = uniqueNonEmpty(group.rows.map((row) => row.businessName));

  return {
    groupKey: group.groupKey,
    ownedByDisplay: group.ownedByDisplay,
    ownedByMissing: group.ownedByMissing,
    businessNames,
    licenseRows,
    businessName: group.ownedByDisplay,
    licenseNo: serializeLicenseRows(licenseRows),
    licenseType: firstNonEmpty(licenseRows.map((row) => row.type)) || survivor?.licenseType || null,
    county: firstNonEmpty(licenseRows.map((row) => row.county)) || survivor?.county || null,
    ownerName: ownerNames.length === 0 ? (survivor?.ownerName || null) : ownerNames.join(', '),
    phone: firstNonEmpty(phones) || survivor?.phone || null,
    email: firstNonEmpty(emails) || survivor?.email || null,
    joinDate: earliestDate(group.rows.map((row) => row.joinDate)) || survivor?.joinDate || null,
    renewalDate: latestDate(group.rows.map((row) => row.renewalDate)) || survivor?.renewalDate || null,
    membershipTier: survivor?.membershipTier || null,
    duesAmount: survivor?.duesAmount ?? null,
    benefits: survivor?.benefits || '[]',
    notes: mergeNotes(survivor?.notes, group.rows),
  };
}

function buildLicenseNumberSet(rows) {
  return new Set((rows || []).map((row) => normalizeText(row.number)).filter(Boolean));
}

function buildNameSet(values) {
  return new Set(uniqueNonEmpty(values).map(normalizeText).filter(Boolean));
}

function pickSurvivor(candidates, group, relatedCounts) {
  const groupName = normalizeText(group.ownedByDisplay);
  const licenseNumbers = buildLicenseNumberSet(buildLicenseRowsFromGroup(group));
  const businessNames = buildNameSet(group.rows.map((row) => row.businessName));

  const sorted = [...candidates].sort((a, b) => {
    const aExact = normalizeText(a.businessName) === groupName ? 1 : 0;
    const bExact = normalizeText(b.businessName) === groupName ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    const aOverlap = a.parsedLicenseRows.reduce((count, row) => count + (licenseNumbers.has(normalizeText(row.number)) ? 1 : 0), 0);
    const bOverlap = b.parsedLicenseRows.reduce((count, row) => count + (licenseNumbers.has(normalizeText(row.number)) ? 1 : 0), 0);
    if (aOverlap !== bOverlap) return bOverlap - aOverlap;

    const aBusinessMatch = businessNames.has(normalizeText(a.businessName)) ? 1 : 0;
    const bBusinessMatch = businessNames.has(normalizeText(b.businessName)) ? 1 : 0;
    if (aBusinessMatch !== bBusinessMatch) return bBusinessMatch - aBusinessMatch;

    const aCounts = relatedCounts[a.id] || 0;
    const bCounts = relatedCounts[b.id] || 0;
    if (aCounts !== bCounts) return bCounts - aCounts;

    return a.id - b.id;
  });

  return sorted[0] || null;
}

async function loadExistingSnapshot() {
  const [membersResult, contactCountsResult, taskCountsResult, attachmentCountsResult, userCountsResult] = await Promise.all([
    db.query('SELECT * FROM members ORDER BY id'),
    db.query(`
      SELECT "entityId"::int AS id, COUNT(*)::int AS count
      FROM contact_log
      WHERE "entityType" = 'member'
      GROUP BY "entityId"
    `),
    db.query(`
      SELECT "entityId"::int AS id, COUNT(*)::int AS count
      FROM tasks
      WHERE "entityType" = 'member'
      GROUP BY "entityId"
    `),
    db.query(`
      SELECT "entityId"::int AS id, COUNT(*)::int AS count
      FROM attachments
      WHERE "entityType" = 'member'
      GROUP BY "entityId"
    `),
    db.query(`
      SELECT "memberId"::int AS id, COUNT(*)::int AS count
      FROM users
      WHERE "memberId" IS NOT NULL
      GROUP BY "memberId"
    `),
  ]);

  const relatedCounts = {};
  for (const row of [...contactCountsResult.rows, ...taskCountsResult.rows, ...attachmentCountsResult.rows, ...userCountsResult.rows]) {
    relatedCounts[row.id] = (relatedCounts[row.id] || 0) + Number(row.count || 0);
  }

  const members = membersResult.rows.map((member) => ({
    ...member,
    duesAmount: member.duesAmount == null ? null : Number(member.duesAmount),
    parsedLicenseRows: parseExistingLicenseRows(member.licenseNo),
    normalizedBusinessName: normalizeText(member.businessName),
  }));

  return { members, relatedCounts };
}

function buildMatchCandidates(groups, existingMembers, relatedCounts) {
  const memberMatches = new Map();
  const groupPlans = groups.map((group) => {
    const groupLicenseNumbers = buildLicenseNumberSet(buildLicenseRowsFromGroup(group));
    const groupBusinessNames = buildNameSet(group.rows.map((row) => row.businessName));
    const groupName = normalizeText(group.ownedByDisplay);

    const candidates = existingMembers.filter((member) => {
      const licenseOverlap = member.parsedLicenseRows.some((row) => groupLicenseNumbers.has(normalizeText(row.number)));
      const nameMatch = member.normalizedBusinessName === groupName || groupBusinessNames.has(member.normalizedBusinessName);
      return licenseOverlap || nameMatch;
    });

    const survivor = pickSurvivor(candidates, group, relatedCounts);
    const duplicateIds = candidates.filter((member) => member.id !== survivor?.id).map((member) => member.id);
    const draft = buildMemberDraft(group, survivor);

    for (const candidate of candidates) {
      if (!memberMatches.has(candidate.id)) memberMatches.set(candidate.id, []);
      memberMatches.get(candidate.id).push(group.groupKey);
    }

    return {
      groupKey: group.groupKey,
      ownedByDisplay: group.ownedByDisplay,
      ownedByMissing: group.ownedByMissing,
      csvRowCount: group.rows.length,
      businessNames: uniqueNonEmpty(group.rows.map((row) => row.businessName)),
      matchedMemberIds: candidates.map((member) => member.id),
      survivorId: survivor?.id || null,
      duplicateIds,
      action: survivor ? 'update' : 'create',
      draft,
      csvRows: group.rows,
      ambiguousExistingMemberIds: [],
    };
  });

  const ambiguousExistingMembers = [...memberMatches.entries()]
    .filter(([, groupKeys]) => new Set(groupKeys).size > 1)
    .map(([memberId, groupKeys]) => ({ memberId, groupKeys: [...new Set(groupKeys)] }));

  const ambiguousGroupKeys = new Set(ambiguousExistingMembers.flatMap((entry) => entry.groupKeys));
  for (const plan of groupPlans) {
    plan.ambiguousExistingMemberIds = ambiguousExistingMembers
      .filter((entry) => entry.groupKeys.includes(plan.groupKey))
      .map((entry) => entry.memberId);
    if (ambiguousGroupKeys.has(plan.groupKey)) {
      plan.action = 'ambiguous';
    }
  }

  const matchedMemberIds = new Set(groupPlans.flatMap((plan) => plan.matchedMemberIds));
  const orphanedExistingMembers = existingMembers
    .filter((member) => !matchedMemberIds.has(member.id))
    .map((member) => ({
      id: member.id,
      businessName: member.businessName,
      licenseNumbers: member.parsedLicenseRows.map((row) => row.number).filter(Boolean),
    }));

  return {
    groupPlans,
    ambiguousExistingMembers,
    orphanedExistingMembers,
  };
}

function summarizePlan(groupPlans, csvMemberRows, orphanedExistingMembers, ambiguousExistingMembers) {
  const matchedZero = groupPlans.filter((plan) => plan.matchedMemberIds.length === 0).length;
  const matchedOne = groupPlans.filter((plan) => plan.matchedMemberIds.length === 1).length;
  const matchedMany = groupPlans.filter((plan) => plan.matchedMemberIds.length > 1).length;
  return {
    csvMemberRows: csvMemberRows.length,
    ownedByGroups: groupPlans.length,
    matchedZero,
    matchedOne,
    matchedMany,
    creates: groupPlans.filter((plan) => plan.action === 'create').length,
    updates: groupPlans.filter((plan) => plan.action === 'update').length,
    ambiguousGroups: groupPlans.filter((plan) => plan.action === 'ambiguous').length,
    orphanedExistingMembers: orphanedExistingMembers.length,
    ambiguousExistingMembers: ambiguousExistingMembers.length,
  };
}

async function exportBackup(dirPath) {
  ensureDir(dirPath);
  const [members, contactLog, tasks, attachments, users] = await Promise.all([
    db.query('SELECT * FROM members ORDER BY id'),
    db.query(`SELECT * FROM contact_log WHERE "entityType" = 'member' ORDER BY id`),
    db.query(`SELECT * FROM tasks WHERE "entityType" = 'member' ORDER BY id`),
    db.query(`SELECT * FROM attachments WHERE "entityType" = 'member' ORDER BY id`),
    db.query(`SELECT * FROM users WHERE "memberId" IS NOT NULL ORDER BY id`),
  ]);

  writeJson(path.join(dirPath, 'members.json'), members.rows);
  writeJson(path.join(dirPath, 'contact_log.json'), contactLog.rows);
  writeJson(path.join(dirPath, 'tasks.json'), tasks.rows);
  writeJson(path.join(dirPath, 'attachments.json'), attachments.rows);
  writeJson(path.join(dirPath, 'users.json'), users.rows);
}

async function createMember(client, draft) {
  const result = await client.query(
    `
      INSERT INTO members (
        "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
        "joinDate", "renewalDate", "duesAmount", "membershipTier", benefits, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `,
    [
      draft.businessName,
      draft.licenseNo,
      draft.licenseType,
      draft.county,
      draft.ownerName,
      draft.phone,
      draft.email,
      draft.joinDate,
      draft.renewalDate,
      draft.duesAmount,
      draft.membershipTier,
      draft.benefits || '[]',
      draft.notes,
    ]
  );

  return result.rows[0].id;
}

async function updateMember(client, memberId, draft) {
  await client.query(
    `
      UPDATE members
      SET "businessName" = $1,
          "licenseNo" = $2,
          "licenseType" = $3,
          county = $4,
          "ownerName" = $5,
          phone = $6,
          email = $7,
          "joinDate" = $8,
          "renewalDate" = $9,
          notes = $10
      WHERE id = $11
    `,
    [
      draft.businessName,
      draft.licenseNo,
      draft.licenseType,
      draft.county,
      draft.ownerName,
      draft.phone,
      draft.email,
      draft.joinDate,
      draft.renewalDate,
      draft.notes,
      memberId,
    ]
  );
}

async function reassignDuplicateMember(client, duplicateMember, survivorId, survivorBusinessName, survivorHasLogo) {
  const duplicateId = duplicateMember.id;
  const survivorHadLogo = survivorHasLogo;

  const [contactResult, taskResult, attachmentResult, userResult] = await Promise.all([
    client.query(
      `UPDATE contact_log
       SET "entityId" = $1, "entityName" = $2
       WHERE "entityType" = 'member' AND "entityId" = $3`,
      [survivorId, survivorBusinessName, duplicateId]
    ),
    client.query(
      `UPDATE tasks
       SET "entityId" = $1, "entityName" = $2
       WHERE "entityType" = 'member' AND "entityId" = $3`,
      [survivorId, survivorBusinessName, duplicateId]
    ),
    client.query(
      `UPDATE attachments
       SET "entityId" = $1
       WHERE "entityType" = 'member' AND "entityId" = $2`,
      [survivorId, duplicateId]
    ),
    client.query(
      `UPDATE users
       SET "memberId" = $1
       WHERE "memberId" = $2`,
      [survivorId, duplicateId]
    ),
  ]);

  if (!survivorHasLogo && duplicateMember.logoAttachmentId) {
    await client.query(
      `UPDATE members SET "logoAttachmentId" = $1 WHERE id = $2`,
      [duplicateMember.logoAttachmentId, survivorId]
    );
    survivorHasLogo = true;
  }

  await client.query('DELETE FROM members WHERE id = $1', [duplicateId]);

  return {
    duplicateId,
    contactLogReassigned: contactResult.rowCount,
    tasksReassigned: taskResult.rowCount,
    attachmentsReassigned: attachmentResult.rowCount,
    usersReassigned: userResult.rowCount,
    adoptedLogo: !survivorHadLogo && Boolean(duplicateMember.logoAttachmentId),
  };
}

async function applyPlan(groupPlans, existingMembersById, verbose) {
  const applied = {
    createdMembers: [],
    updatedMembers: [],
    mergedDuplicates: [],
  };

  await db.transaction(async (client) => {
    for (const plan of groupPlans) {
      if (plan.action === 'ambiguous') {
        throw new Error(`Ambiguous match for group "${plan.ownedByDisplay}". Resolve the report before applying.`);
      }

      let survivorId = plan.survivorId;
      let survivorHasLogo = false;
      const survivor = survivorId ? existingMembersById.get(survivorId) : null;

      if (plan.action === 'create') {
        survivorId = await createMember(client, plan.draft);
        applied.createdMembers.push({
          groupKey: plan.groupKey,
          ownedByDisplay: plan.ownedByDisplay,
          survivorId,
          licenseCount: plan.draft.licenseRows.length,
        });
        logVerbose(verbose, `Created member ${survivorId} for ${plan.ownedByDisplay}`);
      } else {
        await updateMember(client, survivorId, plan.draft);
        applied.updatedMembers.push({
          groupKey: plan.groupKey,
          ownedByDisplay: plan.ownedByDisplay,
          survivorId,
          duplicateIds: plan.duplicateIds,
          licenseCount: plan.draft.licenseRows.length,
        });
        survivorHasLogo = Boolean(survivor?.logoAttachmentId);
        logVerbose(verbose, `Updated member ${survivorId} for ${plan.ownedByDisplay}`);
      }

      for (const duplicateId of plan.duplicateIds) {
        const duplicate = existingMembersById.get(duplicateId);
        if (!duplicate) continue;
        const mergeResult = await reassignDuplicateMember(
          client,
          duplicate,
          survivorId,
          plan.draft.businessName,
          survivorHasLogo
        );
        if (!survivorHasLogo && duplicate.logoAttachmentId) survivorHasLogo = true;
        applied.mergedDuplicates.push({
          groupKey: plan.groupKey,
          survivorId,
          ...mergeResult,
        });
        logVerbose(verbose, `Merged duplicate member ${duplicateId} into ${survivorId}`);
      }
    }
  });

  return applied;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.file) throw new Error('--file is required');

  const absoluteFile = path.resolve(PROJECT_ROOT, args.file);
  if (!fs.existsSync(absoluteFile)) throw new Error(`CSV file not found: ${absoluteFile}`);

  const runSlug = timestampSlug();
  const reportPath = path.join(args.reportDir, `member-reconcile-${runSlug}.json`);
  const backupPath = path.join(args.backupDir, `member-reconcile-${runSlug}`);
  const csvText = fs.readFileSync(absoluteFile, 'utf8');
  const parsedCsv = parseCsvMembers(csvText, args.groupStatus);

  logVerbose(args.verbose, `Parsed ${parsedCsv.memberRows.length} member rows into ${parsedCsv.groups.length} groups`);

  const { members: existingMembers, relatedCounts } = await loadExistingSnapshot();
  const existingMembersById = new Map(existingMembers.map((member) => [member.id, member]));
  const { groupPlans, ambiguousExistingMembers, orphanedExistingMembers } = buildMatchCandidates(parsedCsv.groups, existingMembers, relatedCounts);
  const summary = summarizePlan(groupPlans, parsedCsv.memberRows, orphanedExistingMembers, ambiguousExistingMembers);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    file: absoluteFile,
    groupStatus: args.groupStatus,
    summary,
    ambiguousExistingMembers,
    orphanedExistingMembers,
    groups: groupPlans.map((plan) => ({
      groupKey: plan.groupKey,
      ownedByDisplay: plan.ownedByDisplay,
      ownedByMissing: plan.ownedByMissing,
      csvRowCount: plan.csvRowCount,
      businessNames: plan.businessNames,
      matchedMemberIds: plan.matchedMemberIds,
      survivorId: plan.survivorId,
      duplicateIds: plan.duplicateIds,
      action: plan.action,
      ambiguousExistingMemberIds: plan.ambiguousExistingMemberIds,
      licenseCount: plan.draft.licenseRows.length,
      licenseNumbers: plan.draft.licenseRows.map((row) => row.number),
    })),
  };

  if (args.apply) {
    if (summary.ambiguousGroups > 0) {
      writeJson(reportPath, report);
      throw new Error(`Apply aborted: ${summary.ambiguousGroups} ambiguous group(s) detected. Review ${reportPath}`);
    }

    await exportBackup(backupPath);
    const applied = await applyPlan(groupPlans, existingMembersById, args.verbose);
    report.applied = applied;
    report.backupPath = backupPath;
  }

  writeJson(reportPath, report);

  console.log(`Report written to ${reportPath}`);
  if (args.apply) {
    console.log(`Backup written to ${backupPath}`);
    console.log(`Applied ${report.applied.createdMembers.length} creates, ${report.applied.updatedMembers.length} updates, and ${report.applied.mergedDuplicates.length} duplicate merges.`);
  } else {
    console.log(`Dry run complete: ${summary.ownedByGroups} groups, ${summary.creates} creates, ${summary.updates} updates, ${summary.ambiguousGroups} ambiguous.`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
