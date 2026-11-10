const router = require('express').Router();
const authController = require('../Controllers/authController');
const categoriesController = require('../Controllers/categoriesController');
const { categoryImageUpload } = require('../utiles/imageUpload');

router.get('/', categoriesController.getCategories);
router.get('/admin', authController.protect, authController.auth('admin'), categoriesController.getAdminCategories);
router.post('/', authController.protect, authController.auth('admin'), categoryImageUpload, categoriesController.createCategory);
router.patch('/:id', authController.protect, authController.auth('admin'), categoryImageUpload, categoriesController.updateCategory);
router.delete('/:id', authController.protect, authController.auth('admin'), categoriesController.deleteCategory);

module.exports = router;
