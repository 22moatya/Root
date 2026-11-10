const { Schema, model } = require('mongoose');

const categorySchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, trim: true, maxlength: 240, default: '' },
  image: { type: String, trim: true, maxlength: 100, default: '' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

categorySchema.index({ isActive: 1, sortOrder: 1, name: 1 });

module.exports = model('Category', categorySchema);
