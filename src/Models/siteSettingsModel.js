const { Schema, model } = require('mongoose');

const siteSettingsSchema = new Schema({
  _id: { type: String, default: 'site', immutable: true },
  siteName: { type: String, default: 'Root', trim: true, maxlength: 60 },
  primaryColor: { type: String, default: '#245c46', match: /^#[0-9a-fA-F]{6}$/ },
  accentColor: { type: String, default: '#d3ef83', match: /^#[0-9a-fA-F]{6}$/ },
  tagline: { type: String, default: 'Good help, close to home.', trim: true, maxlength: 120 },
  supportEmail: { type: String, default: '', trim: true, lowercase: true, maxlength: 254 },
  supportPhone: { type: String, default: '', trim: true, maxlength: 30 },
  announcementMessage: { type: String, default: '', trim: true, maxlength: 240 },
  heroTitle: { type: String, default: 'Good help. Close to home.', trim: true, maxlength: 100 },
  heroDescription: {
    type: String,
    default: 'Find trusted local professionals who make everyday life a little easier.',
    trim: true,
    maxlength: 300
  }
}, { timestamps: true, versionKey: false });

module.exports = model('SiteSettings', siteSettingsSchema);
