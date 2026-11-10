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
const categoriesRoutes = require('./Routes/categoriesRoute');
const siteSettingsRoutes = require('./Routes/siteSettingsRoute');
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

app.use(express.static(path.join(__dirname, '..', 'public')));





// let books = [
//   { isbn: "1111", title: "Clean Code", author: "Robert Martin" },
//   { isbn: "2222", title: "You Don't Know JS", author: "Kyle Simpson" },
//   { isbn: "3333", title: "Eloquent JavaScript", author: "Marijn Haverbeke" }
// ];

// // ✅ المهمة المطلوبة: إرجاع قائمة الكتب
// // app.get("/books", (req, res) => {
// //   res.status(200).json(books);
// // });

// // app.get("/books/:isbn", (req, res) => {
// //   const isbn = req.params.isbn;
// //   const book = books.find(b => b.isbn === isbn);

// //   if (!book) {
// //     return res.status(404).json({ message: "Book not found" });
// //   }
// //   res.status(200).json(book);
// // });



// app.get("/books/author/:author", (req, res) => {
//   const author = req.params.author.toLowerCase();
//   const filteredBooks = books.filter(
//     (b) => b.author.toLowerCase() === author
//   );

//   if (filteredBooks.length === 0) {
//     return res.status(404).json({ message: "No books found for this author" });
//   }

//   res.status(200).json(filteredBooks);
// });


// app.get("/books/title/:title", (req, res) => {
//   const title = req.params.title.toLowerCase();
//   const filteredBooks = books.filter(
//     (b) => b.title.toLowerCase() === title
//   );

//   if (filteredBooks.length === 0) {
//     return res.status(404).json({ message: "No books found with this title" });
//   }

//   res.status(200).json(filteredBooks);
// });


// let books = [
//   { 
//     isbn: "1111", 
//     title: "Clean Code", 
//     author: "Robert Martin",
//     reviews: [
//       { user: "Ahmed", review: "Great book for coding practices!" }
//     ]
//   },
//   {
//     isbn: "2222",
//     title: "You Don't Know JS",
//     author: "Kyle Simpson",
//     reviews: []
//   }
// ];

// app.get("/books/review/:isbn", (req, res) => {
//   const isbn = req.params.isbn;
//   const book = books.find(b => b.isbn === isbn);

//   if (!book) {
//     return res.status(404).json({ message: "Book not found" });
//   }

//   res.status(200).json(book.reviews || []);
// });



// let users = []; // temporary in-memory users


// app.post("/register", (req, res) => {
//   const { username, password } = req.body;

//   if (!username || !password) {
//     return res.status(400).json({ message: "Username and password are required" });
//   }

//   const userExists = users.find(u => u.username === username);
//   if (userExists) {
//     return res.status(409).json({ message: "User already exists" });
//   }

//   users.push({ username, password });
//   res.status(201).json({ message: "User registered successfully" });
// });


// app.post("/login", (req, res) => {
//   const { username, password } = req.body;

//   const user = users.find(
//     u => u.username === username && u.password === password
//   );

//   if (!user) {
//     return res.status(401).json({ message: "Invalid username or password" });
//   }

//   res.status(200).json({ message: "Login successful" });
// });



// app.put("/books/review/:isbn", (req, res) => {
//   const isbn = req.params.isbn;
//   const { username, review } = req.body;
//   if (!username || !review) {
//     return res.status(400).json({ message: "Username and review are required" });
//   }
//   const book = books.find(b => b.isbn === isbn);
//   if (!book) {
//     return res.status(404).json({ message: "Book not found" });
//   }
//   // إذا لا يوجد reviews في الكتاب، نهيئه كمصفوفة
//   if (!book.reviews) {
//     book.reviews = [];
//   }
//   // التحقق ما إذا كان المستخدم كتب مراجعة قبل ذلك
//   const userReviewIndex = book.reviews.findIndex(r => r.user === username);

//   if (userReviewIndex !== -1) {
//     // تعديل المراجعة
//     book.reviews[userReviewIndex].review = review;
//   } else {
//     // إضافة مراجعة جديدة
//     book.reviews.push({ user: username, review });
//   }
//   res.status(200).json({ 
//     message: "Review added or modified successfully",
//     reviews: book.reviews
//   });
// });


// app.delete("/books/review/:isbn", (req, res) => {
//   const isbn = req.params.isbn;
//   const { username } = req.body;

//   if (!username) {
//     return res.status(400).json({ message: "Username is required" });
//   }
//   const book = books.find(b => b.isbn === isbn);
//   if (!book) {
//     return res.status(404).json({ message: "Book not found" });
//   }
//   if (!book.reviews || book.reviews.length === 0) {
//     return res.status(404).json({ message: "No reviews found for this book" });
//   }

//   // البحث عن مراجعة المستخدم
//   const reviewIndex = book.reviews.findIndex(r => r.user === username);

//   if (reviewIndex === -1) {
//     return res.status(404).json({ message: "No review found for this user" });
//   }

//   // حذف المراجعة
//   book.reviews.splice(reviewIndex, 1);

//   res.status(200).json({
//     message: "Review deleted successfully",
//     reviews: book.reviews
//   });
// });


// // دالة تُرجع الكتب بشكل Promise
// function getBooksAsync() {
//   return new Promise((resolve, reject) => {
//     if (books && books.length > 0) {
//       resolve(books);
//     } else {
//       reject("No books available");
//     }
//   });
// }

// // Endpoint يستخدم async/await
// app.get("/async/books", async (req, res) => {
//   try {
//     const result = await getBooksAsync();
//     res.status(200).json(result);
//   } catch (error) {
//     res.status(404).json({ message: error });
//   }
// });

// // دالة Promise للبحث عن كتاب بالـ ISBN
// function getBookByIsbn(isbn) {
//   return new Promise((resolve, reject) => {
//     const book = books.find(b => b.isbn === isbn);
//     if (book) {
//       resolve(book);
//     } else {
//       reject("Book not found");
//     }
//   });
// }

// // Endpoint يستخدم Promise
// app.get("/promise/book/:isbn", (req, res) => {
//   const isbn = req.params.isbn;

//   getBookByIsbn(isbn)
//     .then(book => res.status(200).json(book))
//     .catch(err => res.status(404).json({ message: err }));
// });


// // دالة Promise للبحث عن كتب حسب المؤلف
// function getBooksByAuthor(author) {
//   return new Promise((resolve, reject) => {
//     const filtered = books.filter(
//       b => b.author.toLowerCase() === author.toLowerCase()
//     );

//     if (filtered.length > 0) {
//       resolve(filtered);
//     } else {
//       reject("No books found for this author");
//     }
//   });
// }
// // Endpoint يستخدم Promise
// app.get("/promise/author/:author", (req, res) => {
//   const author = req.params.author;

//   getBooksByAuthor(author)
//     .then(result => res.status(200).json(result))
//     .catch(err => res.status(404).json({ message: err }));
// });
// // بيانات الكتب (مؤقتة)
// let books = [
//   { isbn: "1111", title: "Clean Code", author: "Robert Martin" },
//   { isbn: "2222", title: "You Don't Know JS", author: "Kyle Simpson" },
//   { isbn: "3333", title: "Eloquent JavaScript", author: "Marijn Haverbeke" }
// ];

// // ✅ المهمة المطلوبة: إرجاع قائمة الكتب
// app.get("/books", (req, res) => {
//   res.status(200).json(books);
// });

// app.get("/books/:isbn", (req, res) => {
//   const isbn = req.params.isbn;
//   const book = books.find(b => b.isbn === isbn);

//   if (!book) {
//     return res.status(404).json({ message: "Book not found" });
//   }
//   res.status(200).json(book);
// });



// app.get("/books/author/:author", (req, res) => {
//   const author = req.params.author.toLowerCase();
//   const filteredBooks = books.filter(
//     (b) => b.author.toLowerCase() === author
//   );

//   if (filteredBooks.length === 0) {
//     return res.status(404).json({ message: "No books found for this author" });
//   }

//   res.status(200).json(filteredBooks);
// });


// app.get("/books/title/:title", (req, res) => {
//   const title = req.params.title.toLowerCase();
//   const filteredBooks = books.filter(
//     (b) => b.title.toLowerCase() === title
//   );

//   if (filteredBooks.length === 0) {
//     return res.status(404).json({ message: "No books found with this title" });
//   }

//   res.status(200).json(filteredBooks);
// });


// let bookss = [
//   { 
//     isbn: "1111", 
//     title: "Clean Code", 
//     author: "Robert Martin",
//     reviews: [
//       { user: "Ahmed", review: "Great book for coding practices!" }
//     ]
//   },
//   {
//     isbn: "2222",
//     title: "You Don't Know JS",
//     author: "Kyle Simpson",
//     reviews: []
//   }
// ];

// app.get("/books/review/:isbn", (req, res) => {
//   const isbn = req.params.isbn;
//   const book = bookss.find(b => b.isbn === isbn);

//   if (!book) {
//     return res.status(404).json({ message: "Book not found" });
//   }

//   res.status(200).json(book.reviews || []);
// });



// let users = []; // temporary in-memory users

// app.use(express.json());

// app.post("/register", (req, res) => {
//   const { username, password } = req.body;

//   if (!username || !password) {
//     return res.status(400).json({ message: "Username and password are required" });
//   }

//   const userExists = users.find(u => u.username === username);
//   if (userExists) {
//     return res.status(409).json({ message: "User already exists" });
//   }

//   users.push({ username, password });
//   res.status(201).json({ message: "User registered successfully" });
// });


// app.post("/login", (req, res) => {
//   const { username, password } = req.body;

//   const user = users.find(
//     u => u.username === username && u.password === password
//   );

//   if (!user) {
//     return res.status(401).json({ message: "Invalid username or password" });
//   }

//   res.status(200).json({ message: "Login successful" });
// });



// app.put("/books/review/:isbn", (req, res) => {
//   const isbn = req.params.isbn;
//   const { username, review } = req.body;
//   if (!username || !review) {
//     return res.status(400).json({ message: "Username and review are required" });
//   }
//   const book = books.find(b => b.isbn === isbn);
//   if (!book) {
//     return res.status(404).json({ message: "Book not found" });
//   }
//   // إذا لا يوجد reviews في الكتاب، نهيئه كمصفوفة
//   if (!book.reviews) {
//     book.reviews = [];
//   }
//   // التحقق ما إذا كان المستخدم كتب مراجعة قبل ذلك
//   const userReviewIndex = book.reviews.findIndex(r => r.user === username);

//   if (userReviewIndex !== -1) {
//     // تعديل المراجعة
//     book.reviews[userReviewIndex].review = review;
//   } else {
//     // إضافة مراجعة جديدة
//     book.reviews.push({ user: username, review });
//   }
//   res.status(200).json({ 
//     message: "Review added or modified successfully",
//     reviews: book.reviews
//   });
// });


// app.delete("/books/review/:isbn", (req, res) => {
//   const isbn = req.params.isbn;
//   const { username } = req.body;

//   if (!username) {
//     return res.status(400).json({ message: "Username is required" });
//   }
//   const book = books.find(b => b.isbn === isbn);
//   if (!book) {
//     return res.status(404).json({ message: "Book not found" });
//   }
//   if (!book.reviews || book.reviews.length === 0) {
//     return res.status(404).json({ message: "No reviews found for this book" });
//   }

//   // البحث عن مراجعة المستخدم
//   const reviewIndex = book.reviews.findIndex(r => r.user === username);

//   if (reviewIndex === -1) {
//     return res.status(404).json({ message: "No review found for this user" });
//   }

//   // حذف المراجعة
//   book.reviews.splice(reviewIndex, 1);

//   res.status(200).json({
//     message: "Review deleted successfully",
//     reviews: book.reviews
//   });
// });


// // دالة تُرجع الكتب بشكل Promise
// function getBooksAsync() {
//   return new Promise((resolve, reject) => {
//     if (books && books.length > 0) {
//       resolve(books);
//     } else {
//       reject("No books available");
//     }
//   });
// }

// // Endpoint يستخدم async/await
// app.get("/async/books", async (req, res) => {
//   try {
//     const result = await getBooksAsync();
//     res.status(200).json(result);
//   } catch (error) {
//     res.status(404).json({ message: error });
//   }
// });


// // دالة Promise للبحث عن كتاب بالـ ISBN
// function getBookByIsbn(isbn) {
//   return new Promise((resolve, reject) => {
//     const book = books.find(b => b.isbn === isbn);
//     if (book) {
//       resolve(book);
//     } else {
//       reject("Book not found");
//     }
//   });
// }

// // Endpoint يستخدم Promise
// app.get("/promise/book/:isbn", (req, res) => {
//   const isbn = req.params.isbn;

//   getBookByIsbn(isbn)
//     .then(book => res.status(200).json(book))
//     .catch(err => res.status(404).json({ message: err }));
// });


// // // دالة Promise للبحث عن الكتب حسب العنوان
// function getBooksByTitle(title) {
//   return new Promise((resolve, reject) => {
//     const filtered = books.filter(
//       b => b.title.toLowerCase() === title.toLowerCase()
//     );

//     if (filtered.length > 0) {
//       resolve(filtered);
//     } else {
//       reject("No books found with this title");
//     }
//   });
// }

// // Endpoint يستخدم Promise
// app.get("/promise/title/:title", (req, res) => {
//   const title = req.params.title;

//   getBooksByTitle(title)
//     .then(result => res.status(200).json(result))
//     .catch(err => res.status(404).json({ message: err }));
// });










// Routes
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/dashboard', adminRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/settings', siteSettingsRoutes);

// 404 handler
app.all(/.*/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handler
app.use(globalErrorHandler);

module.exports = app;
