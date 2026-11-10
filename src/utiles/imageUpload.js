const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const multer = require('multer');

const imageTypes = new Map([
  ['image/jpeg', { extension: '.jpg', signature: buffer => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff }],
  ['image/png', { extension: '.png', signature: buffer => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) }],
  ['image/webp', { extension: '.webp', signature: buffer => buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' }]
]);

const providerApplicationTypes = new Set([...imageTypes.keys(), 'application/pdf']);

const createImageUpload = fieldName => multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!imageTypes.has(file.mimetype)) {
      const error = new Error('Upload a JPEG, PNG, or WebP image');
      error.statusCode = 400;
      return callback(error);
    }
    callback(null, true);
  }
}).single(fieldName);

exports.profilePhotoUpload = createImageUpload('photo');
exports.categoryImageUpload = createImageUpload('image');
exports.providerApplicationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, callback) => {
    const allowedTypes = file.fieldname === 'criminalRecord'
      ? providerApplicationTypes
      : new Set(imageTypes.keys());
    if (!allowedTypes.has(file.mimetype)) {
      const error = new Error(
        file.fieldname === 'criminalRecord'
          ? 'Upload a JPEG, PNG, WebP, or PDF criminal record document'
          : 'Upload a JPEG, PNG, or WebP ID card image'
      );
      error.statusCode = 400;
      return callback(error);
    }
    callback(null, true);
  }
}).fields([
  { name: 'idCard', maxCount: 1 },
  { name: 'criminalRecord', maxCount: 1 }
]);

exports.validateImageFile = file => {
  if (!file || !imageTypes.get(file.mimetype)?.signature(file.buffer)) {
    const error = new Error('The uploaded file is not a valid JPEG, PNG, or WebP image');
    error.statusCode = 400;
    throw error;
  }
  return imageTypes.get(file.mimetype);
};

exports.saveImage = async (file, directory, prefix) => {
  const { extension } = exports.validateImageFile(file);
  await fs.mkdir(directory, { recursive: true });
  const filename = `${prefix}-${randomUUID()}${extension}`;
  await fs.writeFile(path.join(directory, filename), file.buffer, { flag: 'wx' });
  return filename;
};

exports.saveProviderDocument = async (file, directory, prefix) => {
  let extension;
  if (file.mimetype === 'application/pdf') {
    if (file.buffer.toString('ascii', 0, 5) !== '%PDF-') {
      const error = new Error('The uploaded file is not a valid PDF document');
      error.statusCode = 400;
      throw error;
    }
    extension = '.pdf';
  } else {
    ({ extension } = exports.validateImageFile(file));
  }
  await fs.mkdir(directory, { recursive: true });
  const filename = `${prefix}-${randomUUID()}${extension}`;
  await fs.writeFile(path.join(directory, filename), file.buffer, { flag: 'wx' });
  return filename;
};
