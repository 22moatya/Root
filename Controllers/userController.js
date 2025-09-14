const User = require('../Models/userModel');

// عرض كل المستخدمين (admin فقط)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash'); // من غير الباسورد
    res.json({
        results: users.length,
        users});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// عرض مستخدم واحد
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// تعديل بيانات مستخدم
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// حذف مستخدم
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(204).send(); // تم الحذف بنجاح
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
