const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

const userRoutes = require('./Routes/userRoute');
const serviceRoutes = require('./Routes/servicesRoute');
const providerRoutes = require('./Routes/providersRoute');
const bookingRoutes = require('./Routes/bookingRoute');
const paymentRoutes = require('./Routes/paymentRoute');
const reviewRoutes = require('./Routes/reviewRoute');
const adminRoutes = require('./Routes/admindashboardRoute');
const viewRoutes = require('./Routes/viewRoute');

const AppError = require('./utiles/appError');
const logger = require('./utiles/logger');
const globalErrorHandler = require('./Controllers/errorController');
const paymentController = require('./Controllers/paymentController');


const app = express();
// مثال: log عند تشغيل السيرفر
logger.info('App starting...');
// 🔐 Security Middlewares
app.use(helmet()); // 1) HTTP headers

// 2) Rate limiter (limit 100 req per hour per IP)
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);

// Webhook Stripe (لازم تكون قبل express.json())
app.post(
  '/webhook-checkout',
  express.raw({ type: 'application/json' }),
  paymentController.webhookCheckout
);

// 3) Body parser
app.use(express.json({ limit: '10kb' }));

app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 4) Data sanitization against NoSQL query injection
// app.use(mongoSanitize());

// 5) Data sanitization against XSS
// app.use(xss());

// 6) Prevent parameter pollution
app.use(hpp({ whitelist: ['durationMin', 'basePrice'] }));

// Middlewares
app.use(cors());
app.use(cookieParser());
app.use(morgan('dev'));

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
//هذه الدالة لتشغيل الملفات الثابتة فى المتصفح 
//app.use(express.static('./public'));
app.use(express.static(path.join(__dirname,'public')));

// Routes
app.use('/', viewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/dashboard', adminRoutes);

// 404 handler
app.all(/.*/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handler
app.use(globalErrorHandler);

module.exports = app;
