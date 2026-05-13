const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;

let client = null;

function getClient() {
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET in your environment.');
  }
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return client;
}

function isConfigured() {
  return !!(accountId && accessKeyId && secretAccessKey && bucket);
}

async function uploadObject(key, body, contentType) {
  await getClient().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

async function deleteObject(key) {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

async function getDownloadUrl(key, filename) {
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: filename ? `attachment; filename="${filename.replace(/"/g, '')}"` : undefined,
  });
  return getSignedUrl(getClient(), cmd, { expiresIn: 300 });
}

async function getInlineUrl(key) {
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(getClient(), cmd, { expiresIn: 300 });
}

module.exports = { isConfigured, uploadObject, deleteObject, getDownloadUrl, getInlineUrl };
