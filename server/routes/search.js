const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ members: [], leads: [], contacts: [] });

  const pattern = `%${q}%`;

  try {
    const [members, leads, contacts] = await Promise.all([
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
        `SELECT id, "entityId", "entityType", "entityName", "contactDate", "contactType", summary, "nextAction"
         FROM contact_log
         WHERE "entityName" ILIKE $1 OR summary ILIKE $1 OR "nextAction" ILIKE $1
         ORDER BY "contactDate" DESC LIMIT 10`,
        [pattern]
      ),
    ]);

    res.json({ members: members.rows, leads: leads.rows, contacts: contacts.rows });
  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
