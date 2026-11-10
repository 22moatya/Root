// src/Controllers/reviewController.js
const Review = require('../Models/reviewModel');
const Booking = require('../Models/bookingModel');
const ProviderProfile = require('../Models/providerModel');
const mongoose = require('mongoose');

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
    const normalizedComment = typeof comment === 'string' ? comment.trim() : '';
    if (
      !mongoose.isValidObjectId(bookingId) ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      (comment !== undefined && typeof comment !== 'string') ||
      normalizedComment.length > 1000
    ) {
      return res.status(400).json({ error: 'Choose a rating from 1 to 5 and a comment of up to 1000 characters.' });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      customer: req.user._id,
      status: 'completed'
    }).populate('provider service');
    if (!booking) return res.status(404).json({ error: 'Completed booking not found for this customer.' });

    let review;
    try {
      review = await Review.create({
        customer: req.user._id,
        provider: booking.provider,
        service: booking.service,
        booking: booking._id,
        rating,
        comment: normalizedComment
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ error: 'You have already reviewed this completed booking.' });
      }
      throw error;
    }

    // تحديث الإحصائيات
    await updateProviderStats(booking.provider);

    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// عرض تقييمات مزود خدمة
exports.getProviderReviews = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid provider ID.' });
    }
    const reviews = await Review.find({ provider: req.params.id })
      .sort({ createdAt: -1 })
      .populate('customer', 'name')
      .populate('service', 'name');
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
