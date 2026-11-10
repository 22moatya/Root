const { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } = require('crypto');

const getEncryptionKey = () => {
  const secret = process.env.PROVIDER_PII_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Set PROVIDER_PII_KEY or JWT_SECRET before accepting provider applications');
  }
  return createHash('sha256').update(secret).digest();
};

exports.hashNationalId = nationalId => createHmac('sha256', getEncryptionKey())
  .update(nationalId)
  .digest('hex');

exports.encryptNationalId = nationalId => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(nationalId, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
};

exports.decryptNationalId = value => {
  const [iv, authTag, encrypted] = value.split('.').map(part => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};
