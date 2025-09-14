const router = require('express').Router();
const povidersController = require('../Controllers/providersController');
const authController = require('../Controllers/authController');


router.route('/')
    .post(authController.protect, authController.auth('provider'), povidersController.createOrUpdateProfile)
    .get(authController.protect, authController.auth('admin'), povidersController.getAllProviders);


router.route('/near').get(authController.protect, povidersController.getNearbyProviders);

// عرض مقدم خدمة واحد
router.get('/:id', povidersController.getProvider);


module.exports = router;
