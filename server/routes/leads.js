const express = require('express');

const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  const { search, stage, priority, county } = req.query;
  const conditions = [];
  const params = [];

  if (search) {
    const term = `%${search}%`;
    params.push(term);
    conditions.push(`("businessName" ILIKE $${params.length} OR "ownerName" ILIKE $${params.length} OR "licenseNo" ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }

  if (stage) {
    params.push(stage);
    conditions.push(`stage = $${params.length}`);
  }

  if (priority) {
    params.push(priority);
    conditions.push(`priority = $${params.length}`);
  }

  if (county) {
    params.push(county);
    conditions.push(`county = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await db.query(
      `
        SELECT id, "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
               stage, priority, "lastContactDate", "nextContactDate", notes, "createdAt"
        FROM leads
        ${whereClause}
        ORDER BY "createdAt" DESC
      `,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Failed to load leads:', error);
    res.status(500).json({ error: 'Failed to load leads' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `
        SELECT id, "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
               stage, priority, "lastContactDate", "nextContactDate", notes, "createdAt"
        FROM leads
        WHERE id = $1
      `,
      [req.params.id]
    );

    const lead = result.rows[0];
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    res.json(lead);
  } catch (error) {
    console.error('Failed to load lead:', error);
    res.status(500).json({ error: 'Failed to load lead' });
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
    stage,
    priority,
    lastContactDate,
    nextContactDate,
    notes,
  } = req.body || {};

  if (!businessName) {
    return res.status(400).json({ error: 'businessName is required' });
  }

  try {
    const result = await db.query(
      `
        INSERT INTO leads (
          "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
          stage, priority, "lastContactDate", "nextContactDate", notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
                  stage, priority, "lastContactDate", "nextContactDate", notes, "createdAt"
      `,
      [
        businessName,
        licenseNo || null,
        licenseType || null,
        county || null,
        ownerName || null,
        phone || null,
        email || null,
        stage || 'New',
        priority || 'Medium',
        lastContactDate || null,
        nextContactDate || null,
        notes || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to create lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
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
    stage,
    priority,
    lastContactDate,
    nextContactDate,
    notes,
  } = req.body || {};

  try {
    const result = await db.query(
      `
        UPDATE leads
        SET "businessName" = COALESCE($1, "businessName"),
            "licenseNo" = COALESCE($2, "licenseNo"),
            "licenseType" = COALESCE($3, "licenseType"),
            county = COALESCE($4, county),
            "ownerName" = COALESCE($5, "ownerName"),
            phone = COALESCE($6, phone),
            email = COALESCE($7, email),
            stage = COALESCE($8, stage),
            priority = COALESCE($9, priority),
            "lastContactDate" = COALESCE($10, "lastContactDate"),
            "nextContactDate" = COALESCE($11, "nextContactDate"),
            notes = COALESCE($12, notes)
        WHERE id = $13
        RETURNING id, "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
                  stage, priority, "lastContactDate", "nextContactDate", notes, "createdAt"
      `,
      [
        businessName ?? null,
        licenseNo ?? null,
        licenseType ?? null,
        county ?? null,
        ownerName ?? null,
        phone ?? null,
        email ?? null,
        stage ?? null,
        priority ?? null,
        lastContactDate ?? null,
        nextContactDate ?? null,
        notes ?? null,
        req.params.id,
      ]
    );

    const updated = result.rows[0];
    if (!updated) return res.status(404).json({ error: 'Lead not found' });

    res.json(updated);
  } catch (error) {
    console.error('Failed to update lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.transaction(async (client) => {
      const existing = await client.query('SELECT id FROM leads WHERE id = $1', [req.params.id]);
      if (existing.rowCount === 0) {
        const notFound = new Error('Lead not found');
        notFound.statusCode = 404;
        throw notFound;
      }

      await client.query('DELETE FROM contact_log WHERE "entityType" = $1 AND "entityId" = $2', ['lead', req.params.id]);
      await client.query('DELETE FROM leads WHERE id = $1', [req.params.id]);
    });

    res.json({ message: 'Lead deleted' });
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ error: error.message });
    console.error('Failed to delete lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

module.exports = router;
