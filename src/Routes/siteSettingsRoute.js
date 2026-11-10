const router = require('express').Router();
const authController = require('../Controllers/authController');
const siteSettingsController = require('../Controllers/siteSettingsController');

router.get('/', siteSettingsController.getSettings);
router.patch('/', authController.protect, authController.auth('admin'), siteSettingsController.updateSettings);

module.exports = router;
