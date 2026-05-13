const express = require('express');
const multer = require('multer');
const crypto = require('crypto');

const db = require('../database');
const r2 = require('../r2');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

const SELECT_COLUMNS = `
  m.id, m."businessName", m."licenseNo", m."licenseType", m.county, m."ownerName", m.phone, m.email,
  m."joinDate", m."renewalDate", m."duesAmount", m."membershipTier", m.benefits, m.notes, m."createdAt",
  m."logoAttachmentId", a."r2Key" AS "logoR2Key"
`;

function normalizeLicenseRow(row) {
  return {
    number: String(row?.number || '').trim(),
    type: String(row?.type || '').trim(),
    county: String(row?.county || '').trim(),
    name: String(row?.name || '').trim(),
    status: row?.status === 'Inactive' ? 'Inactive' : 'Active',
  };
}

function normalizeLicenseNo(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const rows = value.map(normalizeLicenseRow).filter(r => r.number || r.type || r.county || r.name);
    return rows.length ? JSON.stringify(rows) : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      const rows = parsed.map(normalizeLicenseRow).filter(r => r.number || r.type || r.county || r.name);
      return rows.length ? JSON.stringify(rows) : null;
    }
  } catch {}
  const rows = text.split(',').map(part => part.trim()).filter(Boolean).map(number => normalizeLicenseRow({ number }));
  return rows.length ? JSON.stringify(rows) : null;
}

async function withLogoUrl(row) {
  const member = {
    ...row,
    duesAmount: row.duesAmount == null ? null : Number(row.duesAmount),
    logoUrl: null,
  };
  if (member.logoR2Key && r2.isConfigured()) {
    try {
      member.logoUrl = await r2.getInlineUrl(member.logoR2Key);
    } catch {
      member.logoUrl = null;
    }
  }
  delete member.logoR2Key;
  return member;
}

async function withLogoUrls(rows) {
  return Promise.all(rows.map(withLogoUrl));
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
  const { search, county, tier } = req.query;
  const conditions = [];
  const params = [];

  if (search) {
    const term = `%${search}%`;
    params.push(term);
    conditions.push(`(m."businessName" ILIKE $${params.length} OR m."ownerName" ILIKE $${params.length} OR m."licenseNo" ILIKE $${params.length} OR m.email ILIKE $${params.length})`);
  }

  if (county) {
    params.push(county);
    conditions.push(`m.county = $${params.length}`);
  }

  if (tier) {
    params.push(tier);
    conditions.push(`m."membershipTier" = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await db.query(
      `
        SELECT ${SELECT_COLUMNS}
        FROM members m
        LEFT JOIN attachments a ON a.id = m."logoAttachmentId"
        ${whereClause}
        ORDER BY m."createdAt" DESC
      `,
      params
    );

    res.json(await withLogoUrls(result.rows));
  } catch (error) {
    console.error('Failed to load members:', error);
    res.status(500).json({ error: 'Failed to load members' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `
        SELECT ${SELECT_COLUMNS}
        FROM members m
        LEFT JOIN attachments a ON a.id = m."logoAttachmentId"
        WHERE m.id = $1
      `,
      [req.params.id]
    );

    const member = result.rows[0] ? await withLogoUrl(result.rows[0]) : null;
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
        joinDate || null,
        renewalDate || null,
        duesAmount ?? null,
        membershipTier || null,
        JSON.stringify(benefits || []),
        notes || null,
      ]
    );

    const created = await db.query(
      `SELECT ${SELECT_COLUMNS}
       FROM members m
       LEFT JOIN attachments a ON a.id = m."logoAttachmentId"
       WHERE m.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(await withLogoUrl(created.rows[0]));
  } catch (error) {
    console.error('Failed to create member:', error);
    res.status(500).json({ error: 'Failed to create member' });
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
          INSERT INTO members (
            "businessName", "licenseNo", "licenseType", county, "ownerName", phone, email,
            "joinDate", "renewalDate", "duesAmount", "membershipTier", benefits, notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          r.businessName,
          normalizeLicenseNo(r.licenseNo),
          r.licenseType || null,
          r.county || null,
          r.ownerName || null,
          r.phone || null,
          r.email || null,
          r.joinDate || null,
          r.renewalDate || null,
          r.duesAmount ?? null,
          r.membershipTier || null,
          JSON.stringify(r.benefits || []),
          r.notes || null,
        ]
      );
      inserted++;
    } catch (error) {
      console.error(`Bulk member row ${i} failed:`, error.message, r);
      failures.push({ index: i, businessName: r.businessName, error: error.message });
    }
  }
  res.status(201).json({ inserted, failed: failures.length, failures: failures.slice(0, 10) });
});

router.post('/merge', async (req, res) => {
  const primaryId = Number(req.body?.primaryId);
  const memberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds.map(Number).filter(Number.isFinite) : [];
  const mergedMember = req.body?.mergedMember || {};

  if (!primaryId || memberIds.length < 2) return res.status(400).json({ error: 'primaryId and at least two memberIds are required' });
  if (!memberIds.includes(primaryId)) return res.status(400).json({ error: 'primaryId must be included in memberIds' });

  try {
    await db.transaction(async (client) => {
      const selected = await client.query(
        `SELECT id FROM members WHERE id = ANY($1::int[])`,
        [memberIds]
      );
      if (selected.rowCount !== memberIds.length) {
        const err = new Error('One or more selected members were not found');
        err.statusCode = 404;
        throw err;
      }

      const normalizedLicenseNo = normalizeLicenseNo(mergedMember.licenseNo);
      await client.query(
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
              notes = COALESCE($12, notes)
          WHERE id = $13
        `,
        [
          mergedMember.businessName ?? null,
          normalizedLicenseNo,
          mergedMember.licenseType ?? null,
          mergedMember.county ?? null,
          mergedMember.ownerName ?? null,
          mergedMember.phone ?? null,
          mergedMember.email ?? null,
          mergedMember.joinDate ?? null,
          mergedMember.renewalDate ?? null,
          mergedMember.duesAmount ?? null,
          mergedMember.membershipTier ?? null,
          mergedMember.notes ?? null,
          primaryId,
        ]
      );

      const otherIds = memberIds.filter(id => id !== primaryId);
      if (otherIds.length > 0) {
        await client.query('DELETE FROM members WHERE id = ANY($1::int[])', [otherIds]);
      }
    });

    const updated = await db.query(
      `SELECT ${SELECT_COLUMNS}
       FROM members m
       LEFT JOIN attachments a ON a.id = m."logoAttachmentId"
       WHERE m.id = $1`,
      [primaryId]
    );

    res.json(await withLogoUrl(updated.rows[0]));
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ error: error.message });
    console.error('Failed to merge members:', error);
    res.status(500).json({ error: 'Failed to merge members' });
  }
});

router.post('/:id/logo', upload.single('file'), async (req, res) => {
  if (!r2.isConfigured()) return res.status(503).json({ error: 'File storage is not configured. Set R2_* environment variables.' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!IMAGE_MIME_TYPES.has(req.file.mimetype)) return res.status(400).json({ error: 'Logo must be a PNG, JPG, WebP, or SVG image' });

  const memberId = Number(req.params.id);
  const key = `member/${memberId}/logo/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeFilename(req.file.originalname)}`;

  try {
    await r2.uploadObject(key, req.file.buffer, req.file.mimetype);

    await db.transaction(async (client) => {
      const existing = await client.query('SELECT id, "logoAttachmentId" FROM members WHERE id = $1', [memberId]);
      if (existing.rowCount === 0) {
        const err = new Error('Member not found');
        err.statusCode = 404;
        throw err;
      }

      const inserted = await client.query(
        `INSERT INTO attachments ("entityType", "entityId", filename, "mimeType", "sizeBytes", "r2Key")
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        ['member', memberId, req.file.originalname, req.file.mimetype, req.file.size, key]
      );

      const oldLogoAttachmentId = existing.rows[0].logoAttachmentId;
      await client.query('UPDATE members SET "logoAttachmentId" = $1 WHERE id = $2', [inserted.rows[0].id, memberId]);
      await deleteAttachmentById(client, oldLogoAttachmentId);
    });

    const refreshed = await db.query(
      `SELECT ${SELECT_COLUMNS}
       FROM members m
       LEFT JOIN attachments a ON a.id = m."logoAttachmentId"
       WHERE m.id = $1`,
      [memberId]
    );

    res.status(201).json(await withLogoUrl(refreshed.rows[0]));
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ error: error.message });
    try { await r2.deleteObject(key); } catch {}
    console.error('Member logo upload failed:', error);
    res.status(500).json({ error: error.message || 'Logo upload failed' });
  }
});

router.delete('/:id/logo', async (req, res) => {
  const memberId = Number(req.params.id);
  try {
    await db.transaction(async (client) => {
      const existing = await client.query('SELECT id, "logoAttachmentId" FROM members WHERE id = $1', [memberId]);
      if (existing.rowCount === 0) {
        const err = new Error('Member not found');
        err.statusCode = 404;
        throw err;
      }
      const attachmentId = existing.rows[0].logoAttachmentId;
      if (!attachmentId) return;
      await client.query('UPDATE members SET "logoAttachmentId" = NULL WHERE id = $1', [memberId]);
      await deleteAttachmentById(client, attachmentId);
    });
    res.status(204).end();
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ error: error.message });
    console.error('Failed to remove member logo:', error);
    res.status(500).json({ error: 'Failed to remove member logo' });
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
        joinDate ?? null,
        renewalDate ?? null,
        duesAmount ?? null,
        membershipTier ?? null,
        benefits !== undefined ? JSON.stringify(benefits) : null,
        notes ?? null,
        req.params.id,
      ]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Member not found' });

    const updated = await db.query(
      `SELECT ${SELECT_COLUMNS}
       FROM members m
       LEFT JOIN attachments a ON a.id = m."logoAttachmentId"
       WHERE m.id = $1`,
      [result.rows[0].id]
    );

    res.json(await withLogoUrl(updated.rows[0]));
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
