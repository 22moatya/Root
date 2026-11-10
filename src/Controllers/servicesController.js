const Service = require('../Models/serviceModel');
const Category = require('../Models/categoryModel');
const ProviderProfile = require('../Models/providerModel');
const mongoose = require('mongoose');
const APIFeatures = require('../utiles/apiFeatures');


// عرض كل الخدمات
exports.getAllServices = async (req, res) => {
  try {
    const features = new APIFeatures(Service.find().populate('category', 'name slug image'), req.query)
      .filter()
      .search()      // تأكد أن search بعد filter حتى لا تلغي الفلاتر
      .sort()
      .limitFields()
      .paginate();

    const services = await features.query;
    const serviceIds = services.map(service => service._id);
    const providerCounts = serviceIds.length
      ? await ProviderProfile.aggregate([
        { $match: { services: { $in: serviceIds } } },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'providerUser'
          }
        },
        { $match: { 'providerUser.role': 'provider', 'providerUser.isActive': { $ne: false } } },
        { $unwind: '$services' },
        { $match: { services: { $in: serviceIds } } },
        { $group: { _id: '$services', count: { $sum: 1 } } }
      ])
      : [];
    const providerCountByService = new Map(
      providerCounts.map(({ _id, count }) => [String(_id), count])
    );
    const servicesWithProviderCounts = services.map(service => ({
      ...service.toObject(),
      providersCount: providerCountByService.get(String(service._id)) || 0
    }));

    res.json({
      results: servicesWithProviderCounts.length,
      services: servicesWithProviderCounts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// عرض خدمة واحدة بالتفصيل
exports.getService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id).populate('category', 'name slug image');
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// فقط الـ admin يمكنه إضافة خدمة جديدة
exports.createServices = async (req, res) => {
  try {
    const serviceData = { ...req.body };

    if (serviceData.category) {
      if (!mongoose.isValidObjectId(serviceData.category)) {
        return res.status(400).json({ error: 'Select a valid service category' });
      }
      const category = await Category.findOne({ _id: serviceData.category, isActive: true });
      if (!category) return res.status(400).json({ error: 'Select an active service category' });
    } else {
      serviceData.category = null;
    }

    // ✅ Multer بيضيف req.file لو رفعت صورة
    if (req.file) {
      serviceData.image = req.file.filename; 
      // كده هيخزن اسم الصورة في قاعدة البيانات
    }

    const service = await Service.create(serviceData);

    res.status(201).json({
      status: 'success',
      data: service
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// تعديل خدمة
exports.updateService = async (req, res) => {
   try {
    const updates = { ...req.body };
    if (Object.hasOwn(updates, 'category')) {
      if (updates.category === '') updates.category = null;
      if (updates.category) {
        if (!mongoose.isValidObjectId(updates.category)) {
          return res.status(400).json({ error: 'Select a valid service category' });
        }
        const category = await Category.findById(updates.category);
        if (!category) return res.status(400).json({ error: 'Select a valid service category' });
        if (!category.isActive) {
          const currentService = await Service.findById(req.params.id).select('category');
          if (!currentService || String(currentService.category) !== String(category._id)) {
            return res.status(400).json({ error: 'Select an active service category' });
          }
        }
      }
    }

    const service = await Service.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// حذف خدمة
exports.deleteService = async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.status(204).send(); // 204 يعني الحذف تم بنجاح بدون محتوى
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
