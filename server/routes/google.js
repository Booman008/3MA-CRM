const crypto = require('crypto');
const express = require('express');
const { google } = require('googleapis');

const db = require('../database');
const {
  SCOPES,
  configurationMessage,
  createOAuthClient,
  getAuthorizedClient,
  getConnection,
  inferRedirectUri,
  isConfigured,
} = require('../google/client');
const { encryptToken } = require('../google/crypto');

const router = express.Router();

function googleUnavailable(res) {
  const message = configurationMessage();
  if (!message) return false;
  res.status(503).json({ error: message, code: 'google_unconfigured' });
  return true;
}

function googleError(res, error) {
  const status = error.statusCode || 500;
  res.status(status).json({ error: error.message || 'Google request failed', code: error.code || 'google_error' });
}

function normalizeScopes(scopeText) {
  return String(scopeText || '').split(/\s+/).filter(Boolean);
}

function headerValue(headers, name) {
  const found = (headers || []).find((header) => String(header.name || '').toLowerCase() === name.toLowerCase());
  return found?.value || '';
}

function parseEmailList(value) {
  return [...new Set(String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])];
}

function base64UrlDecode(value) {
  if (!value) return '';
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function messageBody(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) return base64UrlDecode(payload.body.data);
  if (payload.mimeType === 'text/html' && payload.body?.data) return stripHtml(base64UrlDecode(payload.body.data));
  for (const part of payload.parts || []) {
    const text = messageBody(part);
    if (text) return text;
  }
  return '';
}

function messageDate(message) {
  const internalDate = Number(message.internalDate);
  if (Number.isFinite(internalDate)) return new Date(internalDate);
  const dateHeader = headerValue(message.payload?.headers, 'Date');
  const parsed = new Date(dateHeader);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function nextDateOnly(value) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function loadEntity(entityType, entityId) {
  if (!['member', 'lead', 'legislator'].includes(entityType)) {
    const error = new Error('entityType must be "member", "lead", or "legislator"');
    error.statusCode = 400;
    throw error;
  }

  const table = entityType === 'member' ? 'members' : entityType === 'lead' ? 'leads' : 'legislators';
  const nameColumn = entityType === 'legislator' ? 'name' : '"businessName"';
  const emailColumn = entityType === 'legislator' ? 'NULL::text AS email' : 'email';
  const result = await db.query(
    `SELECT id, ${nameColumn} AS name, ${emailColumn} FROM ${table} WHERE id = $1`,
    [entityId]
  );
  const entity = result.rows[0];
  if (!entity) {
    const error = new Error('Entity not found');
    error.statusCode = 404;
    throw error;
  }
  return entity;
}

router.get('/status', async (req, res) => {
  if (!isConfigured()) {
    return res.json({
      configured: false,
      connected: false,
      error: configurationMessage(),
      scopes: [],
    });
  }

  try {
    const connection = await getConnection(req.user.sub);
    res.json({
      configured: true,
      connected: !!connection,
      googleEmail: connection?.googleEmail || null,
      scopes: normalizeScopes(connection?.scope),
      tokenExpiry: connection?.tokenExpiry || null,
    });
  } catch (error) {
    googleError(res, error);
  }
});

router.post('/oauth/start', async (req, res) => {
  if (googleUnavailable(res)) return;

  try {
    const state = crypto.randomBytes(24).toString('hex');
    await db.query('DELETE FROM google_oauth_states WHERE "createdAt" < now() - interval \'10 minutes\'');
    await db.query('INSERT INTO google_oauth_states (state, "userId") VALUES ($1, $2)', [state, req.user.sub]);

    const redirectUri = inferRedirectUri(req);
    if (!redirectUri) return res.status(503).json({ error: 'Could not determine Google OAuth redirect URI', code: 'google_unconfigured' });
    const oauth2Client = createOAuthClient(redirectUri);
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: SCOPES,
      state,
    });
    res.json({ url });
  } catch (error) {
    googleError(res, error);
  }
});

async function oauthCallback(req, res) {
  const fail = () => res.redirect('/#settings?google=error');
  if (!isConfigured()) return fail();

  const { code, state } = req.query;
  if (!code || !state) return fail();

  try {
    const stateResult = await db.query(
      `DELETE FROM google_oauth_states
       WHERE state = $1 AND "createdAt" >= now() - interval '10 minutes'
       RETURNING "userId"`,
      [state]
    );
    await db.query('DELETE FROM google_oauth_states WHERE "createdAt" < now() - interval \'10 minutes\'');
    const userId = stateResult.rows[0]?.userId;
    if (!userId) return fail();

    const redirectUri = inferRedirectUri(req);
    if (!redirectUri) return fail();
    const oauth2Client = createOAuthClient(redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const userInfo = await google.oauth2({ version: 'v2', auth: oauth2Client }).userinfo.get();
    const googleEmail = userInfo.data?.email || null;

    const existing = await getConnection(userId);
    const refreshToken = tokens.refresh_token || (existing?.refreshTokenEncrypted ? null : undefined);
    if (refreshToken === undefined) return fail();

    await db.query(
      `INSERT INTO google_connections (
         "userId", "googleEmail", "accessTokenEncrypted", "refreshTokenEncrypted",
         scope, "tokenExpiry", "updatedAt"
       )
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT ("userId") DO UPDATE
       SET "googleEmail" = EXCLUDED."googleEmail",
           "accessTokenEncrypted" = EXCLUDED."accessTokenEncrypted",
           "refreshTokenEncrypted" = COALESCE(EXCLUDED."refreshTokenEncrypted", google_connections."refreshTokenEncrypted"),
           scope = EXCLUDED.scope,
           "tokenExpiry" = EXCLUDED."tokenExpiry",
           "updatedAt" = CURRENT_TIMESTAMP`,
      [
        userId,
        googleEmail,
        encryptToken(tokens.access_token),
        tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        tokens.scope || SCOPES.join(' '),
        tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      ]
    );

    res.redirect('/#settings?google=connected');
  } catch (error) {
    console.error('Google OAuth callback failed:', error);
    fail();
  }
}

router.delete('/connection', async (req, res) => {
  try {
    await db.query('DELETE FROM google_connections WHERE "userId" = $1', [req.user.sub]);
    res.status(204).end();
  } catch (error) {
    googleError(res, error);
  }
});

router.post('/calendar/export-tasks', async (req, res) => {
  const taskIds = Array.isArray(req.body?.taskIds) ? req.body.taskIds.map(Number).filter(Number.isFinite) : [];
  const calendarId = req.body?.calendarId || 'primary';
  const force = req.body?.force === true;
  if (taskIds.length === 0) return res.status(400).json({ error: 'taskIds are required', code: 'missing_task_ids' });

  try {
    const auth = await getAuthorizedClient(req.user.sub);
    const calendar = google.calendar({ version: 'v3', auth });
    const taskResult = await db.query(
      `SELECT id, title, description, "dueDate", priority, "entityType", "entityId",
              "entityName", "googleCalendarEventId"
       FROM tasks
       WHERE id = ANY($1::int[])
       ORDER BY id ASC`,
      [taskIds]
    );
    const byId = new Map(taskResult.rows.map((task) => [Number(task.id), task]));
    const results = [];

    for (const taskId of taskIds) {
      const task = byId.get(taskId);
      if (!task) {
        results.push({ taskId, status: 'failed', reason: 'not_found' });
        continue;
      }
      if (task.googleCalendarEventId && !force) {
        results.push({ taskId, status: 'skipped', reason: 'already_exported', eventId: task.googleCalendarEventId });
        continue;
      }
      if (!task.dueDate) {
        results.push({ taskId, status: 'failed', reason: 'missing_due_date' });
        continue;
      }

      try {
        const description = [
          task.description || '',
          task.entityName ? `CRM entity: ${task.entityName} (${task.entityType || 'record'} #${task.entityId || ''})` : '',
          task.priority ? `Priority: ${task.priority}` : '',
        ].filter(Boolean).join('\n\n');
        const event = await calendar.events.insert({
          calendarId,
          requestBody: {
            summary: task.title,
            description,
            start: { date: task.dueDate },
            end: { date: nextDateOnly(task.dueDate) },
          },
        });
        await db.query(
          `UPDATE tasks
           SET "googleCalendarEventId" = $1,
               "googleCalendarId" = $2,
               "exportedToGoogleAt" = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [event.data.id, calendarId, taskId]
        );
        results.push({ taskId, status: 'exported', eventId: event.data.id });
      } catch (error) {
        results.push({ taskId, status: 'failed', reason: error.message || 'calendar_export_failed' });
      }
    }

    res.json({
      exported: results.filter((result) => result.status === 'exported').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      failed: results.filter((result) => result.status === 'failed').length,
      results,
    });
  } catch (error) {
    googleError(res, error);
  }
});

router.get('/gmail/search', async (req, res) => {
  const { entityType, entityId } = req.query;
  const maxResults = Math.min(Math.max(Number(req.query.maxResults) || 10, 1), 25);

  try {
    const entity = await loadEntity(entityType, Number(entityId));
    if (!entity.email) {
      return res.status(400).json({ error: 'This contact does not have an email address to search Gmail with.', code: 'missing_email' });
    }

    const auth = await getAuthorizedClient(req.user.sub);
    const gmail = google.gmail({ version: 'v1', auth });
    const query = `(from:${entity.email} OR to:${entity.email}) newer_than:2y`;
    const list = await gmail.users.threads.list({ userId: 'me', q: query, maxResults });
    const threads = [];

    for (const item of list.data.threads || []) {
      const thread = await gmail.users.threads.get({
        userId: 'me',
        id: item.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'To', 'Date'],
      });
      const messages = thread.data.messages || [];
      const last = messages[messages.length - 1] || {};
      const first = messages[0] || {};
      const headers = messages.flatMap((message) => message.payload?.headers || []);
      const participants = [...new Set([
        ...parseEmailList(headers.filter((h) => ['From', 'To'].includes(h.name)).map((h) => h.value).join(', ')),
      ])];
      threads.push({
        threadId: thread.data.id,
        subject: headerValue(first.payload?.headers, 'Subject') || '(No subject)',
        participants,
        messageCount: messages.length,
        lastMessageDate: dateOnly(messageDate(last)),
        snippet: thread.data.snippet || '',
      });
    }

    res.json({ threads });
  } catch (error) {
    googleError(res, error);
  }
});

router.post('/gmail/import-thread', async (req, res) => {
  const { entityType, entityId, threadId } = req.body || {};
  if (!threadId) return res.status(400).json({ error: 'threadId is required', code: 'missing_thread_id' });

  try {
    const entity = await loadEntity(entityType, Number(entityId));
    if (!entity.email) {
      return res.status(400).json({ error: 'This contact does not have an email address to import Gmail conversations.', code: 'missing_email' });
    }

    const existing = await db.query(
      `SELECT id, "entityId", "entityType", "entityName", "contactDate", "contactType",
              subject, direction, summary, "nextAction", "nextActionDate", "createdAt",
              "gmailThreadId", "gmailMessageIds", "gmailImportedAt"
       FROM contact_log
       WHERE "entityType" = $1 AND "entityId" = $2 AND "gmailThreadId" = $3`,
      [entityType, entityId, threadId]
    );
    if (existing.rows[0]) return res.json({ alreadyImported: true, contact: existing.rows[0] });

    const auth = await getAuthorizedClient(req.user.sub);
    const gmail = google.gmail({ version: 'v1', auth });
    const thread = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
    const messages = thread.data.messages || [];
    if (messages.length === 0) return res.status(404).json({ error: 'Gmail thread has no messages', code: 'empty_thread' });

    const entries = messages.map((message) => {
      const headers = message.payload?.headers || [];
      const from = headerValue(headers, 'From');
      const to = headerValue(headers, 'To');
      const subject = headerValue(headers, 'Subject');
      const date = messageDate(message);
      const body = messageBody(message.payload).replace(/\s+\n/g, '\n').trim();
      return { id: message.id, from, to, subject, date, body };
    });

    const latest = entries[entries.length - 1];
    const latestFrom = parseEmailList(latest.from).map((email) => email.toLowerCase());
    const direction = latestFrom.includes(String(entity.email).toLowerCase()) ? 'inbound' : 'outbound';
    const summary = entries.map((entry) => {
      const body = entry.body.length > 2500 ? `${entry.body.slice(0, 2500)}...` : entry.body;
      return [
        `${entry.date.toLocaleString('en-US')} | From: ${entry.from || '-'} | To: ${entry.to || '-'}`,
        body || '(No readable message body)',
      ].join('\n');
    }).join('\n\n---\n\n');

    const inserted = await db.query(
      `INSERT INTO contact_log (
         "entityId", "entityType", "entityName", "contactDate", "contactType",
         subject, direction, summary, "gmailThreadId", "gmailMessageIds", "gmailImportedAt"
       )
       VALUES ($1, $2, $3, $4, 'Email', $5, $6, $7, $8, $9::jsonb, CURRENT_TIMESTAMP)
       RETURNING id, "entityId", "entityType", "entityName", "contactDate", "contactType",
                 subject, direction, summary, "nextAction", "nextActionDate", "createdAt",
                 "gmailThreadId", "gmailMessageIds", "gmailImportedAt"`,
      [
        entityId,
        entityType,
        entity.name,
        dateOnly(latest.date),
        entries[0].subject || '(No subject)',
        direction,
        summary,
        threadId,
        JSON.stringify(entries.map((entry) => entry.id)),
      ]
    );

    res.status(201).json({ alreadyImported: false, contact: inserted.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'This Gmail thread has already been imported.', code: 'already_imported' });
    }
    googleError(res, error);
  }
});

module.exports = {
  oauthCallback,
  router,
};
