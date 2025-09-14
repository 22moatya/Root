// src/models/Service.js
const { Schema, model } = require('mongoose');

const serviceSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  basePrice: Number,
  durationMin: Number,
  image: String // هنا نخزن اسم الصورة
}, { timestamps: true });

module.exports = model('Service', serviceSchema);
