const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required. Set it in your .env file before starting the server.');
}

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSLMODE === 'require' || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

let readyPromise;

async function query(text, params = []) {
  return pool.query(text, params);
}

async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function seedDefaultSettings(client) {
  const defaults = [
    ['userName', 'Executive Director'],
    ['userTitle', 'Executive Director'],
    ['organizationName', '3MA'],
    ['tierPricing', '{}'],
  ];

  for (const [key, value] of defaults) {
    await client.query(
      `
        INSERT INTO settings ("key", value)
        VALUES ($1, $2)
        ON CONFLICT ("key") DO NOTHING
      `,
      [key, value]
    );
  }
}

async function seedAdminUser(client) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) return;

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await client.query(
    `
      INSERT INTO users (email, "passwordHash", role)
      VALUES ($1, $2, 'admin')
      ON CONFLICT (email)
      DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", role = 'admin'
    `,
    [adminEmail.toLowerCase(), passwordHash]
  );
}

async function ready() {
  if (!readyPromise) {
    readyPromise = transaction(async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS members (
          id SERIAL PRIMARY KEY,
          "businessName" TEXT NOT NULL,
          "licenseNo" TEXT,
          "licenseType" TEXT,
          county TEXT,
          "ownerName" TEXT,
          phone TEXT,
          email TEXT,
          "joinDate" TEXT,
          "renewalDate" TEXT,
          "duesAmount" NUMERIC(12, 2),
          "membershipTier" TEXT,
          benefits TEXT DEFAULT '[]',
          notes TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS leads (
          id SERIAL PRIMARY KEY,
          "businessName" TEXT NOT NULL,
          "licenseNo" TEXT,
          "licenseType" TEXT,
          county TEXT,
          "ownerName" TEXT,
          phone TEXT,
          email TEXT,
          stage TEXT DEFAULT 'New',
          priority TEXT DEFAULT 'Medium',
          "lastContactDate" TEXT,
          "nextContactDate" TEXT,
          notes TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
          "key" TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS contact_log (
          id SERIAL PRIMARY KEY,
          "entityId" INTEGER NOT NULL,
          "entityType" TEXT NOT NULL CHECK ("entityType" IN ('member', 'lead')),
          "entityName" TEXT,
          "contactDate" TEXT NOT NULL,
          "contactType" TEXT,
          summary TEXT,
          "nextAction" TEXT,
          "nextActionDate" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS attachments (
          id SERIAL PRIMARY KEY,
          "entityType" TEXT NOT NULL CHECK ("entityType" IN ('member', 'lead')),
          "entityId" INTEGER NOT NULL,
          filename TEXT NOT NULL,
          "mimeType" TEXT,
          "sizeBytes" BIGINT,
          "r2Key" TEXT NOT NULL UNIQUE,
          "uploadedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments ("entityType", "entityId");

        CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          "dueDate" TEXT,
          completed BOOLEAN NOT NULL DEFAULT FALSE,
          "completedAt" TIMESTAMP,
          priority TEXT DEFAULT 'Medium',
          "entityType" TEXT CHECK ("entityType" IN ('member', 'lead')),
          "entityId" INTEGER,
          "entityName" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks ("dueDate") WHERE completed = FALSE;
        CREATE INDEX IF NOT EXISTS idx_tasks_entity ON tasks ("entityType", "entityId");

        ALTER TABLE contact_log ADD COLUMN IF NOT EXISTS subject TEXT;
        ALTER TABLE contact_log ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('inbound', 'outbound'));
        ALTER TABLE members ADD COLUMN IF NOT EXISTS "logoAttachmentId" INTEGER REFERENCES attachments(id) ON DELETE SET NULL;
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS "logoAttachmentId" INTEGER REFERENCES attachments(id) ON DELETE SET NULL;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "sourceContactLogId" INTEGER UNIQUE REFERENCES contact_log(id) ON DELETE CASCADE;

        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          "passwordHash" TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
          "memberId" INTEGER REFERENCES members(id) ON DELETE SET NULL,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS goals (
          id SERIAL PRIMARY KEY,
          category TEXT NOT NULL CHECK (category IN ('fundraising', 'membership', 'conversions', 'custom')),
          title TEXT NOT NULL,
          description TEXT,
          "targetValue" NUMERIC(14, 2) NOT NULL,
          "manualValue" NUMERIC(14, 2) DEFAULT 0,
          "startDate" DATE NOT NULL,
          "endDate" DATE NOT NULL,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await seedDefaultSettings(client);
      await seedAdminUser(client);
    });
  }

  return readyPromise;
}

module.exports = {
  pool,
  query,
  ready,
  transaction,
};
