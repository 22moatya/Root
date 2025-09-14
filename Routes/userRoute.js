const router = require('express').Router();
const authController = require('../Controllers/authController');
const userController = require('../Controllers/userController');

router.post('/signup', authController.signup);
router.post('/login', authController.login);

// ✅ راوت يرجع بيانات المستخدم الحالي
router.get('/me', authController.protect, authController.getMe);
// نحمي كل الراوتات دي ب middleware
router.use(authController.protect, authController.auth('admin'));

router.route('/')
    .get(userController.getAllUsers);


router.route('/:id')
    .get(userController.getUser)
    .patch(userController.updateUser)
    .delete(userController.deleteUser);

module.exports = router;
