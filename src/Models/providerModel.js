// src/models/ProviderProfile.js
const { Schema, model, Types } = require('mongoose');

const providerLocationSchema = new Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], required: true }
}, { _id: false });

const providerProfileSchema = new Schema({
  user: { type: Types.ObjectId, ref: 'User', unique: true },
  workCategory: { type: Types.ObjectId, ref: 'Category' },
  governorate: { type: String, trim: true, maxlength: 60 },
  area: { type: String, trim: true, maxlength: 100 },
  bio: { type: String, trim: true, maxlength: 600, default: '' },
  services: [{ type: Types.ObjectId, ref: 'Service' }],
  address: String,
  location: { type: providerLocationSchema, default: undefined },
  averageRating: { type: Number, default: 0 },
  reviewsCount: { type: Number, default: 0 }

}, { timestamps: true });

// اعمل 2dsphere index
providerProfileSchema.index({ location: '2dsphere' });

module.exports = model('ProviderProfile', providerProfileSchema);
