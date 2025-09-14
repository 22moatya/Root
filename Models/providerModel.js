// src/models/ProviderProfile.js
const { Schema, model, Types } = require('mongoose');

const providerProfileSchema = new Schema({
  user: { type: Types.ObjectId, ref: 'User', unique: true },
  services: [{ type: Types.ObjectId, ref: 'Service' }],
  address: String,
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [lng, lat]
  },
  averageRating: { type: Number, default: 0 },
  reviewsCount: { type: Number, default: 0 }

}, { timestamps: true });

// اعمل 2dsphere index
providerProfileSchema.index({ location: '2dsphere' });

module.exports = model('ProviderProfile', providerProfileSchema);
