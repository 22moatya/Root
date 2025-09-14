// src/models/User.js
const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  photo: String,
  role: { type: String, enum: ['customer', 'provider', 'admin'], default: 'customer' }
}, { timestamps: true });

module.exports = model('User', userSchema);
