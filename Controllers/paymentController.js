// src/controllers/paymentController.js
const Payment = require('../Models/paymentModel');
const Booking = require('../Models/bookingModel');
const Stripe = require('stripe');
const AppError = require('../utiles/appError');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🟢 Cash Payment
exports.createPayment = async (req, res, next) => {
  try {
    const { booking, amount, method } = req.body;

    // تحقق من وجود الحجز
    const existingBooking = await Booking.findById(booking);
    if (!existingBooking) {
      return next(new AppError('Booking not found', 404));
    }

    // أنشئ الدفع
    const payment = await Payment.create({
      booking,
      amount,
      method,
      status: method === 'cash' ? 'paid' : 'pending',
    });

    // لو الدفع كاش، حدّث حالة الحجز
    if (method === 'cash') {
      existingBooking.status = 'confirmed';
      await existingBooking.save();
    }

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
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      return next(new AppError('Booking not found', 404));
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: `${req.protocol}://${req.get('host')}/success.html`,
      cancel_url: `${req.protocol}://${req.get('host')}/cancel.html`,
      customer_email: req.user.email,
      client_reference_id: booking.id,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: booking.price * 100, // السعر بالسنت
            product_data: {
              name: `Service Booking: ${booking.serviceName}`,
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

    // حدث حالة الحجز
    const booking = await Booking.findById(bookingId);
    if (booking) {
      booking.status = 'confirmed';
      await booking.save();
    }
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

