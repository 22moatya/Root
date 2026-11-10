const SiteSettings = require('../Models/siteSettingsModel');

const publicFields = 'siteName tagline supportEmail supportPhone announcementMessage heroTitle heroDescription primaryColor accentColor';
const allowedFields = new Set(publicFields.split(' '));

exports.getSettings = async (req, res) => {
  try {
    const settings = await SiteSettings.findById('site').select(publicFields).lean();
    res.json({ settings: settings || new SiteSettings().toObject() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Settings must be sent as an object' });
    }
    const updates = {};
    for (const [field, value] of Object.entries(req.body)) {
      if (!allowedFields.has(field)) {
        return res.status(400).json({ error: `Setting "${field}" cannot be changed here` });
      }
      if (typeof value !== 'string') {
        return res.status(400).json({ error: `Setting "${field}" must be text` });
      }
      const maxLengths = {
        siteName: 60,
        tagline: 120,
        supportEmail: 254,
        supportPhone: 30,
        announcementMessage: 240,
        heroTitle: 100,
        heroDescription: 300,
        primaryColor: 7,
        accentColor: 7
      };
      if (value.trim().length > maxLengths[field]) {
        return res.status(400).json({ error: `Setting "${field}" is too long` });
      }
      updates[field] = value.trim();
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'Provide at least one setting to update' });
    }

    if (updates.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.supportEmail)) {
      return res.status(400).json({ error: 'Support email must be a valid email address' });
    }
    if (updates.supportPhone && !/^[+()\d\s-]{7,30}$/.test(updates.supportPhone)) {
      return res.status(400).json({ error: 'Support phone number is invalid' });
    }
    for (const field of ['primaryColor', 'accentColor']) {
      if (updates[field] && !/^#[0-9a-fA-F]{6}$/.test(updates[field])) {
        return res.status(400).json({ error: `${field} must be a six-digit hex color` });
      }
    }

    const settings = await SiteSettings.findByIdAndUpdate('site', { $set: updates }, {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true
    }).select(publicFields);
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
