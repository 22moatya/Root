const User = require('../Models/userModel');
const Service = require('../Models/serviceModel');
const Booking = require('../Models/bookingModel');
const Payment = require('../Models/paymentModel');

exports.getAdminOverview = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalProviders = await User.countDocuments({ role: 'provider' });
    const totalCustomers = await User.countDocuments({ role: 'customer' });

    const totalServices = await Service.countDocuments();

    const bookings = await Booking.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const revenue = await Payment.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    res.json({
      users: { totalUsers, totalProviders, totalCustomers },
      totalServices,
      bookings,
      revenue: revenue[0]?.total || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
