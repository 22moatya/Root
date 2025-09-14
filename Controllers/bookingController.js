const Booking = require('../Models/bookingModel');
const { sendEmail } = require('../utiles/email');

// إنشاء حجز
exports.createBooking = async (req, res) => {
  try {
    const { provider, service, date } = req.body;

    let booking = await Booking.create({
      customer: req.user._id, // جاي من protect middleware
      provider,
      service,
      date
    });
     // populate عشان نجيب ايميل العميل و المزود
    booking = await booking.populate([
      { path: 'customer', select: 'email name' },
      { path: 'provider', select: 'email name' },
      { path: 'service', select: 'name' }
    ]);

    // ✉️ إرسال اشعار للـ provider
    if (booking.provider?.email) {
      await sendEmail({
        email: booking.provider.email,
        subject: '📌 حجز جديد!',
        message: `لديك حجز جديد من ${booking.customer.name || 'عميل'} 
        لخدمة ${booking.service.name} يوم ${date}`
      });
    }

    // ✉️ إرسال اشعار للـ customer
    if (booking.customer?.email) {
      await sendEmail({
        email: booking.customer.email,
        subject: '✅ تم إنشاء حجزك',
        message: `تم حجز خدمة ${booking.service.name} مع ${booking.provider.name || 'مزود الخدمة'} 
        يوم ${date}`
      });
    }

    res.status(201).json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// عرض حجوزات العميل
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ customer: req.user._id })
      .populate('provider service');
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// عرض حجوزات مزود الخدمة
exports.getProviderBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ provider: req.user._id })
      .populate('customer service');
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// تحديث حالة الحجز (Confirm / Cancel / Complete)
exports.updateBookingStatus = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    booking.status = req.body.status;
    await booking.save();
    
     // ✉️ إشعار للعميل
    if (booking.customer?.email) {
      await sendEmail({
        email: booking.customer.email,
        subject: '🔔 تحديث حالة الحجز',
        message: `تم تحديث حالة حجزك لخدمة ${booking.service.name} 
        إلى: ${booking.status}`
      });
    }
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};


exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      customer: req.user._id
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    booking.status = 'cancelled';
    await booking.save();

    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
