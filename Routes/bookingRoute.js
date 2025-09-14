const router = require('express').Router();
const bookingController = require('../Controllers/bookingController');
const authController = require('../Controllers/authController');

// العميل يحجز خدمة
router.route('/').post(authController.protect, authController.auth('customer','admin'), bookingController.createBooking);

// العميل يشوف حجوزاته
router.route('/my').get(authController.protect, authController.auth('customer','admin'), bookingController.getMyBookings);

// المزود يشوف حجوزاته
router.route('/provider').get(authController.protect, authController.auth('provider','admin'), bookingController.getProviderBookings);

// المزود يغير حالة الحجز
router.route('/:id').patch(authController.protect, authController.auth('provider','admin'), bookingController.updateBookingStatus);

// العميل يلغى الحجز بتاعه
router.route('/:id/cancel').patch(authController.protect, authController.auth('customer','admin'), bookingController.cancelBooking);


module.exports = router;
