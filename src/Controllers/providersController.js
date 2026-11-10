const ProviderProfile = require('../Models/providerModel');
const Service = require('../Models/serviceModel');
const Review = require('../Models/reviewModel');
const ProviderApplication = require('../Models/providerApplicationModel');
const Category = require('../Models/categoryModel');
const User = require('../Models/userModel');
const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const {
  decryptNationalId,
  encryptNationalId,
  hashNationalId
} = require('../utiles/providerApplicationSecurity');
const { saveImage, saveProviderDocument } = require('../utiles/imageUpload');
const logger = require('../utiles/logger');
const egyptGovernorates = require('../utiles/egyptGovernorates');
const { ensureCategoryServices } = require('../utiles/providerServiceSync');

exports.getGovernorates = (req, res) => {
  res.json({ governorates: egyptGovernorates });
};


// إنشاء أو تحديث ملف مقدم الخدمة
exports.createOrUpdateProfile = async (req, res) => {
  try {
    const { services, address, lng, lat, workHours } = req.body;
    const userId = req.user.id;

    const existingProfile = await ProviderProfile.findOne({ user: userId });
    if (existingProfile) {
      // تحديث
      existingProfile.services = services;
      existingProfile.address = address;
      existingProfile.location = { type: 'Point', coordinates: [lng, lat] };
      existingProfile.workHours = workHours;
      await existingProfile.save();
      return res.json(existingProfile);
    }

    // إنشاء جديد
    const profile = await ProviderProfile.create({
      user: userId,
      services,
      address,
      location: { type: 'Point', coordinates: [lng, lat] },
      workHours
    });
    res.status(201).json(profile);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};


// GET /api/providers/near?lng=30.1&lat=26.2&km=5
// البحث عن مقدمي الخدمة بالقرب من المستخدم
exports.getNearbyProviders = async (req, res) => {
  try {
    const { lng, lat, km = 5 } = req.query;
    const meters = Number(km) * 1000;

    const providers = await ProviderProfile.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
          $maxDistance: meters
        }
      }
    })
      .populate({ path: 'user', match: { isActive: { $ne: false } }, select: 'name photo role' })
      .populate({ path: 'services', select: 'name' })
      .populate({ path: 'workCategory', select: 'name slug' });

    res.json(providers.filter(provider => provider.user));

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// عرض كل مقدمي الخدمة
exports.getAllProviders = async (req, res) => {
  try {
    const providers = await ProviderProfile.find()
      .populate({ path: 'user', match: { isActive: { $ne: false } }, select: 'name photo role' })
      .populate({ path: 'services', select: 'name' })
      .populate({ path: 'workCategory', select: 'name slug' });
    const activeProviders = providers.filter(provider => provider.user);
    const providersWithReviews = await Promise.all(
      activeProviders.map(async (provider) => {
        const reviews = await Review.find({ provider: provider.user._id })
          .populate('customer', 'name')
          .populate('service', 'name');

        return {
          provider,
          reviews
        };
      })
    );

    res.json(providersWithReviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProvidersByService = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.serviceId)) {
      return res.status(400).json({ error: 'Invalid service ID' });
    }
    const filter = { services: req.params.serviceId };
    if (typeof req.query.governorate === 'string' && req.query.governorate) {
      if (!egyptGovernorates.includes(req.query.governorate)) {
        return res.status(400).json({ error: 'Choose a valid Egyptian governorate' });
      }
      filter.governorate = req.query.governorate;
    }
    const providers = await ProviderProfile.find(filter)
      .populate({ path: 'user', match: { role: 'provider', isActive: { $ne: false } }, select: 'name photo' })
      .populate({ path: 'services', select: 'name' })
      .populate({ path: 'workCategory', select: 'name slug' });

    res.json(providers.filter(provider => provider.user).map(provider => ({
      _id: provider._id,
      user: provider.user,
      services: provider.services,
      workCategory: provider.workCategory,
      governorate: provider.governorate,
      area: provider.area,
      bio: provider.bio || '',
      averageRating: provider.averageRating,
      reviewsCount: provider.reviewsCount
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// عرض مقدم خدمة واحد
exports.getProvider = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid provider ID' });
    }
    const provider = await ProviderProfile.findById(req.params.id)
      .populate({ path: 'user', match: { role: 'provider', isActive: { $ne: false } }, select: 'name photo role' })
      .populate({ path: 'services', select: 'name' })
      .populate({ path: 'workCategory', select: 'name slug' });
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    if (!provider.user) return res.status(404).json({ error: 'Provider not found' });
     // هات الريفيوز الخاصة بالمزود
    const reviews = await Review.find({ provider: provider.user._id })
      .select('rating comment createdAt')
      .sort({ createdAt: -1 })
      .populate('customer', 'name')
      .populate('service', 'name');

    res.json({
      provider: {
        _id: provider._id,
        user: provider.user,
        services: provider.services,
        workCategory: provider.workCategory,
        governorate: provider.governorate,
        area: provider.area,
        averageRating: provider.averageRating,
        reviewsCount: provider.reviewsCount
      },
      reviews
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.submitApplication = async (req, res) => {
  const uploadedFilenames = [];
  let applicationSaved = false;
  const documentDirectory = path.join(__dirname, '..', '..', 'private', 'provider-documents');

  try {
    if (!req.user.photo) {
      return res.status(400).json({ error: 'Add a profile photo to your account before applying to become a provider' });
    }
    const idCardFile = req.files?.idCard?.[0];
    const criminalRecordFile = req.files?.criminalRecord?.[0];
    const nationalId = typeof req.body.nationalId === 'string' ? req.body.nationalId.trim() : '';
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const governorate = typeof req.body.governorate === 'string' ? req.body.governorate.trim() : '';
    const area = typeof req.body.area === 'string' ? req.body.area.trim() : '';
    const bio = typeof req.body.bio === 'string' ? req.body.bio.trim() : '';
    if (!egyptGovernorates.includes(governorate)) {
      return res.status(400).json({ error: 'Choose a valid Egyptian governorate' });
    }
    if (!area || area.length > 100) {
      return res.status(400).json({ error: 'Enter your center or area (up to 100 characters)' });
    }
    if (bio.length > 600) {
      return res.status(400).json({ error: 'Your bio must be 600 characters or fewer' });
    }
    const workCategoryId = req.body.workCategory;
    if (!mongoose.isValidObjectId(workCategoryId)) {
      return res.status(400).json({ error: 'Choose your work category' });
    }
    const workCategory = await Category.findOne({ _id: workCategoryId, isActive: true });
    if (!workCategory) {
      return res.status(400).json({ error: 'Choose an active work category' });
    }
    if (!/^\d{14}$/.test(nationalId)) {
      return res.status(400).json({ error: 'National ID must contain exactly 14 digits' });
    }
    if (!/^\+?\d{10,15}$/.test(phone)) {
      return res.status(400).json({ error: 'Enter a valid phone number' });
    }
    if (!idCardFile) {
      return res.status(400).json({ error: 'Upload a photo of your ID card' });
    }
    if (!criminalRecordFile) {
      return res.status(400).json({ error: 'Upload your criminal record certificate' });
    }

    const existing = await ProviderApplication.findOne({ user: req.user._id })
      .select('+idCardFilename +criminalRecordFilename');
    if (existing?.status === 'approved') {
      return res.status(409).json({ error: 'Your provider application has already been approved' });
    }
    if (existing?.status === 'pending') {
      return res.status(409).json({ error: 'Your provider application is still under review' });
    }

    const nationalIdHash = hashNationalId(nationalId);
    const duplicate = await ProviderApplication.findOne({
      nationalIdHash,
      user: { $ne: req.user._id }
    }).select('_id');
    if (duplicate) {
      return res.status(409).json({ error: 'This national ID is already associated with an application' });
    }

    const idCardFilename = await saveImage(idCardFile, documentDirectory, 'id-card');
    uploadedFilenames.push(idCardFilename);
    const criminalRecordFilename = await saveProviderDocument(
      criminalRecordFile,
      documentDirectory,
      'criminal-record'
    );
    uploadedFilenames.push(criminalRecordFilename);
    const applicationData = {
      user: req.user._id,
      workCategory: workCategory._id,
      governorate,
      area,
      nationalIdEncrypted: encryptNationalId(nationalId),
      nationalIdHash,
      phone,
      bio,
      idCardFilename,
      idCardMimeType: idCardFile.mimetype,
      criminalRecordFilename,
      criminalRecordMimeType: criminalRecordFile.mimetype,
      status: 'pending',
      reviewedBy: undefined,
      reviewedAt: undefined,
      rejectionReason: undefined
    };

    if (existing) {
      const oldFilenames = [existing.idCardFilename, existing.criminalRecordFilename].filter(Boolean);
      existing.set(applicationData);
      await existing.save();
      applicationSaved = true;
      for (const oldFilename of oldFilenames) {
        await fs.unlink(path.join(documentDirectory, path.basename(oldFilename))).catch(error => {
          if (error.code !== 'ENOENT') logger.error('Unable to remove previous provider application document', { error });
        });
      }
    } else {
      await ProviderApplication.create(applicationData);
      applicationSaved = true;
    }
    res.status(201).json({ status: 'pending', message: 'Your application was submitted for review' });
  } catch (err) {
    if (!applicationSaved) {
      for (const filename of uploadedFilenames) {
        await fs.unlink(path.join(documentDirectory, filename)).catch(error => {
          if (error.code !== 'ENOENT') logger.error('Unable to remove unreferenced provider application document', { error });
        });
      }
    }
    if (err.code === 11000) {
      return res.status(409).json({ error: 'This national ID or account already has an application' });
    }
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

exports.getMyApplication = async (req, res) => {
  try {
    const application = await ProviderApplication.findOne({ user: req.user._id })
      .select('status phone workCategory rejectionReason createdAt updatedAt')
      .populate({ path: 'workCategory', select: 'name slug' });
    res.json({ application });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getApplications = async (req, res) => {
  try {
    const applications = await ProviderApplication.find()
      .select('+nationalIdEncrypted +idCardFilename +idCardMimeType +criminalRecordFilename +criminalRecordMimeType')
      .populate({ path: 'user', select: 'name email photo role' })
      .populate({ path: 'workCategory', select: 'name slug' })
      .sort({ createdAt: -1 });

    res.json({
      applications: applications.map(application => ({
        _id: application._id,
        user: application.user,
        nationalId: decryptNationalId(application.nationalIdEncrypted),
        hasCriminalRecord: Boolean(application.criminalRecordFilename),
        phone: application.phone,
        bio: application.bio || '',
        workCategory: application.workCategory,
        governorate: application.governorate,
        area: application.area,
        status: application.status,
        rejectionReason: application.rejectionReason,
        createdAt: application.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getApplicationCriminalRecord = async (req, res) => {
  try {
    const application = await ProviderApplication.findById(req.params.id)
      .select('+criminalRecordFilename +criminalRecordMimeType');
    if (!application?.criminalRecordFilename) {
      return res.status(404).json({ error: 'Criminal record document not found' });
    }
    const filename = path.basename(application.criminalRecordFilename);
    const documentPath = path.join(__dirname, '..', '..', 'private', 'provider-documents', filename);
    res.set({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': application.criminalRecordMimeType,
      'Content-Disposition': `attachment; filename="${filename}"`
    });
    res.sendFile(documentPath, error => {
      if (error && !res.headersSent) res.status(error.statusCode || 404).json({ error: 'Criminal record document not found' });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getApplicationIdCard = async (req, res) => {
  try {
    const application = await ProviderApplication.findById(req.params.id)
      .select('+idCardFilename +idCardMimeType');
    if (!application) return res.status(404).json({ error: 'Application not found' });

    const documentPath = path.join(__dirname, '..', '..', 'private', 'provider-documents', application.idCardFilename);
    res.set({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': application.idCardMimeType,
      'Content-Disposition': 'inline'
    });
    res.sendFile(documentPath, error => {
      if (error && !res.headersSent) res.status(error.statusCode || 404).json({ error: 'ID card image not found' });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.reviewApplication = async (req, res) => {
  const { action, rejectionReason = '' } = req.body;
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action must be approve or reject' });
  }
  if (action === 'reject' && typeof rejectionReason !== 'string') {
    return res.status(400).json({ error: 'Rejection reason must be text' });
  }

  const session = await mongoose.startSession();
  try {
    let updatedApplication;
    await session.withTransaction(async () => {
      const application = await ProviderApplication.findOne({
        _id: req.params.id,
        status: 'pending'
      }).session(session);
      if (!application) {
        const error = new Error('Pending application not found');
        error.statusCode = 404;
        throw error;
      }

      if (action === 'approve') {
        const categoryServices = await ensureCategoryServices(application.workCategory, session);
        const user = await User.findOneAndUpdate(
          { _id: application.user, role: 'customer' },
          { $set: { role: 'provider' } },
          { new: true, session }
        );
        if (!user) {
          const error = new Error('Applicant is no longer an eligible customer');
          error.statusCode = 409;
          throw error;
        }
        await ProviderProfile.findOneAndUpdate(
          { user: application.user },
          {
            $set: {
              workCategory: application.workCategory,
              governorate: application.governorate,
              area: application.area,
              bio: application.bio || ''
            },
            $addToSet: { services: { $each: categoryServices.map(service => service._id) } }
          },
          { new: true, upsert: true, setDefaultsOnInsert: true, session }
        );
      }

      application.status = action === 'approve' ? 'approved' : 'rejected';
      application.reviewedBy = req.user._id;
      application.reviewedAt = new Date();
      application.rejectionReason = action === 'reject' ? rejectionReason.trim().slice(0, 500) : undefined;
      updatedApplication = await application.save({ session });
    });

    res.json({
      application: {
        _id: updatedApplication._id,
        status: updatedApplication.status,
        reviewedAt: updatedApplication.reviewedAt
      }
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  } finally {
    await session.endSession();
  }
};