const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config({path: './config.env'});


exports.sendEmail = async (options) => {
  // 1) إعداد transporter
  const transporter = nodemailer.createTransport({
    // service: 'gmail',
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,  // باسورد التطبيق (App Password مش الباسورد العادي)
    }
  });

  // 2) إعداد تفاصيل الرسالة
  const mailOptions = {
    from: 'Your App <no-reply@yourapp.com>',
    to: options.email,
    subject: options.subject,
    text: options.message
  };

  // 3) إرسال الايميل
  await transporter.sendMail(mailOptions);
};
