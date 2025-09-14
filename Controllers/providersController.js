const ProviderProfile = require('../Models/providerModel');
const Service = require('../Models/serviceModel');
const Review = require('../Models/reviewModel');


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
    }).populate('user services');

    res.json(providers);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// عرض كل مقدمي الخدمة
exports.getAllProviders = async (req, res) => {
  try {
    const providers = await ProviderProfile.find().populate('user services');
    const providersWithReviews = await Promise.all(
      providers.map(async (provider) => {
        const reviews = await Review.find({ provider: provider.user._id })
          .populate('customer service', 'name email');

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

// عرض مقدم خدمة واحد
exports.getProvider = async (req, res) => {
  try {
    const provider = await ProviderProfile.findById(req.params.id).populate('user services');
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
     // هات الريفيوز الخاصة بالمزود
    const reviews = await Review.find({ provider: provider.user._id })
      .populate('customer service', 'name email'); // نجيب اسم العميل والخدمة فقط

    res.json({
      provider,
      reviews
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};