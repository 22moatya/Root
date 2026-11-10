const Booking = require('../Models/bookingModel');
const ProviderProfile = require('../Models/providerModel');
const Service = require('../Models/serviceModel');
const User = require('../Models/userModel');
const Review = require('../Models/reviewModel');
const mongoose = require('mongoose');
const { sendEmail } = require('../utiles/email');
const logger = require('../utiles/logger');
const egyptGovernorates = require('../utiles/egyptGovernorates');
const { calculateBookingCommission } = require('../utiles/bookingCommission');

const withoutCommissionDetails = booking => {
  const result = booking.toObject();
  delete result.commissionRate;
  delete result.commissionAmount;
  delete result.providerNetAmount;
  return result;
};

const withCommissionDetails = booking => {
  const result = booking.toObject();
  if (!['in_progress', 'confirmed', 'completed'].includes(result.status) || !Number.isFinite(result.proposedPrice)) {
    return result;
  }
  const details = Number.isFinite(result.commissionRate) && Number.isFinite(result.commissionAmount)
    ? {
        grossPrice: result.proposedPrice,
        commissionRate: result.commissionRate,
        commissionAmount: result.commissionAmount,
        providerNetAmount: Math.round((result.proposedPrice - result.commissionAmount) * 100) / 100
      }
    : calculateBookingCommission(result.proposedPrice);
  return { ...result, ...details };
};

const sendNotification = async options => {
  try {
    await sendEmail(options);
    return true;
  } catch (error) {
    logger.error('Booking notification failed', { error: error.message });
    return false;
  }
};

exports.createBooking = async (req, res) => {
  try {
    const { provider, service, date, governorate, requestDetails, address, contactPhone } = req.body;
    const normalizedDetails = typeof requestDetails === 'string' ? requestDetails.trim() : '';
    const normalizedAddress = typeof address === 'string' ? address.trim() : '';
    const normalizedPhone = typeof contactPhone === 'string' ? contactPhone.trim() : '';
    const phoneDigits = normalizedPhone.replace(/\D/g, '');
    const bookingDate = new Date(date);

    if (
      !mongoose.isValidObjectId(provider) ||
      !mongoose.isValidObjectId(service) ||
      !egyptGovernorates.includes(governorate) ||
      !Number.isFinite(bookingDate.getTime()) ||
      bookingDate <= new Date() ||
      normalizedDetails.length < 3 ||
      normalizedDetails.length > 2000 ||
      normalizedAddress.length < 5 ||
      normalizedAddress.length > 300 ||
      !/^\+?[0-9\s()-]{8,20}$/.test(normalizedPhone) ||
      phoneDigits.length < 8 ||
      phoneDigits.length > 15
    ) {
      return res.status(400).json({ error: 'Provide a valid service, future date, request description, address, and phone number.' });
    }

    const [providerProfile, activeProvider] = await Promise.all([
      ProviderProfile.exists({ user: provider, services: service, governorate }),
      User.exists({ _id: provider, role: 'provider', isActive: { $ne: false } })
    ]);
    if (!providerProfile || !activeProvider) {
      return res.status(400).json({ error: 'Provider does not offer this service' });
    }

    let booking = await Booking.create({
      customer: req.user._id,
      provider,
      service,
      governorate,
      date: bookingDate,
      requestDetails: normalizedDetails,
      address: normalizedAddress,
      contactPhone: normalizedPhone
    });
    booking = await booking.populate([
      { path: 'customer', select: 'email name' },
      { path: 'provider', select: 'email name' },
      { path: 'service', select: 'name' }
    ]);

    const notificationResults = [];
    if (booking.provider?.email) {
      notificationResults.push(await sendNotification({
        email: booking.provider.email,
        subject: 'New service request',
        message: `${booking.customer.name || 'A customer'} requested ${booking.service.name} on ${booking.date}. Review the request and send a price quote.`
      }));
    }
    if (booking.customer?.email) {
      notificationResults.push(await sendNotification({
        email: booking.customer.email,
        subject: 'Your service request was sent',
        message: `Your request for ${booking.service.name} was sent to ${booking.provider.name || 'your provider'} for a price quote.`
      }));
    }

    res.status(201).json({
      booking: withoutCommissionDetails(booking),
      notificationWarning: notificationResults.includes(false)
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ customer: req.user._id })
      .populate('provider', 'name photo')
      .populate('service', 'name');
    const reviews = await Review.find({
      customer: req.user._id,
      booking: { $in: bookings.map(booking => booking._id) }
    }).select('booking');
    const reviewedBookings = new Set(reviews.map(review => String(review.booking)));
    res.json(bookings.map(booking => ({
      ...withoutCommissionDetails(booking),
      hasReview: reviewedBookings.has(String(booking._id))
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const status = req.query.status;
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const allowedStatuses = ['pending', 'quote_proposed', 'in_progress', 'confirmed', 'cancelled', 'completed'];
    if (status && status !== 'all' && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid booking status filter' });
    }

    const filters = [];
    if (status && status !== 'all') filters.push({ status });
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const expression = new RegExp(escapedSearch, 'i');
      const [users, services] = await Promise.all([
        User.find({ $or: [{ name: expression }, { email: expression }] }).select('_id'),
        Service.find({ name: expression }).select('_id')
      ]);
      filters.push({
        $or: [
          { customer: { $in: users.map(user => user._id) } },
          { provider: { $in: users.map(user => user._id) } },
          { service: { $in: services.map(service => service._id) } },
          { contactPhone: expression },
          { address: expression },
          { requestDetails: expression }
        ]
      });
    }
    const filter = filters.length > 1 ? { $and: filters } : filters[0] || {};
    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .select('+commissionRate +commissionAmount')
        .populate('customer', 'name email')
        .populate('provider', 'name email')
        .populate('service', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Booking.countDocuments(filter)
    ]);

    res.json({
      bookings: bookings.map(withCommissionDetails),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProviderBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ provider: req.user._id })
      .select('+commissionRate +commissionAmount')
      .populate('customer', 'name')
      .populate('service', 'name');
    res.json(bookings.map(withCommissionDetails));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.proposePrice = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }
    const price = req.body.price;
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 10000000) {
      return res.status(400).json({ error: 'Enter a valid price greater than zero.' });
    }
    const normalizedPrice = Math.round(price * 100) / 100;
    if (normalizedPrice <= 0) {
      return res.status(400).json({ error: 'Enter a valid price greater than zero.' });
    }

    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, provider: req.user._id, status: { $in: ['pending', 'quote_proposed'] } },
      { $set: { proposedPrice: normalizedPrice, status: 'quote_proposed' } },
      { new: true, runValidators: true }
    ).populate([
      { path: 'customer', select: 'email name' },
      { path: 'provider', select: 'name' },
      { path: 'service', select: 'name' }
    ]);

    if (!booking) return res.status(409).json({ error: 'This request cannot receive a price quote anymore.' });
    const notificationSent = booking.customer?.email && await sendNotification({
        email: booking.customer.email,
        subject: 'Your provider sent a price quote',
        message: `${booking.provider?.name || 'Your provider'} quoted EGP ${normalizedPrice.toFixed(2)} for ${booking.service.name}. Review and accept the quote in your bookings.`
      });
    res.json({ booking, notificationWarning: Boolean(booking.customer?.email && !notificationSent) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.acceptPrice = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }
    const quotedBooking = await Booking.findOne({
      _id: req.params.id,
      customer: req.user._id,
      status: 'quote_proposed',
      proposedPrice: { $gt: 0 }
    }).select('proposedPrice');
    if (!quotedBooking) return res.status(409).json({ error: 'This price quote is no longer available.' });

    const commission = calculateBookingCommission(quotedBooking.proposedPrice);
    const booking = await Booking.findOneAndUpdate(
      {
        _id: req.params.id,
        customer: req.user._id,
        status: 'quote_proposed',
        proposedPrice: quotedBooking.proposedPrice
      },
      {
        $set: {
          status: 'in_progress',
          commissionRate: commission.commissionRate,
          commissionAmount: commission.commissionAmount,
          commissionAccruedAt: new Date()
        }
      },
      { new: true, runValidators: true }
    ).populate([
      { path: 'provider', select: 'email name' },
      { path: 'service', select: 'name' }
    ]);

    if (!booking) return res.status(409).json({ error: 'This price quote is no longer available.' });
    const notificationSent = booking.provider?.email && await sendNotification({
        email: booking.provider.email,
        subject: 'The customer accepted your price quote',
        message: `The customer accepted your ${booking.service.name} quote. The request is now in progress.`
      });
    res.json({
      booking: withoutCommissionDetails(booking),
      notificationWarning: Boolean(booking.provider?.email && !notificationSent)
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }
    const booking = await Booking.findOne({ _id: req.params.id, provider: req.user._id });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const { status } = req.body;
    const canCancel = status === 'cancelled' && ['pending', 'quote_proposed'].includes(booking.status);
    const canComplete = status === 'completed' && ['in_progress', 'confirmed'].includes(booking.status);
    if (!canCancel && !canComplete) {
      return res.status(400).json({ error: 'Invalid booking status transition' });
    }

    const updatedBooking = await Booking.findOneAndUpdate(
      { _id: booking._id, provider: req.user._id, status: booking.status },
      { $set: { status } },
      { new: true, runValidators: true }
    ).select('+commissionRate +commissionAmount');
    if (!updatedBooking) {
      return res.status(409).json({ error: 'Booking was updated by another action. Refresh and try again.' });
    }

    const populatedBooking = await updatedBooking.populate([
      { path: 'customer', select: 'email name' },
      { path: 'service', select: 'name' }
    ]);
    const notificationSent = populatedBooking.customer?.email && await sendNotification({
        email: populatedBooking.customer.email,
        subject: 'Your service request was updated',
        message: `Your request for ${populatedBooking.service.name} is now ${populatedBooking.status}.`
      });
    res.json({ booking: populatedBooking, notificationWarning: Boolean(populatedBooking.customer?.email && !notificationSent) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }
    const booking = await Booking.findOne({
      _id: req.params.id,
      customer: req.user._id
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (!['pending', 'quote_proposed'].includes(booking.status)) {
      return res.status(400).json({ error: 'This booking can no longer be cancelled' });
    }

    const updatedBooking = await Booking.findOneAndUpdate(
      { _id: booking._id, customer: req.user._id, status: booking.status },
      { $set: { status: 'cancelled' } },
      { new: true, runValidators: true }
    );
    if (!updatedBooking) {
      return res.status(409).json({ error: 'Booking was updated by another action. Refresh and try again.' });
    }
    res.json(withoutCommissionDetails(updatedBooking));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
