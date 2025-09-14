// src/Controllers/reviewController.js
const Review = require('../Models/reviewModel');
const Booking = require('../Models/bookingModel');
const ProviderProfile = require('../Models/providerModel');

// تحديث إحصائيات المزود (متوسط التقييم وعدد التقييمات)
const updateProviderStats = async (providerId) => {
  const stats = await Review.aggregate([
    { $match: { provider: providerId } },
    {
      $group: {
        _id: '$provider',
        averageRating: { $avg: '$rating' },
        reviewsCount: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    await ProviderProfile.findOneAndUpdate(
      { user: providerId },
      {
        averageRating: stats[0].averageRating,
        reviewsCount: stats[0].reviewsCount
      }
    );
  } else {
    await ProviderProfile.findOneAndUpdate(
      { user: providerId },
      { averageRating: 0, reviewsCount: 0 }
    );
  }
};

// العميل يكتب تقييم
exports.createReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;

    const booking = await Booking.findById(bookingId).populate('provider service');
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not your booking' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ error: 'You can only review completed bookings' });
    }

    const review = await Review.create({
      customer: req.user._id,
      provider: booking.provider,
      service: booking.service,
      booking: booking._id,
      rating,
      comment
    });

    // تحديث الإحصائيات
    await updateProviderStats(booking.provider);

    res.status(201).json(review);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// عرض تقييمات مزود خدمة
exports.getProviderReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ provider: req.params.id })
      .populate('customer service');
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
