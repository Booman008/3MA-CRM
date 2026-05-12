const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const db = require('../database');
const r2 = require('../r2');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const COLUMNS = `id, "entityType", "entityId", filename, "mimeType", "sizeBytes", "r2Key", "uploadedAt"`;

router.get('/', async (req, res) => {
  const { entityType, entityId } = req.query;
  if (!entityType || !entityId) return res.status(400).json({ error: 'entityType and entityId are required' });

  try {
    const result = await db.query(
      `SELECT ${COLUMNS} FROM attachments
       WHERE "entityType" = $1 AND "entityId" = $2
       ORDER BY "uploadedAt" DESC`,
      [entityType, Number(entityId)]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to load attachments:', error);
    res.status(500).json({ error: 'Failed to load attachments' });
  }
});

router.post('/', upload.single('file'), async (req, res) => {
  if (!r2.isConfigured()) return res.status(503).json({ error: 'File storage is not configured. Set R2_* environment variables.' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { entityType, entityId } = req.body;
  if (!entityType || !entityId) return res.status(400).json({ error: 'entityType and entityId are required' });
  if (!['member', 'lead'].includes(entityType)) return res.status(400).json({ error: 'Invalid entityType' });

  const safeName = req.file.originalname.replace(/[^\w.\-]/g, '_');
  const key = `${entityType}/${entityId}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName}`;

  try {
    await r2.uploadObject(key, req.file.buffer, req.file.mimetype);

    const result = await db.query(
      `INSERT INTO attachments ("entityType", "entityId", filename, "mimeType", "sizeBytes", "r2Key")
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLUMNS}`,
      [entityType, Number(entityId), req.file.originalname, req.file.mimetype, req.file.size, key]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Upload failed:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

router.get('/:id/download', async (req, res) => {
  if (!r2.isConfigured()) return res.status(503).json({ error: 'File storage is not configured' });

  try {
    const result = await db.query(`SELECT ${COLUMNS} FROM attachments WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Attachment not found' });

    const att = result.rows[0];
    const url = await r2.getDownloadUrl(att.r2Key, att.filename);
    res.json({ url });
  } catch (error) {
    console.error('Failed to generate download URL:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(`SELECT "r2Key" FROM attachments WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Attachment not found' });

    if (r2.isConfigured()) {
      try { await r2.deleteObject(result.rows[0].r2Key); } catch (e) { console.warn('R2 delete failed (continuing):', e.message); }
    }

    await db.query('DELETE FROM attachments WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete attachment:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

module.exports = router;
