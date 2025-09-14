const { Schema, model, Types } = require('mongoose');

const bookingSchema = new Schema({
  customer: { type: Types.ObjectId, ref: 'User', required: true },
  provider: { type: Types.ObjectId, ref: 'User', required: true },
  service: { type: Types.ObjectId, ref: 'Service', required: true },
  date: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'cancelled', 'completed'], 
    default: 'pending' 
  }
}, { timestamps: true });

module.exports = model('Booking', bookingSchema);
