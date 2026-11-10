const { Schema, model, Types } = require('mongoose');

const bookingSchema = new Schema({
  customer: { type: Types.ObjectId, ref: 'User', required: true },
  provider: { type: Types.ObjectId, ref: 'User', required: true },
  service: { type: Types.ObjectId, ref: 'Service', required: true },
  governorate: { type: String, required: true, trim: true, maxlength: 60 },
  date: { type: Date, required: true },
  requestDetails: { type: String, required: true, trim: true, maxlength: 2000 },
  address: { type: String, required: true, trim: true, maxlength: 300 },
  contactPhone: { type: String, required: true, trim: true, maxlength: 20 },
  proposedPrice: { type: Number, min: 0 },
  commissionRate: { type: Number, min: 0, max: 1, select: false },
  commissionAmount: { type: Number, min: 0, select: false },
  commissionAccruedAt: { type: Date, select: false },
  status: {
    type: String,
    enum: ['pending', 'quote_proposed', 'in_progress', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  }
}, { timestamps: true });

module.exports = model('Booking', bookingSchema);
