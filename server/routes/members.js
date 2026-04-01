const express = require('express');

const db = require('../database');

const router = express.Router();

function normalizeMember(row) {
  if (!row) return row;
  return {
    ...row,
    duesAmount: row.duesAmount == null ? null : Number(row.duesAmount),
  };
}

router.get('/', async (req, res) => {
  const { search, county, tier } = req.query;
  const conditions = [];
  const params = [];

  if (search) {
    const term = `%${search}%`;
    params.push(term);
    conditions.push(`("businessName" ILIKE $${params.length} OR "ownerName" ILIKE $${params.length} OR "licenseNo" ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }

  if (county) {
    params.push(county);
    conditions.push(`county = $${params.length}`);
  }

  if (tier) {
    params.push(tier);
    conditions.push(`"membershipTier" = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await db.query(
      `
        SELECT id, "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
               "joinDate", "renewalDate", "duesAmount", "membershipTier", benefits, notes, "createdAt"
        FROM members
        ${whereClause}
        ORDER BY "createdAt" DESC
      `,
      params
    );

    res.json(result.rows.map(normalizeMember));
  } catch (error) {
    console.error('Failed to load members:', error);
    res.status(500).json({ error: 'Failed to load members' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `
        SELECT id, "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
               "joinDate", "renewalDate", "duesAmount", "membershipTier", benefits, notes, "createdAt"
        FROM members
        WHERE id = $1
      `,
      [req.params.id]
    );

    const member = normalizeMember(result.rows[0]);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    res.json(member);
  } catch (error) {
    console.error('Failed to load member:', error);
    res.status(500).json({ error: 'Failed to load member' });
  }
});

router.post('/', async (req, res) => {
  const {
    businessName,
    licenseNo,
    licenseType,
    county,
    ownerName,
    phone,
    email,
    joinDate,
    renewalDate,
    duesAmount,
    membershipTier,
    benefits,
    notes,
  } = req.body || {};

  if (!businessName) {
    return res.status(400).json({ error: 'businessName is required' });
  }

  try {
    const result = await db.query(
      `
        INSERT INTO members (
          "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
          "joinDate", "renewalDate", "duesAmount", "membershipTier", benefits, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
                  "joinDate", "renewalDate", "duesAmount", "membershipTier", benefits, notes, "createdAt"
      `,
      [
        businessName,
        licenseNo || null,
        licenseType || null,
        county || null,
        ownerName || null,
        phone || null,
        email || null,
        joinDate || null,
        renewalDate || null,
        duesAmount ?? null,
        membershipTier || null,
        JSON.stringify(benefits || []),
        notes || null,
      ]
    );

    res.status(201).json(normalizeMember(result.rows[0]));
  } catch (error) {
    console.error('Failed to create member:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

router.put('/:id', async (req, res) => {
  const {
    businessName,
    licenseNo,
    licenseType,
    county,
    ownerName,
    phone,
    email,
    joinDate,
    renewalDate,
    duesAmount,
    membershipTier,
    benefits,
    notes,
  } = req.body || {};

  try {
    const result = await db.query(
      `
        UPDATE members
        SET "businessName" = COALESCE($1, "businessName"),
            "licenseNo" = COALESCE($2, "licenseNo"),
            "licenseType" = COALESCE($3, "licenseType"),
            county = COALESCE($4, county),
            "ownerName" = COALESCE($5, "ownerName"),
            phone = COALESCE($6, phone),
            email = COALESCE($7, email),
            "joinDate" = COALESCE($8, "joinDate"),
            "renewalDate" = COALESCE($9, "renewalDate"),
            "duesAmount" = COALESCE($10, "duesAmount"),
            "membershipTier" = COALESCE($11, "membershipTier"),
            benefits = COALESCE($12, benefits),
            notes = COALESCE($13, notes)
        WHERE id = $14
        RETURNING id, "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
                  "joinDate", "renewalDate", "duesAmount", "membershipTier", benefits, notes, "createdAt"
      `,
      [
        businessName ?? null,
        licenseNo ?? null,
        licenseType ?? null,
        county ?? null,
        ownerName ?? null,
        phone ?? null,
        email ?? null,
        joinDate ?? null,
        renewalDate ?? null,
        duesAmount ?? null,
        membershipTier ?? null,
        benefits !== undefined ? JSON.stringify(benefits) : null,
        notes ?? null,
        req.params.id,
      ]
    );

    const updated = normalizeMember(result.rows[0]);
    if (!updated) return res.status(404).json({ error: 'Member not found' });

    res.json(updated);
  } catch (error) {
    console.error('Failed to update member:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.transaction(async (client) => {
      const existing = await client.query('SELECT id FROM members WHERE id = $1', [req.params.id]);
      if (existing.rowCount === 0) {
        const notFound = new Error('Member not found');
        notFound.statusCode = 404;
        throw notFound;
      }

      await client.query('DELETE FROM contact_log WHERE "entityType" = $1 AND "entityId" = $2', ['member', req.params.id]);
      await client.query('DELETE FROM members WHERE id = $1', [req.params.id]);
    });

    res.json({ message: 'Member deleted' });
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ error: error.message });
    console.error('Failed to delete member:', error);
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

module.exports = router;
