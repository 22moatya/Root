const { Schema, model } = require('mongoose');

const adminSetupSchema = new Schema({
  _id: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  completedAt: { type: Date, required: true }
});

module.exports = model('AdminSetup', adminSetupSchema);
