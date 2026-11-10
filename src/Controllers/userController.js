const User = require('../Models/userModel');
const path = require('path');
const fs = require('fs/promises');
const bcrypt = require('bcrypt');
const { timingSafeEqual } = require('crypto');
const mongoose = require('mongoose');
const { saveImage } = require('../utiles/imageUpload');
const AdminSetup = require('../Models/adminSetupModel');
const logger = require('../utiles/logger');
const Category = require('../Models/categoryModel');
const ProviderProfile = require('../Models/providerModel');

// عرض كل المستخدمين (admin فقط)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash'); // من غير الباسورد
    res.json({
        results: users.length,
        users});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// عرض مستخدم واحد
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const [user, providerProfile] = await Promise.all([
      User.findById(req.user._id).select('-passwordHash'),
      req.user.role === 'provider'
        ? ProviderProfile.findOne({ user: req.user._id }).populate('workCategory', 'name slug')
        : null
    ]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      user,
      workCategory: providerProfile?.workCategory || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateMyProfile = async (req, res) => {
  try {
    const updates = {};
    if (Object.hasOwn(req.body, 'name')) {
      if (typeof req.body.name !== 'string' || req.body.name.trim().length < 2 || req.body.name.trim().length > 80) {
        return res.status(400).json({ error: 'Name must be between 2 and 80 characters' });
      }
      updates.name = req.body.name.trim();
    }

    let profile;
    if (Object.hasOwn(req.body, 'workCategory')) {
      if (req.user.role !== 'provider') {
        return res.status(403).json({ error: 'Only providers can edit their work category' });
      }
      if (!mongoose.isValidObjectId(req.body.workCategory)) {
        return res.status(400).json({ error: 'Choose a valid work category' });
      }
      const category = await Category.findOne({ _id: req.body.workCategory, isActive: true });
      if (!category) return res.status(400).json({ error: 'Choose an active work category' });
      profile = await ProviderProfile.findOneAndUpdate(
        { user: req.user._id },
        { $set: { workCategory: category._id } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).populate('workCategory', 'name slug');
    }

    if (!Object.keys(updates).length && !profile) {
      return res.status(400).json({ error: 'Provide a name or work category to update' });
    }
    const user = Object.keys(updates).length
      ? await User.findByIdAndUpdate(req.user._id, { $set: updates }, {
        new: true,
        runValidators: true
      }).select('-passwordHash')
      : await User.findById(req.user._id).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user, workCategory: profile?.workCategory || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProvidersForAdmin = async (req, res) => {
  try {
    const [providers, profiles] = await Promise.all([
      User.find({ role: 'provider' })
        .select('name email photo isActive createdAt')
        .sort({ isActive: -1, name: 1 }),
      ProviderProfile.find().populate('workCategory', 'name slug')
    ]);
    const categories = new Map(profiles.map(profile => [
      String(profile.user),
      profile.workCategory
    ]));
    res.json({
      providers: providers.map(provider => ({
        ...provider.toObject(),
        workCategory: categories.get(String(provider._id)) || null
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.setProviderStatus = async (req, res) => {
  try {
    if (typeof req.body.isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be true or false' });
    }
    const provider = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'provider' },
      { $set: { isActive: req.body.isActive } },
      { new: true, runValidators: true }
    ).select('name email role isActive');
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    res.json({ provider });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// تعديل بيانات مستخدم
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// حذف مستخدم
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(204).send(); // تم الحذف بنجاح
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateMyPhoto = async (req, res) => {
  let filename;
  let photoUpdated = false;
  const photoDirectory = path.join(__dirname, '..', '..', 'public', 'img', 'users');

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Choose a profile photo to upload' });
    }

    filename = await saveImage(req.file, photoDirectory, 'profile');
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { photo: `/img/users/${filename}` },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      await fs.unlink(path.join(photoDirectory, filename));
      return res.status(404).json({ error: 'User not found' });
    }
    photoUpdated = true;

    if (req.user.photo?.startsWith('/img/users/profile-')) {
      const previousFilename = path.basename(req.user.photo);
      if (previousFilename !== filename) {
        await fs.unlink(path.join(photoDirectory, previousFilename)).catch(error => {
          if (error.code !== 'ENOENT') logger.error('Unable to remove previous profile photo', { error });
        });
      }
    }

    res.json({ user });
  } catch (err) {
    if (filename && !photoUpdated) {
      await fs.unlink(path.join(photoDirectory, filename)).catch(error => {
        if (error.code !== 'ENOENT') logger.error('Unable to remove uploaded profile photo', { error });
      });
    }
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      password.length < 8
    ) {
      return res.status(400).json({ error: 'Name, valid email, and a password of at least 8 characters are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'admin'
    });

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.getAdminSetupStatus = async (req, res) => {
  try {
    const [admin, setup] = await Promise.all([
      User.exists({ role: 'admin' }),
      AdminSetup.exists({ _id: 'initial-admin' })
    ]);
    res.json({ available: Boolean(process.env.ADMIN_SETUP_KEY) && !admin && !setup });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createInitialAdmin = async (req, res) => {
  const expectedKey = process.env.ADMIN_SETUP_KEY;
  const suppliedKey = typeof req.body.setupKey === 'string' ? req.body.setupKey : '';
  if (!expectedKey) {
    return res.status(404).json({ error: 'Initial administrator setup is disabled' });
  }
  const expectedBuffer = Buffer.from(expectedKey);
  const suppliedBuffer = Buffer.from(suppliedKey);
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return res.status(403).json({ error: 'Invalid setup key' });
  }

  const { name, email, password } = req.body;
  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !name.trim() ||
    password.length < 8
  ) {
    return res.status(400).json({ error: 'Name, valid email, and a password of at least 8 characters are required' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }

  const session = await mongoose.startSession();
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    let user;
    await session.withTransaction(async () => {
      if (await User.exists({ role: 'admin' }).session(session)) {
        const error = new Error('An administrator already exists');
        error.statusCode = 409;
        throw error;
      }
      const adminId = new mongoose.Types.ObjectId();
      await AdminSetup.create([{
        _id: 'initial-admin',
        user: adminId,
        completedAt: new Date()
      }], { session });
      [user] = await User.create([{
        _id: adminId,
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'admin'
      }], { session });
    });
    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Initial administrator setup is already complete or the email is registered' });
    }
    res.status(err.statusCode || 500).json({ error: err.message });
  } finally {
    await session.endSession();
  }
};
