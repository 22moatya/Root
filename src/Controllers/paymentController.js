// src/controllers/paymentController.js
const Payment = require('../Models/paymentModel');
const Booking = require('../Models/bookingModel');
const Stripe = require('stripe');
const AppError = require('../utiles/appError');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🟢 Cash Payment
exports.createPayment = async (req, res, next) => {
  try {
    const { booking, method } = req.body;

    // تحقق من وجود الحجز
    const existingBooking = await Booking.findById(booking).populate('service');
    if (!existingBooking) {
      return next(new AppError('Booking not found', 404));
    }

    if (
      req.user.role !== 'admin' &&
      existingBooking.customer.toString() !== req.user._id.toString()
    ) {
      return next(new AppError('Forbidden', 403));
    }

    if (!['in_progress', 'confirmed'].includes(existingBooking.status)) {
      return next(new AppError('Accept the provider price quote before paying', 400));
    }

    const amount = Number.isFinite(existingBooking.proposedPrice)
      ? existingBooking.proposedPrice
      : existingBooking.service?.basePrice;
    if (!Number.isFinite(amount) || amount < 0) {
      return next(new AppError('Booking service has no valid price', 400));
    }

    // أنشئ الدفع
    const payment = await Payment.create({
      booking,
      amount,
      method,
      status: method === 'cash' ? 'paid' : 'pending',
    });

    res.status(201).json({
      message:
        method === 'cash'
          ? 'Cash payment successful'
          : 'Payment created, awaiting confirmation',
      payment,
    });
  } catch (err) {
    next(err);
  }
};

// 🟢 Stripe Checkout Session
exports.getCheckoutSession = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId).populate('service');
    if (!booking) {
      return next(new AppError('Booking not found', 404));
    }

    if (
      req.user.role !== 'admin' &&
      booking.customer.toString() !== req.user._id.toString()
    ) {
      return next(new AppError('Forbidden', 403));
    }

    if (!['in_progress', 'confirmed'].includes(booking.status)) {
      return next(new AppError('Accept the provider price quote before paying', 400));
    }

    if (!booking.service) {
      return next(new AppError('Booking service was not found', 404));
    }

    const price = Number.isFinite(booking.proposedPrice)
      ? booking.proposedPrice
      : booking.service.basePrice;
    if (!Number.isFinite(price) || price < 0) {
      return next(new AppError('Booking service has no valid price', 400));
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: `${req.protocol}://${req.get('host')}/#bookings`,
      cancel_url: `${req.protocol}://${req.get('host')}/#bookings`,
      customer_email: req.user.email,
      client_reference_id: booking.id,
      line_items: [
        {
          price_data: {
            currency: 'egp',
            unit_amount: Math.round(price * 100), // EGP minor units (piastres)
            product_data: {
            name: `Service Booking: ${booking.service.name}`,
            },
          },
          quantity: 1,
        },
      ],
    });

    res.status(200).json({
      status: 'success',
      session,
    });
  } catch (err) {
    next(err);
  }
};

// 🟢 Stripe Webhook (بعد الدفع الناجح)
exports.webhookCheckout = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // إنشئ الدفع في DB
    const bookingId = session.client_reference_id;
    const amount = session.amount_total / 100;

    const payment = await Payment.create({
      booking: bookingId,
      amount,
      method: 'card',
      status: 'paid',
    });

  }

  res.status(200).json({ received: true });
};

// عرض كل الدفعات
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate({
        path: 'booking',
        populate: [
          { path: 'customer', select: 'name email' },
          { path: 'provider', select: 'name email' },
          { path: 'service', select: 'name' }
        ]
      });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// عرض دفعة واحدة
// عرض دفعة واحدة مع تحقق من المالك
exports.getPaymentSafe = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate({
        path: 'booking',
        populate: [
          { path: 'customer', select: 'name email' },
          { path: 'provider', select: 'name email' },
          { path: 'service', select: 'name' }
        ]
      });

    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    // تحقق من الصلاحيات
    if (
      req.user.role === 'customer' &&
      payment.booking.customer._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (
      req.user.role === 'provider' &&
      payment.booking.provider._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // الادمن يقدر يشوف الكل
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
