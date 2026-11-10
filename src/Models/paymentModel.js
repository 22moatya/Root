// src/models/paymentModel.js
const { Schema, model, Types } = require('mongoose');

const paymentSchema = new Schema({
  booking: { type: Types.ObjectId, ref: 'Booking', required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ['card', 'paypal', 'cash'], default: 'cash' },
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  transactionId: String
}, { timestamps: true });

module.exports = model('Payment', paymentSchema);
