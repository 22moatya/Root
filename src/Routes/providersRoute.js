const router = require('express').Router();
const povidersController = require('../Controllers/providersController');
const authController = require('../Controllers/authController');
const { providerApplicationUpload } = require('../utiles/imageUpload');

router.get('/governorates', povidersController.getGovernorates);
router.post('/applications', authController.protect, authController.auth('customer'), providerApplicationUpload, povidersController.submitApplication);
router.get('/applications/me', authController.protect, authController.auth('customer', 'provider'), povidersController.getMyApplication);
router.get('/applications', authController.protect, authController.auth('admin'), povidersController.getApplications);
router.get('/applications/:id/id-card', authController.protect, authController.auth('admin'), povidersController.getApplicationIdCard);
router.get('/applications/:id/criminal-record', authController.protect, authController.auth('admin'), povidersController.getApplicationCriminalRecord);
router.patch('/applications/:id', authController.protect, authController.auth('admin'), povidersController.reviewApplication);

router.route('/')
    .post(authController.protect, authController.auth('provider'), povidersController.createOrUpdateProfile)
    .get(authController.protect, authController.auth('admin'), povidersController.getAllProviders);

router.get('/service/:serviceId', povidersController.getProvidersByService);

router.route('/near').get(authController.protect, povidersController.getNearbyProviders);

// عرض مقدم خدمة واحد
router.get('/:id', povidersController.getProvider);


module.exports = router;
