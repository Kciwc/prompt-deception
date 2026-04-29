// Cloudflare R2 is S3-compatible. We use the AWS SDK client with R2's endpoint.
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { r2 } = require('../config');

const client = new S3Client({
  region: 'auto',
  endpoint: r2.endpoint,
  credentials: {
    accessKeyId: r2.accessKeyId,
    secretAccessKey: r2.secretAccessKey,
  },
});

async function put(key, buffer, contentType = 'application/octet-stream') {
  await client.send(new PutObjectCommand({
    Bucket: r2.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

async function remove(key) {
  try {
    await client.send(new DeleteObjectCommand({
      Bucket: r2.bucket,
      Key: key,
    }));
  } catch (err) {
    // Treat 404 as success — object already gone.
    if (err?.$metadata?.httpStatusCode !== 404) throw err;
  }
}

function urlFor(key) {
  // r2.publicUrl already has no trailing slash (we documented that).
  return `${r2.publicUrl}/${key}`;
}

module.exports = {
  kind: 'r2',
  put,
  remove,
  urlFor,
};
