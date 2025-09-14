const router = require('express').Router();
const authController = require('../Controllers/authController');
const dashboardController = require('../Controllers/admindashboardController');

router.get(
  '/admin/overview',
  authController.protect,
  authController.auth('admin'),
  dashboardController.getAdminOverview
);

module.exports = router;
