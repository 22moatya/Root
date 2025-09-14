// src/routes/auth.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../Models/userModel');
const dotenv = require('dotenv');
dotenv.config({path: './config.env'});


// دالة لإنشاء التوكن
const signToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

// Middleware: حماية الروات
exports.protect = async (req, res, next) => {
  let token;

  // 1️⃣ جلب التوكن من header أو من الـ cookie
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = currentUser; // إضافة المستخدم للـ req
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware: تحقق من الدور
exports.auth = ({requiredRole}) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    if (requiredRole && req.user.role !== requiredRole) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
};

// تسجيل مستخدم جديد
exports.signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({ name, email, passwordHash, role });

    const token = signToken(user._id, user.role);

    // إرسال التوكن في Cookie تلقائيًا
    res.cookie('jwt', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 أيام
    });

    res.status(201).json({ message: 'User created', user: { id: user._id, role: user.role, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// تسجيل دخول
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    const token = signToken(user._id, user.role);

    // إرسال التوكن في Cookie تلقائيًا
    res.cookie('jwt', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 أيام
    });

    res.json({ 
      message: 'Login successful',
      token, 
      user: { id: user._id, role: user.role, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash'); 
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


