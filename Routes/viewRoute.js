const express = require('express');
const router = express.Router();
const viewController = require('../Controllers/viewController');
const authController = require('../Controllers/authController');


router.route('/').get(viewController.getMainPage);
router.route('/signup').get(viewController.signupPage);
router.route('/login').get(viewController.loginPage);

router.route('/account').get(authController.protect, viewController.getMyAccount);


module.exports = router;