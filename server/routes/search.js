const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ members: [], leads: [], legislators: [], contacts: [] });

  const pattern = `%${q}%`;

  try {
    const [members, leads, legislators, contacts] = await Promise.all([
      db.query(
        `SELECT id, "businessName", "ownerName", email, phone, "licenseNo", county, "membershipTier"
         FROM members
         WHERE "businessName" ILIKE $1 OR "ownerName" ILIKE $1 OR email ILIKE $1
            OR phone ILIKE $1 OR "licenseNo" ILIKE $1 OR county ILIKE $1 OR notes ILIKE $1
         ORDER BY "businessName" LIMIT 10`,
        [pattern]
      ),
      db.query(
        `SELECT id, "businessName", "ownerName", email, phone, stage, priority, county
         FROM leads
         WHERE "businessName" ILIKE $1 OR "ownerName" ILIKE $1 OR email ILIKE $1
            OR phone ILIKE $1 OR "licenseNo" ILIKE $1 OR county ILIKE $1 OR notes ILIKE $1
         ORDER BY "businessName" LIMIT 10`,
        [pattern]
      ),
      db.query(
        `SELECT id, name, chamber, district, party, classification, grade, score
         FROM legislators
         WHERE name ILIKE $1 OR chamber ILIKE $1 OR district ILIKE $1 OR party ILIKE $1
            OR classification ILIKE $1 OR grade ILIKE $1 OR summary ILIKE $1 OR notes ILIKE $1
         ORDER BY
           CASE chamber WHEN 'Senate' THEN 1 WHEN 'House' THEN 2 ELSE 3 END,
           CASE WHEN district ~ '^[0-9]+$' THEN district::int ELSE 9999 END,
           name
         LIMIT 10`,
        [pattern]
      ),
      db.query(
        `SELECT id, "entityId", "entityType", "entityName", "contactDate", "contactType", summary, "nextAction"
         FROM contact_log
         WHERE "entityName" ILIKE $1 OR summary ILIKE $1 OR "nextAction" ILIKE $1
         ORDER BY "contactDate" DESC LIMIT 10`,
        [pattern]
      ),
    ]);

    res.json({ members: members.rows, leads: leads.rows, legislators: legislators.rows, contacts: contacts.rows });
  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
