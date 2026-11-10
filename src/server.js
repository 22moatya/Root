const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const seedDefaultCategories = require('./utiles/seedDefaultCategories');
const { syncApprovedProviderServices } = require('./utiles/providerServiceSync');

process.on('uncaughtException', err => {
    console.log('uncaughtException! Shutting down..');
    console.log(err.name, err.message);
        process.exit(1);
});
dotenv.config({ path: path.join(__dirname, '..', 'config.env') });
const app = require('./app');

// Connect to the remote database and retry after temporary startup failures.
const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

const connectToDatabase = () => {
  mongoose.connect(DB)
    .then(async () => {
     console.log('DB connection successful!');
     try {
       await seedDefaultCategories();
     } catch (err) {
       console.error('Default category initialization failed:', err.message);
     }
     try {
       await syncApprovedProviderServices();
     } catch (err) {
       console.error('Approved provider service synchronization failed:', err.message);
     }
    })
    .catch(err => {
      console.error('DB connection error:', err.message);
      const retryTimer = setTimeout(connectToDatabase, 15000);
      retryTimer.unref();
    });
};

connectToDatabase();

// start server
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`App running at http://localhost:${port}`);
});

process.on('unhandledRejection', err => {
    //console.log(err.name, err.message);
    console.log('UNHANDLER REJECTION! Shutting down..');
    console.log(err.name, err.message);
    server.close(() => {
        process.exit(1);
    }); 
});
