const express = require('express');
const db = require('../database');

const router = express.Router();

const COLUMNS = `id, title, description, "dueDate", completed, "completedAt", priority,
                 "entityType", "entityId", "entityName", "createdAt"`;

router.get('/', async (req, res) => {
  const { status, entityType, entityId } = req.query;
  const conditions = [];
  const params = [];

  if (status === 'open') conditions.push('completed = FALSE');
  else if (status === 'done') conditions.push('completed = TRUE');
  else if (status === 'overdue') conditions.push(`completed = FALSE AND "dueDate" IS NOT NULL AND "dueDate" < to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')`);
  else if (status === 'today') conditions.push(`completed = FALSE AND "dueDate" = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')`);

  if (entityType && entityId) {
    params.push(entityType);
    params.push(Number(entityId));
    conditions.push(`"entityType" = $${params.length - 1} AND "entityId" = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await db.query(
      `SELECT ${COLUMNS} FROM tasks ${where}
       ORDER BY completed ASC,
                CASE WHEN "dueDate" IS NULL THEN 1 ELSE 0 END,
                "dueDate" ASC,
                CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
                "createdAt" DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to load tasks:', error);
    res.status(500).json({ error: 'Failed to load tasks' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`SELECT ${COLUMNS} FROM tasks WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to load task:', error);
    res.status(500).json({ error: 'Failed to load task' });
  }
});

router.post('/', async (req, res) => {
  const { title, description, dueDate, priority, entityType, entityId, entityName } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

  try {
    const result = await db.query(
      `INSERT INTO tasks (title, description, "dueDate", priority, "entityType", "entityId", "entityName")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLUMNS}`,
      [
        title.trim(),
        description || null,
        dueDate || null,
        priority || 'Medium',
        entityType || null,
        entityId != null && entityId !== '' ? Number(entityId) : null,
        entityName || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to create task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.put('/:id', async (req, res) => {
  const fields = ['title', 'description', 'dueDate', 'completed', 'priority', 'entityType', 'entityId', 'entityName'];
  const updates = [];
  const params = [];

  for (const key of fields) {
    if (!(key in (req.body || {}))) continue;
    let value = req.body[key];
    if (key === 'entityId' && value !== null && value !== '') value = Number(value);
    if (key === 'completed') {
      params.push(!!value);
      updates.push(`completed = $${params.length}`);
      params.push(value ? new Date() : null);
      updates.push(`"completedAt" = $${params.length}`);
      continue;
    }
    params.push(value === '' ? null : value);
    updates.push(`"${key}" = $${params.length}`);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id);

  try {
    const result = await db.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING ${COLUMNS}`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to update task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
