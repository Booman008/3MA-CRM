#!/usr/bin/env node
/**
 * One-time migration: SQLite (crm.db) → PostgreSQL (Render)
 *
 * Usage:
 *   node scripts/migrate-sqlite-to-postgres.js "postgres://user:pass@host/dbname"
 *
 * Pass your Render EXTERNAL Database URL as the argument.
 * (Find it in Render dashboard → your Postgres service → Connections → External Database URL)
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DB_PATH = path.join(__dirname, '..', 'server', 'crm.db');
const pgUrl = process.argv[2];

if (!pgUrl) {
  console.error('\nUsage: node scripts/migrate-sqlite-to-postgres.js "<EXTERNAL_DATABASE_URL>"\n');
  console.error('Find your External Database URL in the Render dashboard:');
  console.error('  → PostgreSQL service → Connections → External Database URL\n');
  process.exit(1);
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`\nSQLite file not found at: ${DB_PATH}`);
  console.error('Nothing to migrate.\n');
  process.exit(1);
}

async function main() {
  // ── Load SQLite via sql.js ──────────────────────────────────────────────
  console.log('Loading sql.js...');
  let initSqlJs;
  try {
    initSqlJs = require('sql.js');
  } catch {
    console.log('sql.js not installed — installing temporarily...');
    require('child_process').execSync('npm install sql.js --no-save', { stdio: 'inherit' });
    initSqlJs = require('sql.js');
  }

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const sqlite = new SQL.Database(fileBuffer);

  // ── Connect to Postgres ─────────────────────────────────────────────────
  console.log('Connecting to PostgreSQL...');
  const pool = new Pool({
    connectionString: pgUrl,
    ssl: { rejectUnauthorized: false },
  });

  // Test connection
  const test = await pool.query('SELECT NOW()');
  console.log(`Connected to Postgres at ${test.rows[0].now}\n`);

  // ── Helper: read all rows from a SQLite table ───────────────────────────
  function readTable(name) {
    const stmt = sqlite.prepare(`SELECT * FROM ${name}`);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  // ── Migrate Members ─────────────────────────────────────────────────────
  const members = readTable('members');
  console.log(`Members to migrate: ${members.length}`);

  let membersMigrated = 0;
  for (const m of members) {
    try {
      await pool.query(
        `INSERT INTO members (
          "businessName", "licenseNo", "licenseType", county, "ownerName",
          phone, email, "joinDate", "renewalDate", "duesAmount",
          "membershipTier", benefits, notes, "createdAt"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT DO NOTHING`,
        [
          m.businessName,
          m.licenseNo || null,
          m.licenseType || null,
          m.county || null,
          m.ownerName || null,
          m.phone || null,
          m.email || null,
          m.joinDate || null,
          m.renewalDate || null,
          m.duesAmount != null ? m.duesAmount : null,
          m.membershipTier || null,
          m.benefits || '[]',
          m.notes || null,
          m.createdAt || new Date().toISOString(),
        ]
      );
      membersMigrated++;
    } catch (err) {
      console.error(`  Failed to migrate member "${m.businessName}":`, err.message);
    }
  }
  console.log(`  ✓ ${membersMigrated} members migrated\n`);

  // ── Migrate Leads ───────────────────────────────────────────────────────
  const leads = readTable('leads');
  console.log(`Leads to migrate: ${leads.length}`);

  let leadsMigrated = 0;
  for (const l of leads) {
    try {
      await pool.query(
        `INSERT INTO leads (
          "businessName", "licenseNo", "licenseType", county, "ownerName",
          phone, email, stage, priority, "lastContactDate",
          "nextContactDate", notes, "createdAt"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT DO NOTHING`,
        [
          l.businessName,
          l.licenseNo || null,
          l.licenseType || null,
          l.county || null,
          l.ownerName || null,
          l.phone || null,
          l.email || null,
          l.stage || 'New',
          l.priority || 'Medium',
          l.lastContactDate || null,
          l.nextContactDate || null,
          l.notes || null,
          l.createdAt || new Date().toISOString(),
        ]
      );
      leadsMigrated++;
    } catch (err) {
      console.error(`  Failed to migrate lead "${l.businessName}":`, err.message);
    }
  }
  console.log(`  ✓ ${leadsMigrated} leads migrated\n`);

  // ── Migrate Contact Log ─────────────────────────────────────────────────
  const contacts = readTable('contact_log');
  console.log(`Contact log entries to migrate: ${contacts.length}`);

  let contactsMigrated = 0;
  for (const c of contacts) {
    try {
      await pool.query(
        `INSERT INTO contact_log (
          "entityId", "entityType", "entityName", "contactDate", "contactType",
          summary, "nextAction", "nextActionDate", "createdAt"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT DO NOTHING`,
        [
          c.entityId,
          c.entityType,
          c.entityName || null,
          c.contactDate,
          c.contactType || null,
          c.summary || null,
          c.nextAction || null,
          c.nextActionDate || null,
          c.createdAt || new Date().toISOString(),
        ]
      );
      contactsMigrated++;
    } catch (err) {
      console.error(`  Failed to migrate contact log entry #${c.id}:`, err.message);
    }
  }
  console.log(`  ✓ ${contactsMigrated} contact log entries migrated\n`);

  // ── Migrate Settings ────────────────────────────────────────────────────
  let settingRows = [];
  try { settingRows = readTable('settings'); } catch {}
  if (settingRows.length > 0) {
    console.log(`Settings to migrate: ${settingRows.length}`);
    let settingsMigrated = 0;
    for (const s of settingRows) {
      try {
        await pool.query(
          `INSERT INTO settings ("key", value) VALUES ($1, $2)
           ON CONFLICT ("key") DO UPDATE SET value = EXCLUDED.value`,
          [s.key, s.value]
        );
        settingsMigrated++;
      } catch (err) {
        console.error(`  Failed to migrate setting "${s.key}":`, err.message);
      }
    }
    console.log(`  ✓ ${settingsMigrated} settings migrated\n`);
  }

  // ── Done ────────────────────────────────────────────────────────────────
  console.log('════════════════════════════════════════');
  console.log('  Migration complete!');
  console.log(`  Members:      ${membersMigrated}/${members.length}`);
  console.log(`  Leads:        ${leadsMigrated}/${leads.length}`);
  console.log(`  Contacts:     ${contactsMigrated}/${contacts.length}`);
  console.log(`  Settings:     ${settingRows.length}`);
  console.log('════════════════════════════════════════');

  sqlite.close();
  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('\nMigration failed:', err);
  process.exit(1);
});
