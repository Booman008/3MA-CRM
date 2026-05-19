const express = require('express');
const db = require('../database');

const router = express.Router();

const CATEGORIES = new Set(['fundraising', 'membership', 'conversions', 'custom']);
const STATUSES = new Set(['active', 'archived']);

function normalizeGoalRow(row) {
  return {
    ...row,
    targetValue: row.targetValue == null ? 0 : Number(row.targetValue),
    manualValue: row.manualValue == null ? 0 : Number(row.manualValue),
  };
}

async function computeCurrentValue(goal) {
  const { category, startDate, endDate, manualValue } = goal;
  if (category === 'custom') return Number(manualValue || 0);

  // For auto categories, count/sum members whose createdAt falls within
  // [startDate, endDate]. Note: 'conversions' currently uses the same window
  // as 'membership' because there is no dedicated converted-from-lead timestamp
  // on the members table; both surface as "new members created in window."
  try {
    if (category === 'fundraising') {
      const result = await db.query(
        `SELECT COALESCE(SUM("duesAmount"), 0)::numeric AS total
           FROM members
          WHERE "createdAt"::date BETWEEN $1 AND $2`,
        [startDate, endDate]
      );
      return Number(result.rows[0]?.total || 0);
    }
    if (category === 'membership' || category === 'conversions') {
      const result = await db.query(
        `SELECT COUNT(*)::int AS total
           FROM members
          WHERE "createdAt"::date BETWEEN $1 AND $2`,
        [startDate, endDate]
      );
      return Number(result.rows[0]?.total || 0);
    }
  } catch (error) {
    console.warn(`Failed to compute current value for goal ${goal.id}:`, error.message);
    return 0;
  }
  return 0;
}

async function enrichGoal(row) {
  const goal = normalizeGoalRow(row);
  const currentValue = await computeCurrentValue(goal);
  const progressPct = goal.targetValue > 0
    ? Math.max(0, Math.min(100, (currentValue / goal.targetValue) * 100))
    : 0;
  return { ...goal, currentValue, progressPct };
}

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, category, title, description, "targetValue", "manualValue",
              "startDate", "endDate", status, "createdAt", "updatedAt"
         FROM goals
        ORDER BY status ASC, "endDate" ASC, "createdAt" DESC`
    );
    const enriched = await Promise.all(result.rows.map(enrichGoal));
    res.json(enriched);
  } catch (error) {
    console.error('Failed to load goals:', error);
    res.status(500).json({ error: 'Failed to load goals' });
  }
});

router.post('/', async (req, res) => {
  const {
    category, title, description, targetValue, manualValue,
    startDate, endDate, status,
  } = req.body || {};

  if (!category || !CATEGORIES.has(category)) {
    return res.status(400).json({ error: 'category must be one of fundraising, membership, conversions, custom' });
  }
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (targetValue == null || isNaN(Number(targetValue)) || Number(targetValue) <= 0) {
    return res.status(400).json({ error: 'targetValue must be a positive number' });
  }
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO goals (category, title, description, "targetValue", "manualValue",
                          "startDate", "endDate", status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, category, title, description, "targetValue", "manualValue",
                 "startDate", "endDate", status, "createdAt", "updatedAt"`,
      [
        category,
        String(title).trim(),
        description || null,
        Number(targetValue),
        category === 'custom' ? Number(manualValue || 0) : 0,
        startDate,
        endDate,
        STATUSES.has(status) ? status : 'active',
      ]
    );
    res.status(201).json(await enrichGoal(result.rows[0]));
  } catch (error) {
    console.error('Failed to create goal:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

router.put('/:id', async (req, res) => {
  const {
    category, title, description, targetValue, manualValue,
    startDate, endDate, status,
  } = req.body || {};

  if (category != null && !CATEGORIES.has(category)) {
    return res.status(400).json({ error: 'invalid category' });
  }
  if (status != null && !STATUSES.has(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }

  try {
    const result = await db.query(
      `UPDATE goals
          SET category     = COALESCE($1, category),
              title        = COALESCE($2, title),
              description  = COALESCE($3, description),
              "targetValue"= COALESCE($4, "targetValue"),
              "manualValue"= COALESCE($5, "manualValue"),
              "startDate"  = COALESCE($6, "startDate"),
              "endDate"    = COALESCE($7, "endDate"),
              status       = COALESCE($8, status),
              "updatedAt"  = CURRENT_TIMESTAMP
        WHERE id = $9
        RETURNING id, category, title, description, "targetValue", "manualValue",
                  "startDate", "endDate", status, "createdAt", "updatedAt"`,
      [
        category ?? null,
        title != null ? String(title).trim() : null,
        description ?? null,
        targetValue != null ? Number(targetValue) : null,
        manualValue != null ? Number(manualValue) : null,
        startDate ?? null,
        endDate ?? null,
        status ?? null,
        req.params.id,
      ]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Goal not found' });
    res.json(await enrichGoal(result.rows[0]));
  } catch (error) {
    console.error('Failed to update goal:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM goals WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Goal not found' });
    res.json({ message: 'Goal deleted' });
  } catch (error) {
    console.error('Failed to delete goal:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

module.exports = router;
