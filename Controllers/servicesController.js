const Service = require('../Models/serviceModel');
const APIFeatures = require('../utiles/apiFeatures');


// عرض كل الخدمات
exports.getAllServices = async (req, res) => {
  try {
    const features = new APIFeatures(Service.find(), req.query)
      .filter()
      .search()      // تأكد أن search بعد filter حتى لا تلغي الفلاتر
      .sort()
      .limitFields()
      .paginate();

    const services = await features.query;

    res.json({
      results: services.length,
      services
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// عرض خدمة واحدة بالتفصيل
exports.getService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
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
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      req.body,
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


