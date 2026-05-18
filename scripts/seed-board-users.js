require('dotenv').config();

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const EMAILS = [
  'michael@rootdownms.com',
  'misti@kudzucc.com',
  'william.chism@riverremedyms.com',
  'cliff.osbon@ms.steephill.com',
  'doug@starbuds.us',
  'tkrumland2@gmail.com',
];
const PASSWORD = '3MABoard!';
const ROLE = 'admin';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  for (const email of EMAILS) {
    const result = await pool.query(
      `
        INSERT INTO users (email, "passwordHash", role)
        VALUES ($1, $2, $3)
        ON CONFLICT (email)
        DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", role = EXCLUDED.role
        RETURNING id, email, role, (xmax = 0) AS inserted
      `,
      [email.toLowerCase(), passwordHash, ROLE]
    );
    const row = result.rows[0];
    console.log(`${row.inserted ? 'created' : 'updated'}: ${row.email} (id=${row.id}, role=${row.role})`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
