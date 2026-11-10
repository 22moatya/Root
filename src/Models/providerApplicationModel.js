const { Schema, model, Types } = require('mongoose');

const providerApplicationSchema = new Schema({
  user: { type: Types.ObjectId, ref: 'User', required: true, unique: true },
  nationalIdEncrypted: { type: String, required: true, select: false },
  nationalIdHash: { type: String, required: true, unique: true, select: false },
  phone: { type: String, required: true },
  bio: { type: String, trim: true, maxlength: 600, default: '' },
  workCategory: { type: Types.ObjectId, ref: 'Category' },
  governorate: { type: String, trim: true, maxlength: 60 },
  area: { type: String, trim: true, maxlength: 100 },
  idCardFilename: { type: String, required: true, select: false },
  idCardMimeType: { type: String, required: true, select: false },
  criminalRecordFilename: { type: String, required: true, select: false },
  criminalRecordMimeType: { type: String, required: true, select: false },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewedBy: { type: Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  rejectionReason: String
}, { timestamps: true });

module.exports = model('ProviderApplication', providerApplicationSchema);
