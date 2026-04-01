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

        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          "passwordHash" TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
          "memberId" INTEGER REFERENCES members(id) ON DELETE SET NULL,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
