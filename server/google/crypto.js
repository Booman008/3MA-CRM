const crypto = require('crypto');

function getKey() {
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '';
  if (!raw) return null;

  const trimmed = raw.trim();
  const candidates = [];
  try { candidates.push(Buffer.from(trimmed, 'base64')); } catch {}
  try { candidates.push(Buffer.from(trimmed, 'hex')); } catch {}

  const direct = Buffer.from(trimmed);
  candidates.push(direct);

  return candidates.find((candidate) => candidate.length === 32) || null;
}

function isEncryptionConfigured() {
  return !!getKey();
}

function encryptToken(value) {
  if (!value) return null;
  const key = getKey();
  if (!key) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be a 32-byte base64 or hex value');

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

function decryptToken(value) {
  if (!value) return null;
  const key = getKey();
  if (!key) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be a 32-byte base64 or hex value');

  const [ivText, tagText, encryptedText] = String(value).split('.');
  if (!ivText || !tagText || !encryptedText) throw new Error('Invalid encrypted token payload');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

module.exports = {
  decryptToken,
  encryptToken,
  isEncryptionConfigured,
};
