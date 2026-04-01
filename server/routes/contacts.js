const express = require('express');

const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  const { entityId, entityType, search } = req.query;
  const conditions = [];
  const params = [];

  if (entityId) {
    params.push(entityId);
    conditions.push(`"entityId" = $${params.length}`);
  }

  if (entityType) {
    params.push(entityType);
    conditions.push(`"entityType" = $${params.length}`);
  }

  if (search) {
    const term = `%${search}%`;
    params.push(term);
    conditions.push(`("entityName" ILIKE $${params.length} OR summary ILIKE $${params.length} OR "nextAction" ILIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await db.query(
      `
        SELECT id, "entityId", "entityType", "entityName", "contactDate", "contactType",
               summary, "nextAction", "nextActionDate", "createdAt"
        FROM contact_log
        ${whereClause}
        ORDER BY "contactDate" DESC, "createdAt" DESC
      `,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Failed to load contacts:', error);
    res.status(500).json({ error: 'Failed to load contacts' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `
        SELECT id, "entityId", "entityType", "entityName", "contactDate", "contactType",
               summary, "nextAction", "nextActionDate", "createdAt"
        FROM contact_log
        WHERE id = $1
      `,
      [req.params.id]
    );

    const entry = result.rows[0];
    if (!entry) return res.status(404).json({ error: 'Contact log entry not found' });

    res.json(entry);
  } catch (error) {
    console.error('Failed to load contact entry:', error);
    res.status(500).json({ error: 'Failed to load contact entry' });
  }
});

router.post('/', async (req, res) => {
  const {
    entityId,
    entityType,
    entityName,
    contactDate,
    contactType,
    summary,
    nextAction,
    nextActionDate,
  } = req.body || {};

  if (!entityId || !entityType || !contactDate) {
    return res.status(400).json({ error: 'entityId, entityType, and contactDate are required' });
  }

  if (entityType !== 'member' && entityType !== 'lead') {
    return res.status(400).json({ error: 'entityType must be "member" or "lead"' });
  }

  try {
    const result = await db.transaction(async (client) => {
      const insertResult = await client.query(
        `
          INSERT INTO contact_log (
            "entityId", "entityType", "entityName", "contactDate", "contactType",
            summary, "nextAction", "nextActionDate"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, "entityId", "entityType", "entityName", "contactDate", "contactType",
                    summary, "nextAction", "nextActionDate", "createdAt"
        `,
        [
          entityId,
          entityType,
          entityName || null,
          contactDate,
          contactType || null,
          summary || null,
          nextAction || null,
          nextActionDate || null,
        ]
      );

      if (entityType === 'lead') {
        await client.query(
          `
            UPDATE leads
            SET "lastContactDate" = $1,
                "nextContactDate" = COALESCE($2, "nextContactDate")
            WHERE id = $3
          `,
          [contactDate, nextActionDate || null, entityId]
        );
      }

      return insertResult.rows[0];
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Failed to create contact entry:', error);
    res.status(500).json({ error: 'Failed to create contact entry' });
  }
});

router.put('/:id', async (req, res) => {
  const {
    entityId,
    entityType,
    entityName,
    contactDate,
    contactType,
    summary,
    nextAction,
    nextActionDate,
  } = req.body || {};

  if (entityType !== undefined && entityType !== 'member' && entityType !== 'lead') {
    return res.status(400).json({ error: 'entityType must be "member" or "lead"' });
  }

  try {
    const result = await db.query(
      `
        UPDATE contact_log
        SET "entityId" = COALESCE($1, "entityId"),
            "entityType" = COALESCE($2, "entityType"),
            "entityName" = COALESCE($3, "entityName"),
            "contactDate" = COALESCE($4, "contactDate"),
            "contactType" = COALESCE($5, "contactType"),
            summary = COALESCE($6, summary),
            "nextAction" = COALESCE($7, "nextAction"),
            "nextActionDate" = COALESCE($8, "nextActionDate")
        WHERE id = $9
        RETURNING id, "entityId", "entityType", "entityName", "contactDate", "contactType",
                  summary, "nextAction", "nextActionDate", "createdAt"
      `,
      [
        entityId ?? null,
        entityType ?? null,
        entityName ?? null,
        contactDate ?? null,
        contactType ?? null,
        summary ?? null,
        nextAction ?? null,
        nextActionDate ?? null,
        req.params.id,
      ]
    );

    const updated = result.rows[0];
    if (!updated) return res.status(404).json({ error: 'Contact log entry not found' });

    res.json(updated);
  } catch (error) {
    console.error('Failed to update contact entry:', error);
    res.status(500).json({ error: 'Failed to update contact entry' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM contact_log WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Contact log entry not found' });

    res.json({ message: 'Contact log entry deleted' });
  } catch (error) {
    console.error('Failed to delete contact entry:', error);
    res.status(500).json({ error: 'Failed to delete contact entry' });
  }
});

module.exports = router;
