#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const db = require('../server/database');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_FILE = '3MA Mississippi Legislature Tracksheet - Scorecard_Public (1).csv';

function parseArgs(argv) {
  const args = {
    file: DEFAULT_FILE,
    apply: false,
    reportDir: path.join(PROJECT_ROOT, 'reports'),
    backupDir: path.join(PROJECT_ROOT, 'backups'),
    verbose: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--file') args.file = argv[++i] || DEFAULT_FILE;
    else if (arg === '--dry-run') args.apply = false;
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--report-dir') args.reportDir = path.resolve(PROJECT_ROOT, argv[++i] || 'reports');
    else if (arg === '--backup-dir') args.backupDir = path.resolve(PROJECT_ROOT, argv[++i] || 'backups');
    else if (arg === '--verbose') args.verbose = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/import-legislators-from-csv.js --file "${DEFAULT_FILE}" --dry-run
  node scripts/import-legislators-from-csv.js --file "${DEFAULT_FILE}" --apply

Options:
  --file <path>       CSV file to import (default: ${DEFAULT_FILE})
  --dry-run           Build a report only; do not mutate the database
  --apply             Apply the import/upsert transaction
  --report-dir <path> Directory for JSON reports (default: reports/)
  --backup-dir <path> Directory for JSON backups before --apply (default: backups/)
  --verbose           Print per-row progress logs
`);
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
  const stripped = String(text).replace(/^\uFEFF/, '').replace(/^ï»¿/, '');

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

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeHeader(value) {
  return normalizeText(value);
}

function parseNumber(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const number = Number(text.replace(/,/g, ''));
  return Number.isFinite(number) ? number : null;
}

function parseBoolean(value, defaultValue = false) {
  const text = normalizeText(value);
  if (!text) return defaultValue;
  return ['yes', 'y', 'true', '1'].includes(text);
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function requiredIndex(headers, name) {
  const index = headers.findIndex((header) => header === normalizeHeader(name));
  if (index < 0) throw new Error(`CSV is missing required column: ${name}`);
  return index;
}

function optionalIndex(headers, name) {
  const index = headers.findIndex((header) => header === normalizeHeader(name));
  return index < 0 ? null : index;
}

function cell(row, index) {
  if (index == null) return '';
  return String(row[index] || '').trim();
}

function parseLegislators(csvText) {
  const rows = parseCSV(csvText);
  if (rows.length < 2) throw new Error('CSV has no data rows');

  const rawHeaders = rows[0];
  const headers = rawHeaders.map(normalizeHeader);
  const indexes = {
    name: requiredIndex(headers, 'Legislator Name'),
    chamber: requiredIndex(headers, 'Chamber'),
    district: requiredIndex(headers, 'District'),
    party: optionalIndex(headers, 'Party'),
    score: optionalIndex(headers, 'Score'),
    grade: optionalIndex(headers, 'Grade'),
    classification: optionalIndex(headers, 'Classification'),
    historicalVoteScore: optionalIndex(headers, 'Historical Vote Score'),
    summary: optionalIndex(headers, 'Summary'),
    contactLink: optionalIndex(headers, 'Contact Link'),
    eligibleWeight: optionalIndex(headers, 'Eligible Weight'),
    publish: optionalIndex(headers, 'Publish?'),
    slug: optionalIndex(headers, 'Slug'),
    featured: optionalIndex(headers, 'Featured?'),
  };

  const voteStart = indexes.party == null ? indexes.district + 1 : indexes.party + 1;
  const voteEnd = indexes.score == null ? rawHeaders.length : indexes.score;
  const voteColumns = rawHeaders
    .map((label, index) => ({ label: String(label || '').trim(), index }))
    .filter(({ label, index }) => label && index >= voteStart && index < voteEnd);

  return rows.slice(1).map((row, index) => {
    const name = cell(row, indexes.name);
    const chamber = cell(row, indexes.chamber);
    const district = cell(row, indexes.district);
    const voteRecord = {};
    for (const { label, index: voteIndex } of voteColumns) {
      const value = cell(row, voteIndex);
      if (value) voteRecord[label] = value;
    }
    const slug = cell(row, indexes.slug) || slugify(name);
    return {
      csvRowNumber: index + 2,
      name,
      chamber,
      district,
      party: cell(row, indexes.party) || null,
      score: parseNumber(cell(row, indexes.score)),
      grade: cell(row, indexes.grade) || null,
      classification: cell(row, indexes.classification) || null,
      historicalVoteScore: parseNumber(cell(row, indexes.historicalVoteScore)),
      summary: cell(row, indexes.summary) || null,
      contactLink: cell(row, indexes.contactLink) || null,
      eligibleWeight: parseNumber(cell(row, indexes.eligibleWeight)),
      publish: parseBoolean(cell(row, indexes.publish), true),
      slug: slug || null,
      featured: parseBoolean(cell(row, indexes.featured), false),
      voteRecord,
      matchKey: [normalizeText(name), normalizeText(chamber), normalizeText(district)].join('\u001f'),
    };
  }).filter((row) => row.name && row.chamber && row.district);
}

async function loadExisting() {
  const result = await db.query('SELECT * FROM legislators ORDER BY id');
  return result.rows.map((row) => ({
    ...row,
    matchKey: [normalizeText(row.name), normalizeText(row.chamber), normalizeText(row.district)].join('\u001f'),
  }));
}

function buildPlans(parsed, existing) {
  const bySlug = new Map(existing.filter((row) => row.slug).map((row) => [normalizeText(row.slug), row]));
  const byMatchKey = new Map(existing.map((row) => [row.matchKey, row]));
  const seenExistingIds = new Set();

  const plans = parsed.map((row) => {
    const existingRow = (row.slug && bySlug.get(normalizeText(row.slug))) || byMatchKey.get(row.matchKey) || null;
    if (existingRow) seenExistingIds.add(existingRow.id);
    return {
      action: existingRow ? 'update' : 'create',
      existingId: existingRow?.id || null,
      csvRowNumber: row.csvRowNumber,
      name: row.name,
      chamber: row.chamber,
      district: row.district,
      slug: row.slug,
      draft: row,
    };
  });

  const unchangedExisting = existing
    .filter((row) => !seenExistingIds.has(row.id))
    .map((row) => ({ id: row.id, name: row.name, chamber: row.chamber, district: row.district, slug: row.slug }));

  return { plans, unchangedExisting };
}

async function exportBackup(dirPath) {
  ensureDir(dirPath);
  const [legislators, events, contactLog, tasks, attachments] = await Promise.all([
    db.query('SELECT * FROM legislators ORDER BY id'),
    db.query('SELECT * FROM legislator_events ORDER BY id'),
    db.query(`SELECT * FROM contact_log WHERE "entityType" = 'legislator' ORDER BY id`),
    db.query(`SELECT * FROM tasks WHERE "entityType" = 'legislator' ORDER BY id`),
    db.query(`SELECT * FROM attachments WHERE "entityType" = 'legislator' ORDER BY id`),
  ]);

  writeJson(path.join(dirPath, 'legislators.json'), legislators.rows);
  writeJson(path.join(dirPath, 'legislator_events.json'), events.rows);
  writeJson(path.join(dirPath, 'contact_log.json'), contactLog.rows);
  writeJson(path.join(dirPath, 'tasks.json'), tasks.rows);
  writeJson(path.join(dirPath, 'attachments.json'), attachments.rows);
}

async function upsertLegislator(client, plan) {
  const draft = plan.draft;
  const params = [
    draft.name,
    draft.slug,
    draft.chamber,
    draft.district,
    draft.party,
    draft.score,
    draft.grade,
    draft.classification,
    draft.historicalVoteScore,
    draft.summary,
    draft.contactLink,
    draft.eligibleWeight,
    draft.publish,
    draft.featured,
    JSON.stringify(draft.voteRecord || {}),
  ];

  if (plan.action === 'create') {
    const result = await client.query(
      `
        INSERT INTO legislators (
          name, slug, chamber, district, party, score, grade, classification,
          "historicalVoteScore", summary, "contactLink", "eligibleWeight",
          publish, featured, "voteRecord"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
      `,
      params
    );
    return result.rows[0].id;
  }

  params.push(plan.existingId);
  await client.query(
    `
      UPDATE legislators
      SET name = $1,
          slug = $2,
          chamber = $3,
          district = $4,
          party = $5,
          score = $6,
          grade = $7,
          classification = $8,
          "historicalVoteScore" = $9,
          summary = $10,
          "contactLink" = $11,
          "eligibleWeight" = $12,
          publish = $13,
          featured = $14,
          "voteRecord" = $15,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $16
    `,
    params
  );
  return plan.existingId;
}

async function applyPlans(plans, verbose) {
  const applied = { created: [], updated: [] };
  await db.transaction(async (client) => {
    for (const plan of plans) {
      const id = await upsertLegislator(client, plan);
      const target = plan.action === 'create' ? applied.created : applied.updated;
      target.push({ id, csvRowNumber: plan.csvRowNumber, name: plan.name, chamber: plan.chamber, district: plan.district, slug: plan.slug });
      if (verbose) console.log(`${plan.action === 'create' ? 'Created' : 'Updated'} legislator ${id}: ${plan.name}`);
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

  const absoluteFile = path.resolve(PROJECT_ROOT, args.file);
  if (!fs.existsSync(absoluteFile)) throw new Error(`CSV file not found: ${absoluteFile}`);

  await db.ready();

  const csvText = fs.readFileSync(absoluteFile, 'utf8');
  const parsed = parseLegislators(csvText);
  const existing = await loadExisting();
  const { plans, unchangedExisting } = buildPlans(parsed, existing);

  const runSlug = timestampSlug();
  const reportPath = path.join(args.reportDir, `legislator-import-${runSlug}.json`);
  const backupPath = path.join(args.backupDir, `legislator-import-${runSlug}`);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    file: absoluteFile,
    summary: {
      csvRows: parsed.length,
      existingLegislators: existing.length,
      creates: plans.filter((plan) => plan.action === 'create').length,
      updates: plans.filter((plan) => plan.action === 'update').length,
      unchangedExisting: unchangedExisting.length,
    },
    plans: plans.map((plan) => ({
      action: plan.action,
      existingId: plan.existingId,
      csvRowNumber: plan.csvRowNumber,
      name: plan.name,
      chamber: plan.chamber,
      district: plan.district,
      slug: plan.slug,
      voteCount: Object.keys(plan.draft.voteRecord || {}).length,
    })),
    unchangedExisting,
  };

  if (args.apply) {
    await exportBackup(backupPath);
    report.backupPath = backupPath;
    report.applied = await applyPlans(plans, args.verbose);
  }

  writeJson(reportPath, report);

  console.log(`Report written to ${reportPath}`);
  if (args.apply) {
    console.log(`Backup written to ${backupPath}`);
    console.log(`Applied ${report.applied.created.length} creates and ${report.applied.updated.length} updates.`);
  } else {
    console.log(`Dry run complete: ${report.summary.csvRows} CSV rows, ${report.summary.creates} creates, ${report.summary.updates} updates.`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
