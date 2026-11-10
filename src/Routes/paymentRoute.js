// src/routes/paymentRoutes.js
const router = require('express').Router();
const authController = require('../Controllers/authController');
const paymentController = require('../Controllers/paymentController');
const providerCommissionController = require('../Controllers/providerCommissionController');

router.get('/commissions/me', authController.protect, authController.auth('provider'), providerCommissionController.getProviderCommissions);
router.post('/commissions', authController.protect, authController.auth('provider'), providerCommissionController.submitCommissionPayment);
router.get('/commissions/admin', authController.protect, authController.auth('admin'), providerCommissionController.getAllCommissionPayments);
router.patch('/commissions/:id/confirm', authController.protect, authController.auth('admin'), providerCommissionController.confirmCommissionPayment);

// العميل يعمل دفع
router.route('/').post(authController.protect, authController.auth('customer','admin'), paymentController.createPayment);

// دفع بالبطاقة (Stripe)
router.route('/checkout-session/:bookingId').get(authController.protect,paymentController.getCheckoutSession);


// الادمن يشوف كل الدفعات
router.route('/').get(authController.protect, authController.auth('admin'), paymentController.getAllPayments);

// أي مستخدم يقدر يشوف حالة الدفع بتاعه
router.route('/:id').get(authController.protect, paymentController.getPaymentSafe);


module.exports = router;
