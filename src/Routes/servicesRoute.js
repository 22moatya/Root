const router = require('express').Router();
const authController = require('../Controllers/authController');
const serviceController = require('../Controllers/servicesController');
const upload = require('../utiles/upload');



router.route('/')
    .post(authController.protect, authController.auth('admin'), upload.single('image'), serviceController.createServices)
    .get(serviceController.getAllServices); 

// عرض خدمة واحدة
router.route('/:id')
    .get(authController.protect, serviceController.getService)
    .patch(authController.protect, authController.auth('admin'), serviceController.updateService)
    .delete(authController.protect, authController.auth('admin'), serviceController.deleteService);


module.exports = router;
