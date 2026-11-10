const router = require('express').Router();
const authController = require('../Controllers/authController');
const userController = require('../Controllers/userController');
const { profilePhotoUpload } = require('../utiles/imageUpload');

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/admin-setup/status', userController.getAdminSetupStatus);
router.post('/admin-setup', userController.createInitialAdmin);
router.post('/admin-signup', authController.protect, authController.auth('admin'), userController.createAdmin);

// ✅ راوت يرجع بيانات المستخدم الحالي
router.get('/me', authController.protect, authController.getMe);
router.get('/me/profile', authController.protect, userController.getMyProfile);
router.patch('/me/profile', authController.protect, userController.updateMyProfile);
router.patch('/me/photo', authController.protect, profilePhotoUpload, userController.updateMyPhoto);
// نحمي كل الراوتات دي ب middleware
router.use(authController.protect, authController.auth('admin'));

router.get('/providers', userController.getProvidersForAdmin);
router.patch('/providers/:id/status', userController.setProviderStatus);
router.route('/')
    .get(userController.getAllUsers);


router.route('/:id')
    .get(userController.getUser)
    .patch(userController.updateUser)
    .delete(userController.deleteUser);

module.exports = router;
