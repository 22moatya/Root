const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const Category = require('../Models/categoryModel');
const Service = require('../Models/serviceModel');
const ProviderApplication = require('../Models/providerApplicationModel');
const ProviderProfile = require('../Models/providerModel');
const { saveImage } = require('../utiles/imageUpload');
const logger = require('../utiles/logger');

const categoryImageDirectory = path.join(__dirname, '..', '..', 'public', 'img', 'categories');
const removeCategoryImage = async filename => {
  if (!/^category-[0-9a-f-]{36}\.(jpg|png|webp)$/.test(filename || '')) return;
  await fs.unlink(path.join(categoryImageDirectory, filename));
};
const cleanUpCategoryImage = async filename => {
  try {
    await removeCategoryImage(filename);
  } catch (error) {
    if (error.code !== 'ENOENT') logger.error(`Could not clean up category image: ${error.message}`);
  }
};

const makeSlug = value => value
  .normalize('NFKC')
  .toLocaleLowerCase()
  .trim()
  .replace(/[^\p{L}\p{N}]+/gu, '-')
  .replace(/^-|-$/g, '');

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select('name slug description image sortOrder')
      .sort({ sortOrder: 1, name: 1 });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAdminCategories = async (req, res) => {
  try {
    const [categories, services, applications, profiles] = await Promise.all([
      Category.find().sort({ sortOrder: 1, name: 1 }),
      Service.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      ProviderApplication.aggregate([{ $group: { _id: '$workCategory', count: { $sum: 1 } } }]),
      ProviderProfile.aggregate([{ $group: { _id: '$workCategory', count: { $sum: 1 } } }])
    ]);

    const serviceCounts = new Map(services.map(item => [String(item._id), item.count]));
    const applicationCounts = new Map(applications.map(item => [String(item._id), item.count]));
    const profileCounts = new Map(profiles.map(item => [String(item._id), item.count]));
    res.json({
      categories: categories.map(category => ({
        ...category.toObject(),
        serviceCount: serviceCounts.get(String(category._id)) || 0,
        applicantCount: applicationCounts.get(String(category._id)) || 0,
        providerCount: profileCounts.get(String(category._id)) || 0
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createCategory = async (req, res) => {
  let uploadedImage;
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Category must be sent as an object' });
    }
    const { name, description = '', sortOrder = 0 } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    if (typeof description !== 'string' || !Number.isInteger(Number(sortOrder))) {
      return res.status(400).json({ error: 'Description must be text and sort order must be a whole number' });
    }
    if (name.trim().length > 60 || description.length > 240) {
      return res.status(400).json({ error: 'Category name or description is too long' });
    }
    const slug = makeSlug(name);
    if (!slug) {
      return res.status(400).json({ error: 'Category name must contain letters or numbers' });
    }

    uploadedImage = req.file ? await saveImage(req.file, categoryImageDirectory, 'category') : '';
    const category = await Category.create({
      name: name.trim(),
      slug,
      description: description.trim(),
      image: uploadedImage,
      sortOrder: Number(sortOrder)
    });
    res.status(201).json({ category });
  } catch (err) {
    if (uploadedImage) await cleanUpCategoryImage(uploadedImage);
    if (err.code === 11000) return res.status(409).json({ error: 'A category with this name already exists' });
    res.status(500).json({ error: err.message });
  }
};

exports.updateCategory = async (req, res) => {
  let uploadedImage;
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Category updates must be sent as an object' });
    }
    const updates = {};
    if (Object.hasOwn(req.body, 'name')) {
      if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
        return res.status(400).json({ error: 'Category name cannot be empty' });
      }
      updates.name = req.body.name.trim();
      updates.slug = makeSlug(req.body.name);
      if (updates.name.length > 60 || !updates.slug) {
        return res.status(400).json({ error: 'Provide a category name with letters or numbers (maximum 60 characters)' });
      }
    }
    if (Object.hasOwn(req.body, 'description')) {
      if (typeof req.body.description !== 'string') {
        return res.status(400).json({ error: 'Description must be text' });
      }
      updates.description = req.body.description.trim();
      if (updates.description.length > 240) {
        return res.status(400).json({ error: 'Category description must be 240 characters or fewer' });
      }
    }
    if (Object.hasOwn(req.body, 'isActive')) {
      if (!['true', 'false', true, false].includes(req.body.isActive)) {
        return res.status(400).json({ error: 'isActive must be true or false' });
      }
      updates.isActive = req.body.isActive === true || req.body.isActive === 'true';
    }
    if (Object.hasOwn(req.body, 'sortOrder')) {
      if (!Number.isInteger(Number(req.body.sortOrder))) {
        return res.status(400).json({ error: 'Sort order must be a whole number' });
      }
      updates.sortOrder = Number(req.body.sortOrder);
    }
    if (!Object.keys(updates).length && !req.file) {
      return res.status(400).json({ error: 'Provide at least one category field to update' });
    }

    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid category ID' });
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    if (req.file) {
      uploadedImage = await saveImage(req.file, categoryImageDirectory, 'category');
      updates.image = uploadedImage;
    }
    const previousImage = category.image;
    category.set(updates);
    await category.save();
    if (uploadedImage && previousImage && uploadedImage !== previousImage) {
      await cleanUpCategoryImage(previousImage);
    }
    res.json({ category });
  } catch (err) {
    if (uploadedImage) await cleanUpCategoryImage(uploadedImage);
    if (err.code === 11000) return res.status(409).json({ error: 'A category with this name already exists' });
    res.status(500).json({ error: err.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const [service, application, profile] = await Promise.all([
      Service.exists({ category: category._id }),
      ProviderApplication.exists({ workCategory: category._id }),
      ProviderProfile.exists({ workCategory: category._id })
    ]);
    if (service || application || profile) {
      return res.status(409).json({
        error: 'This category is in use. Deactivate it instead to preserve service and provider history.'
      });
    }

    await category.deleteOne();
    if (category.image) await cleanUpCategoryImage(category.image);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
