const express = require('express');

const db = require('../database');

const router = express.Router();

const COLUMNS = `
  id, name, slug, chamber, district, party, score, grade, classification,
  "historicalVoteScore", summary, "contactLink", "eligibleWeight", publish,
  featured, "voteRecord", notes, "createdAt", "updatedAt"
`;

const EVENT_COLUMNS = `
  id, "legislatorId", title, "eventDate", "startTime", location, topic,
  organizer, status, notes, "createdAt", "updatedAt"
`;

const LIST_COLUMNS = `
  l.id, l.name, l.slug, l.chamber, l.district, l.party, l.score, l.grade, l.classification,
  l."historicalVoteScore", l.summary, l."contactLink", l."eligibleWeight", l.publish,
  l.featured, l."voteRecord", l.notes, l."createdAt", l."updatedAt"
`;

function toNumber(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeVoteRecord(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeLegislator(row) {
  if (!row) return row;
  return {
    ...row,
    score: row.score == null ? null : Number(row.score),
    historicalVoteScore: row.historicalVoteScore == null ? null : Number(row.historicalVoteScore),
    eligibleWeight: row.eligibleWeight == null ? null : Number(row.eligibleWeight),
    voteRecord: row.voteRecord || {},
  };
}

router.get('/', async (req, res) => {
  const { search, chamber, party, classification, grade } = req.query;
  const conditions = [];
  const params = [];

  if (search) {
    const term = `%${search}%`;
    params.push(term);
    conditions.push(`(
      name ILIKE $${params.length}
      OR chamber ILIKE $${params.length}
      OR district ILIKE $${params.length}
      OR party ILIKE $${params.length}
      OR classification ILIKE $${params.length}
      OR grade ILIKE $${params.length}
      OR summary ILIKE $${params.length}
      OR notes ILIKE $${params.length}
    )`);
  }

  if (chamber) {
    params.push(chamber);
    conditions.push(`chamber = $${params.length}`);
  }

  if (party) {
    params.push(party);
    conditions.push(`party = $${params.length}`);
  }

  if (classification) {
    params.push(classification);
    conditions.push(`classification = $${params.length}`);
  }

  if (grade) {
    params.push(grade);
    conditions.push(`grade = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await db.query(
      `
        SELECT ${LIST_COLUMNS},
               e."eventDate" AS "nextEventDate",
               e.title AS "nextEventTitle"
        FROM legislators l
        LEFT JOIN LATERAL (
          SELECT "eventDate", title
          FROM legislator_events
          WHERE "legislatorId" = l.id
            AND status IN ('planned', 'confirmed')
            AND "eventDate" >= CURRENT_DATE
          ORDER BY "eventDate" ASC, "createdAt" ASC
          LIMIT 1
        ) e ON TRUE
        ${where}
        ORDER BY
          CASE chamber WHEN 'Senate' THEN 1 WHEN 'House' THEN 2 ELSE 3 END,
          CASE WHEN district ~ '^[0-9]+$' THEN district::int ELSE 9999 END,
          name ASC
      `,
      params
    );
    res.json(result.rows.map(normalizeLegislator));
  } catch (error) {
    console.error('Failed to load legislators:', error);
    res.status(500).json({ error: 'Failed to load legislators' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`SELECT ${COLUMNS} FROM legislators WHERE id = $1`, [req.params.id]);
    const legislator = normalizeLegislator(result.rows[0]);
    if (!legislator) return res.status(404).json({ error: 'Legislator not found' });
    res.json(legislator);
  } catch (error) {
    console.error('Failed to load legislator:', error);
    res.status(500).json({ error: 'Failed to load legislator' });
  }
});

router.post('/', async (req, res) => {
  const body = req.body || {};
  if (!body.name || !String(body.name).trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const result = await db.query(
      `
        INSERT INTO legislators (
          name, slug, chamber, district, party, score, grade, classification,
          "historicalVoteScore", summary, "contactLink", "eligibleWeight",
          publish, featured, "voteRecord", notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING ${COLUMNS}
      `,
      [
        String(body.name).trim(),
        body.slug || null,
        body.chamber || null,
        body.district || null,
        body.party || null,
        toNumber(body.score),
        body.grade || null,
        body.classification || null,
        toNumber(body.historicalVoteScore),
        body.summary || null,
        body.contactLink || null,
        toNumber(body.eligibleWeight),
        body.publish !== undefined ? Boolean(body.publish) : true,
        body.featured !== undefined ? Boolean(body.featured) : false,
        JSON.stringify(normalizeVoteRecord(body.voteRecord)),
        body.notes || null,
      ]
    );
    res.status(201).json(normalizeLegislator(result.rows[0]));
  } catch (error) {
    console.error('Failed to create legislator:', error);
    res.status(500).json({ error: 'Failed to create legislator' });
  }
});

router.put('/:id', async (req, res) => {
  const fields = [
    'name', 'slug', 'chamber', 'district', 'party', 'score', 'grade', 'classification',
    'historicalVoteScore', 'summary', 'contactLink', 'eligibleWeight', 'publish',
    'featured', 'voteRecord', 'notes',
  ];
  const updates = [];
  const params = [];

  for (const key of fields) {
    if (!(key in (req.body || {}))) continue;
    let value = req.body[key];
    if (['score', 'historicalVoteScore', 'eligibleWeight'].includes(key)) value = toNumber(value);
    else if (key === 'publish' || key === 'featured') value = Boolean(value);
    else if (key === 'voteRecord') value = JSON.stringify(normalizeVoteRecord(value));
    else if (value === '') value = null;
    params.push(value);
    const column = key === 'historicalVoteScore' || key === 'contactLink' || key === 'eligibleWeight' || key === 'voteRecord'
      ? `"${key}"`
      : key;
    updates.push(`${column} = $${params.length}`);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  updates.push('"updatedAt" = CURRENT_TIMESTAMP');
  params.push(req.params.id);

  try {
    const result = await db.query(
      `UPDATE legislators SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING ${COLUMNS}`,
      params
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Legislator not found' });
    res.json(normalizeLegislator(result.rows[0]));
  } catch (error) {
    console.error('Failed to update legislator:', error);
    res.status(500).json({ error: 'Failed to update legislator' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.transaction(async (client) => {
      const existing = await client.query('SELECT id FROM legislators WHERE id = $1', [req.params.id]);
      if (existing.rowCount === 0) {
        const error = new Error('Legislator not found');
        error.statusCode = 404;
        throw error;
      }
      await client.query(`DELETE FROM contact_log WHERE "entityType" = 'legislator' AND "entityId" = $1`, [req.params.id]);
      await client.query(`DELETE FROM tasks WHERE "entityType" = 'legislator' AND "entityId" = $1`, [req.params.id]);
      await client.query(`DELETE FROM attachments WHERE "entityType" = 'legislator' AND "entityId" = $1`, [req.params.id]);
      await client.query('DELETE FROM legislators WHERE id = $1', [req.params.id]);
    });
    res.json({ message: 'Legislator deleted' });
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ error: error.message });
    console.error('Failed to delete legislator:', error);
    res.status(500).json({ error: 'Failed to delete legislator' });
  }
});

router.get('/:id/events', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ${EVENT_COLUMNS}
       FROM legislator_events
       WHERE "legislatorId" = $1
       ORDER BY
         CASE WHEN status IN ('planned', 'confirmed') AND "eventDate" >= CURRENT_DATE THEN 0 ELSE 1 END,
         "eventDate" ASC,
         "createdAt" ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to load legislator events:', error);
    res.status(500).json({ error: 'Failed to load legislator events' });
  }
});

router.post('/:id/events', async (req, res) => {
  const body = req.body || {};
  if (!body.title || !String(body.title).trim()) return res.status(400).json({ error: 'title is required' });
  if (!body.eventDate) return res.status(400).json({ error: 'eventDate is required' });

  try {
    const result = await db.query(
      `
        INSERT INTO legislator_events (
          "legislatorId", title, "eventDate", "startTime", location, topic, organizer, status, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'planned'), $9)
        RETURNING ${EVENT_COLUMNS}
      `,
      [
        req.params.id,
        String(body.title).trim(),
        body.eventDate,
        body.startTime || null,
        body.location || null,
        body.topic || null,
        body.organizer || null,
        body.status || null,
        body.notes || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to create legislator event:', error);
    res.status(500).json({ error: 'Failed to create legislator event' });
  }
});

router.put('/:id/events/:eventId', async (req, res) => {
  const fields = ['title', 'eventDate', 'startTime', 'location', 'topic', 'organizer', 'status', 'notes'];
  const updates = [];
  const params = [];

  for (const key of fields) {
    if (!(key in (req.body || {}))) continue;
    let value = req.body[key];
    if (value === '') value = null;
    params.push(value);
    const column = key === 'eventDate' || key === 'startTime' ? `"${key}"` : key;
    updates.push(`${column} = $${params.length}`);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  updates.push('"updatedAt" = CURRENT_TIMESTAMP');
  params.push(req.params.id, req.params.eventId);

  try {
    const result = await db.query(
      `
        UPDATE legislator_events
        SET ${updates.join(', ')}
        WHERE "legislatorId" = $${params.length - 1} AND id = $${params.length}
        RETURNING ${EVENT_COLUMNS}
      `,
      params
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Legislator event not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to update legislator event:', error);
    res.status(500).json({ error: 'Failed to update legislator event' });
  }
});

router.delete('/:id/events/:eventId', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM legislator_events WHERE "legislatorId" = $1 AND id = $2 RETURNING id',
      [req.params.id, req.params.eventId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Legislator event not found' });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete legislator event:', error);
    res.status(500).json({ error: 'Failed to delete legislator event' });
  }
});

module.exports = router;
