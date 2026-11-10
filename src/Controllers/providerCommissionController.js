const Booking = require('../Models/bookingModel');
const ProviderCommissionPayment = require('../Models/providerCommissionPaymentModel');
const User = require('../Models/userModel');
const mongoose = require('mongoose');

const COMMISSION_PERIOD_TIME_ZONE = 'Africa/Cairo';
const payableBookingStatuses = ['in_progress', 'confirmed', 'completed'];

const getCairoDate = date => new Intl.DateTimeFormat('en-CA', {
  timeZone: COMMISSION_PERIOD_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(date);

const getDailyCommissionTotals = async providerId => Booking.aggregate([
  {
    $match: {
      ...(providerId ? { provider: new mongoose.Types.ObjectId(providerId) } : {}),
      status: { $in: payableBookingStatuses },
      commissionAmount: { $gt: 0 }
    }
  },
  {
    $group: {
      _id: {
        provider: '$provider',
        period: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: { $ifNull: ['$commissionAccruedAt', '$updatedAt'] },
            timezone: COMMISSION_PERIOD_TIME_ZONE
          }
        }
      },
      amount: { $sum: '$commissionAmount' },
      commissionRate: { $avg: { $ifNull: ['$commissionRate', 0.15] } },
      ordersCount: { $sum: 1 }
    }
  },
  { $sort: { '_id.period': -1 } }
]);

const normalizePaymentAttempts = payment => {
  const attempts = (payment.payments || []).map(attempt => ({
    _id: attempt._id,
    provider: payment.provider,
    period: payment.period,
    amount: attempt.amount,
    paymentMethod: attempt.paymentMethod,
    paymentReference: attempt.paymentReference,
    status: attempt.status,
    confirmedBy: attempt.confirmedBy,
    paidAt: attempt.paidAt,
    createdAt: attempt.createdAt
  }));
  if (payment.amount && payment.status) {
    attempts.unshift({
      _id: payment._id,
      provider: payment.provider,
      period: payment.period,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paymentReference: payment.paymentReference,
      status: payment.status,
      confirmedBy: payment.confirmedBy,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      legacy: true
    });
  }
  return attempts;
};

const withPaymentStatus = (totals, paymentDocuments, currentPeriod) => {
  const attemptsByKey = new Map();
  for (const paymentDocument of paymentDocuments) {
    const key = `${paymentDocument.provider?._id || paymentDocument.provider}:${paymentDocument.period}`;
    attemptsByKey.set(key, normalizePaymentAttempts(paymentDocument));
  }

  return totals.filter(total => total.amount > 0).map(total => {
    const providerId = String(total._id.provider);
    const paymentAttempts = attemptsByKey.get(`${providerId}:${total._id.period}`) || [];
    const paidAmount = paymentAttempts
      .filter(payment => payment.status === 'paid')
      .reduce((sum, payment) => sum + payment.amount, 0);
    const pendingAmount = paymentAttempts
      .filter(payment => payment.status === 'pending')
      .reduce((sum, payment) => sum + payment.amount, 0);
    const dueAmount = Math.max(0, Math.round((total.amount - paidAmount - pendingAmount) * 100) / 100);
    const pendingPayment = paymentAttempts.find(payment => payment.status === 'pending');
    return {
      provider: total.provider,
      providerId,
      period: total._id.period,
      amount: Math.round(total.amount * 100) / 100,
      paidAmount: Math.round(paidAmount * 100) / 100,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      dueAmount,
      commissionRate: total.commissionRate,
      ordersCount: total.ordersCount,
      isCurrentPeriod: total._id.period === currentPeriod,
      status: pendingPayment
        ? 'pending'
        : dueAmount === 0
          ? 'paid'
          : total._id.period === currentPeriod
            ? 'accruing'
            : 'unpaid',
      payments: paymentAttempts
    };
  });
};

exports.getProviderCommissions = async (req, res) => {
  try {
    const [totals, payments] = await Promise.all([
      getDailyCommissionTotals(req.user._id),
      ProviderCommissionPayment.find({ provider: req.user._id })
        .select('+amount +paymentMethod +paymentReference +status +confirmedBy')
        .populate('payments.confirmedBy', 'name')
    ]);
    const dailyCommissions = withPaymentStatus(totals, payments, getCairoDate(new Date()));
    res.json({
      dailyCommissions: dailyCommissions.map(({ provider, ...commission }) => commission)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.submitCommissionPayment = async (req, res) => {
  try {
    const { period, paymentMethod, paymentReference } = req.body;
    const normalizedReference = typeof paymentReference === 'string' ? paymentReference.trim() : '';
    if (
      typeof period !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(period) ||
      !['visa', 'e_wallet'].includes(paymentMethod) ||
      normalizedReference.length < 3 ||
      normalizedReference.length > 100
    ) {
      return res.status(400).json({ error: 'Choose a valid commission day, payment method, and payment reference.' });
    }
    const parsedPeriod = new Date(`${period}T12:00:00Z`);
    if (!Number.isFinite(parsedPeriod.getTime()) || getCairoDate(parsedPeriod) !== period || period > getCairoDate(new Date())) {
      return res.status(400).json({ error: 'Choose a valid commission day that is not in the future.' });
    }

    const total = (await getDailyCommissionTotals(req.user._id)).find(row => row._id.period === period);
    if (!total || total.amount <= 0) {
      return res.status(404).json({ error: 'No payable commission was found for this day.' });
    }
    const existing = await ProviderCommissionPayment.findOne({ provider: req.user._id, period })
      .select('+amount +paymentMethod +paymentReference +status +confirmedBy +paidAt payments');
    const existingAttempts = existing ? normalizePaymentAttempts(existing) : [];
    const paidAmount = existingAttempts
      .filter(payment => payment.status === 'paid')
      .reduce((sum, payment) => sum + payment.amount, 0);
    if (existingAttempts.some(payment => payment.status === 'pending')) {
      return res.status(409).json({ error: 'A payment for this day is already awaiting admin confirmation.' });
    }

    const amount = Math.round((total.amount - paidAmount) * 100) / 100;
    if (amount <= 0) {
      return res.status(409).json({ error: 'There is no unpaid commission remaining for this day.' });
    }
    const attempt = {
      amount,
      paymentMethod,
      paymentReference: normalizedReference,
      status: 'pending'
    };

    if (existing) {
      const payment = await ProviderCommissionPayment.findOneAndUpdate(
        {
          _id: existing._id,
          status: { $ne: 'pending' },
          payments: { $not: { $elemMatch: { status: 'pending' } } }
        },
        { $push: { payments: attempt } },
        { new: true, runValidators: true }
      );
      if (!payment) {
        return res.status(409).json({ error: 'A payment for this day is already awaiting admin confirmation.' });
      }
      return res.status(201).json({ payment });
    }

    try {
      const payment = await ProviderCommissionPayment.create({
        provider: req.user._id,
        period,
        payments: [attempt]
      });
      return res.status(201).json({ payment });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const payment = await ProviderCommissionPayment.findOneAndUpdate(
        {
          provider: req.user._id,
          period,
          status: { $ne: 'pending' },
          payments: { $not: { $elemMatch: { status: 'pending' } } }
        },
        { $push: { payments: attempt } },
        { new: true, runValidators: true }
      );
      if (!payment) {
        return res.status(409).json({ error: 'A payment for this day is already awaiting admin confirmation.' });
      }
      return res.status(201).json({ payment });
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A payment for this day has already been submitted.' });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.getAllCommissionPayments = async (req, res) => {
  try {
    const [totals, payments] = await Promise.all([
      getDailyCommissionTotals(),
      ProviderCommissionPayment.find()
        .select('+amount +paymentMethod +paymentReference +status +confirmedBy')
        .populate('provider', 'name email')
        .populate('confirmedBy', 'name')
        .populate('payments.confirmedBy', 'name')
        .sort({ period: -1, createdAt: -1 })
    ]);
    const users = await User.find({
      _id: { $in: [...new Set(totals.map(total => String(total._id.provider)))] }
    }).select('name email');
    const usersById = new Map(users.map(user => [String(user._id), user]));
    const commissionTotals = totals.map(total => ({
      ...total,
      provider: usersById.get(String(total._id.provider))
    }));
    res.json({
      dailyCommissions: withPaymentStatus(commissionTotals, payments, getCairoDate(new Date())),
      payments: payments.flatMap(payment => normalizePaymentAttempts(payment))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.confirmCommissionPayment = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid commission payment ID.' });
    }
    let payment = await ProviderCommissionPayment.findOneAndUpdate(
      { payments: { $elemMatch: { _id: req.params.id, status: 'pending' } } },
      {
        $set: {
          'payments.$.status': 'paid',
          'payments.$.paidAt': new Date(),
          'payments.$.confirmedBy': req.user._id
        }
      },
      { new: true, runValidators: true }
    ).populate('provider', 'name email');
    if (payment) {
      payment = {
        _id: req.params.id,
        provider: payment.provider,
        period: payment.period,
        ...normalizePaymentAttempts(payment).find(attempt => String(attempt._id) === req.params.id)
      };
    } else {
      payment = await ProviderCommissionPayment.findOneAndUpdate(
        { _id: req.params.id, status: 'pending' },
        { $set: { status: 'paid', paidAt: new Date(), confirmedBy: req.user._id } },
        { new: true, runValidators: true }
      ).populate('provider', 'name email');
    }
    if (!payment) {
      return res.status(409).json({ error: 'Payment is not pending or has already been confirmed.' });
    }
    res.json({ payment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
