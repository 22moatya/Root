
const Service = require('../Models/serviceModel'); // موديل الخدمات
const Review = require('../Models/reviewModel');   // موديل التقييمات

exports.getMainPage = async (req, res) => {
  try {
    const services = await Service.find();
    const reviews = await Review.find();
    res.render('index', { 
        title: 'Home',
        services,
        reviews });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server Error' });
  }
};

exports.signupPage = (req, res) => {
  try{
  res.render('signup', { title: 'Sign Up' });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server Error' });
  }
};
exports.loginPage = (req, res) => {
  try{
  res.render('login', { title: 'Login' });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server Error' });
  }
};


exports.getMyAccount = (req, res) => {
  res.render('myAccount', { title: 'My Account', user: req.user });
};

