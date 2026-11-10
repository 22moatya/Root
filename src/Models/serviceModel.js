// src/models/Service.js
const { Schema, model } = require('mongoose');

const serviceSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  basePrice: Number,
  durationMin: Number,
  image: String,
  category: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  isCategoryListing: { type: Boolean, default: false }
}, { timestamps: true });

serviceSchema.index(
  { category: 1 },
  { unique: true, partialFilterExpression: { isCategoryListing: true } }
);

module.exports = model('Service', serviceSchema);
