const express = require('express');
const multer = require('multer');
const crypto = require('crypto');

const db = require('../database');
const r2 = require('../r2');
const { parseLicenseRows, licenseIdentity } = require('../licenseUtils');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

const SELECT_COLUMNS = `
  l.id, l."businessName", l."licenseNo", l."licenseType", l.county, l."ownerName", l.phone, l.email,
  l.stage, l.priority, l."lastContactDate", l."nextContactDate", l.notes, l."createdAt",
  l."logoAttachmentId", a."r2Key" AS "logoR2Key"
`;

function normalizeLicenseRow(row) {
  return {
    number: String(row?.number || '').trim(),
    type: String(row?.type || '').trim(),
    county: String(row?.county || '').trim(),
    name: String(row?.name || '').trim(),
    expirationDate: String(row?.expirationDate || row?.expiration || row?.renewalDate || '').trim(),
    status: row?.status === 'Inactive' ? 'Inactive' : 'Active',
  };
}

function normalizeLicenseNo(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const rows = value.map(normalizeLicenseRow).filter(r => r.number || r.type || r.county || r.name || r.expirationDate);
    return rows.length ? JSON.stringify(rows) : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      const rows = parsed.map(normalizeLicenseRow).filter(r => r.number || r.type || r.county || r.name || r.expirationDate);
      return rows.length ? JSON.stringify(rows) : null;
    }
  } catch {}
  const rows = text.split(',').map(part => part.trim()).filter(Boolean).map(number => normalizeLicenseRow({ number }));
  return rows.length ? JSON.stringify(rows) : null;
}

async function withLogoUrl(row) {
  const lead = { ...row, logoUrl: null };
  if (lead.logoR2Key && r2.isConfigured()) {
    try {
      lead.logoUrl = await r2.getInlineUrl(lead.logoR2Key);
    } catch {
      lead.logoUrl = null;
    }
  }
  delete lead.logoR2Key;
  return lead;
}

async function withLogoUrls(rows) {
  return Promise.all(rows.map(withLogoUrl));
}

function normalizedText(value) {
  const text = String(value || '').trim();
  return text ? text.toLowerCase() : null;
}

function licenseNumbers(value) {
  return [...new Set(parseLicenseRows(value).map(licenseIdentity).filter(Boolean))];
}

async function findDuplicateMembers(client, candidate) {
  const businessName = normalizedText(candidate.businessName);
  const email = normalizedText(candidate.email);
  const candidateLicenses = licenseNumbers(candidate.licenseNo);
  const result = await client.query(
    `
      SELECT id, "businessName", email, "licenseNo", "ownerName"
      FROM members
      WHERE ($1::text IS NOT NULL AND lower(trim("businessName")) = $1)
         OR ($2::text IS NOT NULL AND lower(trim(email)) = $2)
         OR ($3::boolean = TRUE AND "licenseNo" IS NOT NULL)
      ORDER BY "businessName", id
    `,
    [businessName, email, candidateLicenses.length > 0]
  );

  return result.rows.filter((member) => {
    if (businessName && normalizedText(member.businessName) === businessName) return true;
    if (email && normalizedText(member.email) === email) return true;
    if (candidateLicenses.length === 0) return false;
    const memberLicenses = new Set(licenseNumbers(member.licenseNo));
    return candidateLicenses.some(number => memberLicenses.has(number));
  }).map(({ id, businessName: name, email: memberEmail, ownerName, licenseNo }) => ({
    id,
    businessName: name,
    email: memberEmail,
    ownerName,
    licenseNo,
  }));
}

function safeFilename(name) {
  return String(name || 'logo').replace(/[^\w.\-]/g, '_');
}

async function deleteAttachmentById(client, attachmentId) {
  if (!attachmentId) return;
  const result = await client.query('SELECT id, "r2Key" FROM attachments WHERE id = $1', [attachmentId]);
  if (result.rowCount === 0) return;
  const attachment = result.rows[0];
  if (r2.isConfigured()) {
    try { await r2.deleteObject(attachment.r2Key); } catch (error) { console.warn('Logo R2 delete failed:', error.message); }
  }
  await client.query('DELETE FROM attachments WHERE id = $1', [attachment.id]);
}

router.get('/', async (req, res) => {
  const { search, stage, priority, county } = req.query;
  const conditions = [];
  const params = [];

  if (search) {
    const term = `%${search}%`;
    params.push(term);
    conditions.push(`(l."businessName" ILIKE $${params.length} OR l."ownerName" ILIKE $${params.length} OR l."licenseNo" ILIKE $${params.length} OR l.email ILIKE $${params.length})`);
  }

  if (stage) {
    params.push(stage);
    conditions.push(`l.stage = $${params.length}`);
  }

  if (priority) {
    params.push(priority);
    conditions.push(`l.priority = $${params.length}`);
  }

  if (county) {
    params.push(county);
    conditions.push(`l.county = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await db.query(
      `
        SELECT ${SELECT_COLUMNS}
        FROM leads l
        LEFT JOIN attachments a ON a.id = l."logoAttachmentId"
        ${whereClause}
        ORDER BY l."createdAt" DESC
      `,
      params
    );

    res.json(await withLogoUrls(result.rows));
  } catch (error) {
    console.error('Failed to load leads:', error);
    res.status(500).json({ error: 'Failed to load leads' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `
        SELECT ${SELECT_COLUMNS}
        FROM leads l
        LEFT JOIN attachments a ON a.id = l."logoAttachmentId"
        WHERE l.id = $1
      `,
      [req.params.id]
    );

    const lead = result.rows[0] ? await withLogoUrl(result.rows[0]) : null;
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
        RETURNING id
      `,
      [
        businessName,
        normalizeLicenseNo(licenseNo),
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

    const created = await db.query(
      `SELECT ${SELECT_COLUMNS}
       FROM leads l
       LEFT JOIN attachments a ON a.id = l."logoAttachmentId"
       WHERE l.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(await withLogoUrl(created.rows[0]));
  } catch (error) {
    console.error('Failed to create lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

router.post('/bulk', async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (rows.length === 0) return res.status(400).json({ error: 'No rows provided' });

  const failures = [];
  let inserted = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.businessName) { failures.push({ index: i, error: 'missing businessName' }); continue; }
    try {
      await db.query(
        `
          INSERT INTO leads (
            "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
            stage, priority, "lastContactDate", "nextContactDate", notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `,
        [
          r.businessName,
          normalizeLicenseNo(r.licenseNo),
          r.licenseType || null,
          r.county || null,
          r.ownerName || null,
          r.phone || null,
          r.email || null,
          r.stage || 'New',
          r.priority || 'Medium',
          r.lastContactDate || null,
          r.nextContactDate || null,
          r.notes || null,
        ]
      );
      inserted++;
    } catch (error) {
      console.error(`Bulk lead row ${i} failed:`, error.message, r);
      failures.push({ index: i, businessName: r.businessName, error: error.message });
    }
  }
  res.status(201).json({ inserted, failed: failures.length, failures: failures.slice(0, 10) });
});

router.post('/:id/convert', async (req, res) => {
  const leadId = Number(req.params.id);
  if (!Number.isFinite(leadId)) return res.status(400).json({ error: 'Invalid lead id' });

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
    notes,
  } = req.body || {};

  if (!businessName || !String(businessName).trim()) {
    return res.status(400).json({ error: 'businessName is required' });
  }
  const normalizedDuesAmount = duesAmount === '' || duesAmount == null ? null : Number(duesAmount);
  if (normalizedDuesAmount != null && (!Number.isFinite(normalizedDuesAmount) || normalizedDuesAmount < 0)) {
    return res.status(400).json({ error: 'duesAmount must be a non-negative number' });
  }

  try {
    const memberId = await db.transaction(async (client) => {
      const leadResult = await client.query(
        `SELECT id, stage FROM leads WHERE id = $1 FOR UPDATE`,
        [leadId]
      );
      if (leadResult.rowCount === 0) {
        const error = new Error('Lead not found');
        error.statusCode = 404;
        throw error;
      }
      if (leadResult.rows[0].stage !== 'Won') {
        const error = new Error('Only Won leads can be converted to members');
        error.statusCode = 400;
        throw error;
      }

      const normalizedLicenseNo = normalizeLicenseNo(licenseNo);
      const candidate = { businessName, email, licenseNo: normalizedLicenseNo };
      const matches = await findDuplicateMembers(client, candidate);
      if (matches.length > 0) {
        const error = new Error('A possible matching member already exists');
        error.statusCode = 409;
        error.matches = matches;
        throw error;
      }

      const inserted = await client.query(
        `
          INSERT INTO members (
            "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
            "joinDate", "renewalDate", "duesAmount", "membershipTier", benefits, notes,
            "logoAttachmentId"
          )
          SELECT
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, '[]', $12,
            "logoAttachmentId"
          FROM leads
          WHERE id = $13
          RETURNING id
        `,
        [
          String(businessName).trim(),
          normalizedLicenseNo,
          licenseType || null,
          county || null,
          ownerName || null,
          phone || null,
          email || null,
          joinDate || null,
          renewalDate || null,
          normalizedDuesAmount,
          membershipTier || null,
          notes || null,
          leadId,
        ]
      );
      const createdMemberId = inserted.rows[0].id;
      const memberName = String(businessName).trim();

      await client.query(
        `UPDATE contact_log
         SET "entityType" = 'member', "entityId" = $1, "entityName" = $2
         WHERE "entityType" = 'lead' AND "entityId" = $3`,
        [createdMemberId, memberName, leadId]
      );
      await client.query(
        `UPDATE tasks
         SET "entityType" = 'member', "entityId" = $1, "entityName" = $2
         WHERE "entityType" = 'lead' AND "entityId" = $3`,
        [createdMemberId, memberName, leadId]
      );
      await client.query(
        `UPDATE attachments
         SET "entityType" = 'member', "entityId" = $1
         WHERE "entityType" = 'lead' AND "entityId" = $2`,
        [createdMemberId, leadId]
      );
      await client.query('DELETE FROM leads WHERE id = $1', [leadId]);

      return createdMemberId;
    });

    const created = await db.query(
      `SELECT
         m.id, m."businessName", m."licenseNo", m."licenseType", m.county, m."ownerName", m.phone, m.email,
         m."joinDate", m."renewalDate", m."duesAmount", m."membershipTier", m.benefits, m.notes, m."createdAt",
         m."logoAttachmentId", a."r2Key" AS "logoR2Key"
       FROM members m
       LEFT JOIN attachments a ON a.id = m."logoAttachmentId"
       WHERE m.id = $1`,
      [memberId]
    );
    const member = { ...created.rows[0], duesAmount: created.rows[0].duesAmount == null ? null : Number(created.rows[0].duesAmount), logoUrl: null };
    if (member.logoR2Key && r2.isConfigured()) {
      try { member.logoUrl = await r2.getInlineUrl(member.logoR2Key); } catch {}
    }
    delete member.logoR2Key;
    res.status(201).json(member);
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({ error: error.message, matches: error.matches || [] });
    }
    if (error.statusCode === 400 || error.statusCode === 404) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Failed to convert lead:', error);
    res.status(500).json({ error: 'Failed to convert lead' });
  }
});

router.post('/:id/logo', upload.single('file'), async (req, res) => {
  if (!r2.isConfigured()) return res.status(503).json({ error: 'File storage is not configured. Set R2_* environment variables.' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!IMAGE_MIME_TYPES.has(req.file.mimetype)) return res.status(400).json({ error: 'Logo must be a PNG, JPG, WebP, or SVG image' });

  const leadId = Number(req.params.id);
  const key = `lead/${leadId}/logo/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeFilename(req.file.originalname)}`;

  try {
    await r2.uploadObject(key, req.file.buffer, req.file.mimetype);

    await db.transaction(async (client) => {
      const existing = await client.query('SELECT id, "logoAttachmentId" FROM leads WHERE id = $1', [leadId]);
      if (existing.rowCount === 0) {
        const err = new Error('Lead not found');
        err.statusCode = 404;
        throw err;
      }

      const inserted = await client.query(
        `INSERT INTO attachments ("entityType", "entityId", filename, "mimeType", "sizeBytes", "r2Key")
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        ['lead', leadId, req.file.originalname, req.file.mimetype, req.file.size, key]
      );

      const oldLogoAttachmentId = existing.rows[0].logoAttachmentId;
      await client.query('UPDATE leads SET "logoAttachmentId" = $1 WHERE id = $2', [inserted.rows[0].id, leadId]);
      await deleteAttachmentById(client, oldLogoAttachmentId);
    });

    const refreshed = await db.query(
      `SELECT ${SELECT_COLUMNS}
       FROM leads l
       LEFT JOIN attachments a ON a.id = l."logoAttachmentId"
       WHERE l.id = $1`,
      [leadId]
    );

    res.status(201).json(await withLogoUrl(refreshed.rows[0]));
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ error: error.message });
    try { await r2.deleteObject(key); } catch {}
    console.error('Lead logo upload failed:', error);
    res.status(500).json({ error: error.message || 'Logo upload failed' });
  }
});

router.delete('/:id/logo', async (req, res) => {
  const leadId = Number(req.params.id);
  try {
    await db.transaction(async (client) => {
      const existing = await client.query('SELECT id, "logoAttachmentId" FROM leads WHERE id = $1', [leadId]);
      if (existing.rowCount === 0) {
        const err = new Error('Lead not found');
        err.statusCode = 404;
        throw err;
      }
      const attachmentId = existing.rows[0].logoAttachmentId;
      if (!attachmentId) return;
      await client.query('UPDATE leads SET "logoAttachmentId" = NULL WHERE id = $1', [leadId]);
      await deleteAttachmentById(client, attachmentId);
    });
    res.status(204).end();
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ error: error.message });
    console.error('Failed to remove lead logo:', error);
    res.status(500).json({ error: 'Failed to remove lead logo' });
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
        RETURNING id
      `,
      [
        businessName ?? null,
        normalizeLicenseNo(licenseNo),
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

    if (result.rowCount === 0) return res.status(404).json({ error: 'Lead not found' });

    const updated = await db.query(
      `SELECT ${SELECT_COLUMNS}
       FROM leads l
       LEFT JOIN attachments a ON a.id = l."logoAttachmentId"
       WHERE l.id = $1`,
      [result.rows[0].id]
    );

    res.json(await withLogoUrl(updated.rows[0]));
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
