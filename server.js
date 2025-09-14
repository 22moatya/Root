const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./Models/userModel');


process.on('uncaughtException', err => {
    console.log('uncaughtException! Shutting down..');
    console.log(err.name, err.message);
        process.exit(1);
});
dotenv.config({path: './config.env'});
const app = require('./app');

//connect to remote database
const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose.connect(DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('DB connection successful!'))
.catch(err => {
  console.error('DB connection error:', err.message);
});

// start server
const port = process.env.PORT || 4000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

process.on('unhandledRejection', err => {
    //console.log(err.name, err.message);
    console.log('UNHANDLER REJECTION! Shutting down..');
    console.log(err.name, err.message);
    server.close(() => {
        process.exit(1);
    }); 
});


app.get('/test-user', async (req, res) => {
  const u = await User.create({
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: '123456'
  });
  res.json(u);
});
