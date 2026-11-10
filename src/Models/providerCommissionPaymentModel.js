const { Schema, model, Types } = require('mongoose');

const commissionPaymentAttemptSchema = new Schema({
  amount: { type: Number, required: true, min: 0.01 },
  paymentMethod: { type: String, enum: ['visa', 'e_wallet'], required: true },
  paymentReference: { type: String, required: true, trim: true, maxlength: 100 },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  confirmedBy: { type: Types.ObjectId, ref: 'User' },
  paidAt: Date
}, { timestamps: true });

const providerCommissionPaymentSchema = new Schema({
  provider: { type: Types.ObjectId, ref: 'User', required: true },
  period: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  payments: { type: [commissionPaymentAttemptSchema], default: [] },
  amount: { type: Number, min: 0.01, select: false },
  paymentMethod: { type: String, enum: ['visa', 'e_wallet'], select: false },
  paymentReference: { type: String, trim: true, maxlength: 100, select: false },
  status: { type: String, enum: ['pending', 'paid'], select: false },
  confirmedBy: { type: Types.ObjectId, ref: 'User', select: false },
  paidAt: Date
}, { timestamps: true });

providerCommissionPaymentSchema.index({ provider: 1, period: 1 }, { unique: true });
providerCommissionPaymentSchema.index({ status: 1, period: -1 });

module.exports = model('ProviderCommissionPayment', providerCommissionPaymentSchema);
