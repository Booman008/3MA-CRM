const express = require('express');

const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT "key", value FROM settings');
    const settings = {};

    result.rows.forEach((row) => {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    });

    res.json(settings);
  } catch (error) {
    console.error('Failed to load settings:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.put('/', async (req, res) => {
  const updates = Object.entries(req.body || {});

  try {
    await db.transaction(async (client) => {
      for (const [key, value] of updates) {
        const stored = typeof value === 'object' ? JSON.stringify(value) : String(value);
        await client.query(
          `
            INSERT INTO settings ("key", value)
            VALUES ($1, $2)
            ON CONFLICT ("key")
            DO UPDATE SET value = EXCLUDED.value
          `,
          [key, stored]
        );
      }
    });

    const result = await db.query('SELECT "key", value FROM settings');
    const settings = {};

    result.rows.forEach((row) => {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    });

    res.json(settings);
  } catch (error) {
    console.error('Failed to update settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
