const { google } = require('googleapis');

const db = require('../database');
const { decryptToken, encryptToken, isEncryptionConfigured } = require('./crypto');

const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly',
];

function isConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    isEncryptionConfigured()
  );
}

function configurationMessage() {
  if (!process.env.GOOGLE_CLIENT_ID) return 'GOOGLE_CLIENT_ID is not configured';
  if (!process.env.GOOGLE_CLIENT_SECRET) return 'GOOGLE_CLIENT_SECRET is not configured';
  if (!isEncryptionConfigured()) return 'GOOGLE_TOKEN_ENCRYPTION_KEY must be a 32-byte base64 or hex value';
  return null;
}

function inferRedirectUri(req) {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) return process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!req) return null;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `${String(proto).split(',')[0]}://${host}/api/google/oauth/callback` : null;
}

function createOAuthClient(redirectUri) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

async function getConnection(userId) {
  const result = await db.query(
    `SELECT id, "userId", "googleEmail", "accessTokenEncrypted", "refreshTokenEncrypted",
            scope, "tokenExpiry", "createdAt", "updatedAt"
     FROM google_connections
     WHERE "userId" = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function getAuthorizedClient(userId) {
  if (!isConfigured()) {
    const error = new Error(configurationMessage() || 'Google integration is not configured');
    error.statusCode = 503;
    error.code = 'google_unconfigured';
    throw error;
  }

  const connection = await getConnection(userId);
  if (!connection || !connection.refreshTokenEncrypted) {
    const error = new Error('Google account is not connected');
    error.statusCode = 409;
    error.code = 'google_not_connected';
    throw error;
  }

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    access_token: decryptToken(connection.accessTokenEncrypted),
    refresh_token: decryptToken(connection.refreshTokenEncrypted),
    expiry_date: connection.tokenExpiry ? new Date(connection.tokenExpiry).getTime() : undefined,
  });

  oauth2Client.on('tokens', async (tokens) => {
    const updates = [];
    const params = [];
    if (tokens.access_token) {
      params.push(encryptToken(tokens.access_token));
      updates.push(`"accessTokenEncrypted" = $${params.length}`);
    }
    if (tokens.refresh_token) {
      params.push(encryptToken(tokens.refresh_token));
      updates.push(`"refreshTokenEncrypted" = $${params.length}`);
    }
    if (tokens.expiry_date) {
      params.push(new Date(tokens.expiry_date));
      updates.push(`"tokenExpiry" = $${params.length}`);
    }
    if (updates.length === 0) return;
    params.push(userId);
    await db.query(
      `UPDATE google_connections
       SET ${updates.join(', ')}, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "userId" = $${params.length}`,
      params
    );
  });

  try {
    await oauth2Client.getAccessToken();
  } catch (error) {
    await db.query('DELETE FROM google_connections WHERE "userId" = $1', [userId]);
    const reconnect = new Error('Google connection expired. Please reconnect Google.');
    reconnect.statusCode = 409;
    reconnect.code = 'reconnect_required';
    throw reconnect;
  }

  return oauth2Client;
}

module.exports = {
  SCOPES,
  configurationMessage,
  createOAuthClient,
  getAuthorizedClient,
  getConnection,
  inferRedirectUri,
  isConfigured,
};
