// src/routes/auth.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');
const User = require('../Models/userModel');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '..', 'config.env') });

const authCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000
});

const setAuthCookie = (res, token) => {
  res.cookie('jwt', token, authCookieOptions());
};

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
    if (!currentUser.isActive) {
      return res.status(403).json({ error: 'This account has been suspended. Contact support for assistance.' });
    }

    req.user = currentUser; // إضافة المستخدم للـ req
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware: تحقق من الدور
exports.auth = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
};

// تسجيل مستخدم جديد
exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'customer'
    });

    const token = signToken(user._id, user.role);

    setAuthCookie(res, token);

    res.status(201).json({ message: 'User created', user: { id: user._id, role: user.role, name: user.name } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'Registration is temporarily unavailable because the database cannot be reached. Please try again later.'
      });
    }
    res.status(500).json({ error: err.message });
  }
};

// تسجيل دخول
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.isActive) {
      return res.status(403).json({ error: 'This account has been suspended. Contact support for assistance.' });
    }

    const token = signToken(user._id, user.role);

    setAuthCookie(res, token);

    res.json({ 
      message: 'Login successful',
      token, 
      user: { id: user._id, role: user.role, name: user.name } });
  } catch (err) {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'Login is temporarily unavailable because the database cannot be reached. Please try again later.'
      });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('jwt', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  res.status(200).json({ status: 'success' });
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
