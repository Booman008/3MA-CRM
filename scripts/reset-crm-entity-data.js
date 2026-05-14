#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const db = require('../server/database');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENTITY_TYPES = ['member', 'lead'];
let r2Module;

function getR2() {
  if (r2Module !== undefined) return r2Module;
  try {
    r2Module = require('../server/r2');
  } catch {
    r2Module = null;
  }
  return r2Module;
}

function isR2Configured() {
  const r2 = getR2();
  return Boolean(r2 && r2.isConfigured());
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    apply: false,
    backupDir: path.join(PROJECT_ROOT, 'backups'),
    reportDir: path.join(PROJECT_ROOT, 'reports'),
    verbose: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--backup-dir') args.backupDir = path.resolve(PROJECT_ROOT, argv[++i] || 'backups');
    else if (arg === '--report-dir') args.reportDir = path.resolve(PROJECT_ROOT, argv[++i] || 'reports');
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
  node scripts/reset-crm-entity-data.js --dry-run
  node scripts/reset-crm-entity-data.js --apply

Options:
  --dry-run             Build a report only; do not mutate the database
  --apply               Delete members, leads, and linked history
  --backup-dir <path>   Directory for JSON backups (default: backups/)
  --report-dir <path>   Directory for JSON reports (default: reports/)
  --verbose             Print detailed progress logs
`);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
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

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function logVerbose(enabled, ...args) {
  if (enabled) console.log(...args);
}

async function loadSnapshot() {
  const [members, leads, contactLog, tasks, attachments, users] = await Promise.all([
    db.query('SELECT * FROM members ORDER BY id'),
    db.query('SELECT * FROM leads ORDER BY id'),
    db.query(`SELECT * FROM contact_log WHERE "entityType" = ANY($1::text[]) ORDER BY id`, [ENTITY_TYPES]),
    db.query(`SELECT * FROM tasks WHERE "entityType" = ANY($1::text[]) ORDER BY id`, [ENTITY_TYPES]),
    db.query(`SELECT * FROM attachments WHERE "entityType" = ANY($1::text[]) ORDER BY id`, [ENTITY_TYPES]),
    db.query('SELECT * FROM users ORDER BY id'),
  ]);

  const usersLinkedToMembers = users.rows.filter((user) => user.memberId != null);
  const memberLogoCount = members.rows.filter((member) => member.logoAttachmentId != null).length;
  const leadLogoCount = leads.rows.filter((lead) => lead.logoAttachmentId != null).length;

  return {
    members: members.rows,
    leads: leads.rows,
    contactLog: contactLog.rows,
    tasks: tasks.rows,
    attachments: attachments.rows,
    users: users.rows,
    counts: {
      members: members.rowCount,
      leads: leads.rowCount,
      memberContactLog: contactLog.rows.filter((row) => row.entityType === 'member').length,
      leadContactLog: contactLog.rows.filter((row) => row.entityType === 'lead').length,
      memberTasks: tasks.rows.filter((row) => row.entityType === 'member').length,
      leadTasks: tasks.rows.filter((row) => row.entityType === 'lead').length,
      memberAttachments: attachments.rows.filter((row) => row.entityType === 'member').length,
      leadAttachments: attachments.rows.filter((row) => row.entityType === 'lead').length,
      memberLogos: memberLogoCount,
      leadLogos: leadLogoCount,
      linkedUsers: usersLinkedToMembers.length,
    },
  };
}

async function exportBackup(snapshot, backupPath) {
  ensureDir(backupPath);
  writeJson(path.join(backupPath, 'members.json'), snapshot.members);
  writeJson(path.join(backupPath, 'leads.json'), snapshot.leads);
  writeJson(path.join(backupPath, 'contact_log.json'), snapshot.contactLog);
  writeJson(path.join(backupPath, 'tasks.json'), snapshot.tasks);
  writeJson(path.join(backupPath, 'attachments.json'), snapshot.attachments);
  writeJson(path.join(backupPath, 'users.json'), snapshot.users);
}

async function deleteR2Objects(attachments, verbose) {
  const result = {
    attempted: 0,
    deleted: 0,
    skipped: 0,
    failures: [],
  };

  const r2 = getR2();
  if (!r2 || !r2.isConfigured()) {
    result.skipped = attachments.length;
    return result;
  }

  for (const attachment of attachments) {
    if (!attachment.r2Key) continue;
    result.attempted += 1;
    try {
      await r2.deleteObject(attachment.r2Key);
      result.deleted += 1;
      logVerbose(verbose, `Deleted R2 object ${attachment.r2Key}`);
    } catch (error) {
      result.failures.push({
        attachmentId: attachment.id,
        entityType: attachment.entityType,
        entityId: attachment.entityId,
        r2Key: attachment.r2Key,
        error: error.message,
      });
    }
  }

  if (result.failures.length > 0) {
    throw new Error(`Failed to delete ${result.failures.length} R2 object(s); aborting reset`);
  }

  return result;
}

async function applyReset(verbose) {
  return db.transaction(async (client) => {
    const deletedCounts = {};

    const usersResult = await client.query(
      'UPDATE users SET "memberId" = NULL WHERE "memberId" IS NOT NULL'
    );
    deletedCounts.usersCleared = usersResult.rowCount;

    await client.query('UPDATE members SET "logoAttachmentId" = NULL WHERE "logoAttachmentId" IS NOT NULL');
    await client.query('UPDATE leads SET "logoAttachmentId" = NULL WHERE "logoAttachmentId" IS NOT NULL');

    const contactLogResult = await client.query(
      `DELETE FROM contact_log WHERE "entityType" = ANY($1::text[])`,
      [ENTITY_TYPES]
    );
    deletedCounts.contactLog = contactLogResult.rowCount;

    const tasksResult = await client.query(
      `DELETE FROM tasks WHERE "entityType" = ANY($1::text[])`,
      [ENTITY_TYPES]
    );
    deletedCounts.tasks = tasksResult.rowCount;

    const attachmentsResult = await client.query(
      `DELETE FROM attachments WHERE "entityType" = ANY($1::text[])`,
      [ENTITY_TYPES]
    );
    deletedCounts.attachments = attachmentsResult.rowCount;

    const membersResult = await client.query('DELETE FROM members');
    deletedCounts.members = membersResult.rowCount;

    const leadsResult = await client.query('DELETE FROM leads');
    deletedCounts.leads = leadsResult.rowCount;

    logVerbose(verbose, 'Database reset transaction complete');
    return deletedCounts;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  await db.ready();

  const runSlug = timestampSlug();
  const reportPath = path.join(args.reportDir, `crm-reset-${runSlug}.json`);
  const backupPath = path.join(args.backupDir, `crm-reset-${runSlug}`);
  const snapshot = await loadSnapshot();

  const report = {
    generatedAt: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    countsBefore: snapshot.counts,
    r2Configured: isR2Configured(),
  };

  if (args.apply) {
    await exportBackup(snapshot, backupPath);
    report.backupPath = backupPath;

    const r2Result = await deleteR2Objects(snapshot.attachments, args.verbose);
    report.r2 = r2Result;

    const deletedCounts = await applyReset(args.verbose);
    report.deleted = deletedCounts;
  }

  writeJson(reportPath, report);

  console.log(`Report written to ${reportPath}`);
  if (args.apply) {
    console.log(`Backup written to ${backupPath}`);
    console.log(`Deleted ${report.deleted.members} members, ${report.deleted.leads} leads, ${report.deleted.contactLog} contact log rows, ${report.deleted.tasks} tasks, and ${report.deleted.attachments} attachments.`);
  } else {
    console.log(`Dry run complete: ${snapshot.counts.members} members, ${snapshot.counts.leads} leads, ${snapshot.counts.memberContactLog + snapshot.counts.leadContactLog} contact log rows, ${snapshot.counts.memberTasks + snapshot.counts.leadTasks} tasks, and ${snapshot.counts.memberAttachments + snapshot.counts.leadAttachments} attachments would be removed.`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
