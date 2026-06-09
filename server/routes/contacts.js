const express = require('express');

const db = require('../database');

const router = express.Router();

const COLUMNS = `id, "entityId", "entityType", "entityName", "contactDate", "contactType",
                 subject, direction, summary, "nextAction", "nextActionDate", "createdAt",
                 "gmailThreadId", "gmailMessageIds", "gmailImportedAt"`;

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
    conditions.push(`("entityName" ILIKE $${params.length} OR subject ILIKE $${params.length} OR summary ILIKE $${params.length} OR "nextAction" ILIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await db.query(
      `SELECT ${COLUMNS} FROM contact_log ${whereClause}
       ORDER BY "contactDate" DESC, "createdAt" DESC`,
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
    const result = await db.query(`SELECT ${COLUMNS} FROM contact_log WHERE id = $1`, [req.params.id]);
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
    entityId, entityType, entityName, contactDate, contactType,
    subject, direction, summary, nextAction, nextActionDate,
  } = req.body || {};

  if (!entityId || !entityType || !contactDate) {
    return res.status(400).json({ error: 'entityId, entityType, and contactDate are required' });
  }
  if (!['member', 'lead', 'legislator'].includes(entityType)) {
    return res.status(400).json({ error: 'entityType must be "member", "lead", or "legislator"' });
  }
  if (direction && direction !== 'inbound' && direction !== 'outbound') {
    return res.status(400).json({ error: 'direction must be "inbound" or "outbound"' });
  }

  try {
    const result = await db.transaction(async (client) => {
      const insertResult = await client.query(
        `INSERT INTO contact_log (
           "entityId", "entityType", "entityName", "contactDate", "contactType",
           subject, direction, summary, "nextAction", "nextActionDate"
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING ${COLUMNS}`,
        [
          entityId,
          entityType,
          entityName || null,
          contactDate,
          contactType || null,
          subject || null,
          direction || null,
          summary || null,
          nextAction || null,
          nextActionDate || null,
        ]
      );

      if (entityType === 'lead') {
        await client.query(
          `UPDATE leads
           SET "lastContactDate" = $1,
               "nextContactDate" = COALESCE($2, "nextContactDate")
           WHERE id = $3`,
          [contactDate, nextActionDate || null, entityId]
        );
      }

      const created = insertResult.rows[0];

      if (nextAction && nextActionDate) {
        await client.query(
          `INSERT INTO tasks (title, "dueDate", priority, "entityType", "entityId", "entityName", "sourceContactLogId")
           VALUES ($1, $2, 'Medium', $3, $4, $5, $6)`,
          [nextAction, nextActionDate, entityType, entityId, entityName || null, created.id]
        );
      }

      return created;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Failed to create contact entry:', error);
    res.status(500).json({ error: 'Failed to create contact entry' });
  }
});

router.put('/:id', async (req, res) => {
  const fields = ['entityId', 'entityType', 'entityName', 'contactDate', 'contactType',
                  'subject', 'direction', 'summary', 'nextAction', 'nextActionDate'];
  const updates = [];
  const params = [];

  for (const key of fields) {
    if (!(key in (req.body || {}))) continue;
    let value = req.body[key];
    if (value === '') value = null;
    params.push(value);
    updates.push(`"${key}" = $${params.length}`);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id);

  try {
    const updated = await db.transaction(async (client) => {
      const result = await client.query(
        `UPDATE contact_log SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING ${COLUMNS}`,
        params
      );
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      const existingTask = await client.query(
        `SELECT id, completed FROM tasks WHERE "sourceContactLogId" = $1`,
        [row.id]
      );
      const taskRow = existingTask.rows[0];

      if (row.nextAction && row.nextActionDate) {
        if (taskRow) {
          await client.query(
            `UPDATE tasks
             SET title = $1, "dueDate" = $2, "entityType" = $3, "entityId" = $4, "entityName" = $5
             WHERE id = $6`,
            [row.nextAction, row.nextActionDate, row.entityType, row.entityId, row.entityName || null, taskRow.id]
          );
        } else {
          await client.query(
            `INSERT INTO tasks (title, "dueDate", priority, "entityType", "entityId", "entityName", "sourceContactLogId")
             VALUES ($1, $2, 'Medium', $3, $4, $5, $6)`,
            [row.nextAction, row.nextActionDate, row.entityType, row.entityId, row.entityName || null, row.id]
          );
        }
      } else if (taskRow && !taskRow.completed) {
        await client.query(`DELETE FROM tasks WHERE id = $1`, [taskRow.id]);
      }

      return row;
    });

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
