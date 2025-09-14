// src/Models/reviewModel.js
const { Schema, model, Types } = require('mongoose');

const reviewSchema = new Schema({
  customer: { type: Types.ObjectId, ref: 'User', required: true },
  provider: { type: Types.ObjectId, ref: 'User', required: true },
  service: { type: Types.ObjectId, ref: 'Service', required: true },
  booking: { type: Types.ObjectId, ref: 'Booking', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, trim: true }
}, { timestamps: true });

// منع العميل من كتابة أكثر من تقييم لنفس الحجز
reviewSchema.index({ customer: 1, booking: 1 }, { unique: true });

module.exports = model('Review', reviewSchema);
