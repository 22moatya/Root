// src/routes/reviewRoutes.js
const router = require('express').Router();
const reviewController = require('../Controllers/reviewController');
const authController = require('../Controllers/authController');

// العميل يكتب تقييم
router.post(
  '/',
  authController.protect,
  authController.auth('customer','admin'),
  reviewController.createReview
);

// عرض تقييمات مزود خدمة
router.get('/provider/:id', reviewController.getProviderReviews);

module.exports = router;
