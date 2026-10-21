# Root: Service Booking Platform

A web application for booking services such as haircuts, cleaning and beauty. Users create an account, browse the available services with their prices and durations, and book instantly from their own dashboard.

Built with Node.js and Express, with server-rendered pages using Pug.

## Features

- **Authentication:** sign up and log in with JWT stored in cookies
- **Service browsing:** services shown with images, prices and duration
- **Instant booking:** book a service straight from the list
- **My Account:** user dashboard with profile editing and profile picture upload
- **Light and dark mode:** toggle between themes
- **Responsive design:** works on desktop and mobile

## Tech stack

| Layer | Tools |
|---|---|
| Runtime and server | Node.js, Express |
| Database | MongoDB, Mongoose |
| Authentication | JWT, bcrypt |
| Views and styling | Pug templates, custom CSS (Flexbox and Grid) |
| Other | Multer (file upload), Axios, Morgan (request logging), Helmet (security headers), CORS |

## Project structure

```
Root/
├── Controllers/  request handlers (business logic)
├── Models/       Mongoose schemas
├── Routes/       route definitions
├── views/        Pug templates
├── public/       static files (CSS, images, client scripts)
├── utiles/       helper functions
├── app.js        Express app setup
└── server.js     entry point
```

## Getting started

### Requirements

- Node.js 18 or newer
- A MongoDB database (local or MongoDB Atlas)

### Installation

```bash
git clone https://github.com/22moatya/Root.git
cd Root
npm install
```

### Environment variables

Create a `config.env` file in the project root. Use your own values and never commit this file.

```env
NODE_ENV=development
PORT=3000
DATABASE=mongodb+srv://<user>:<password>@<cluster>/<db-name>
JWT_SECRET=use-a-long-random-string
JWT_EXPIRES_IN=90d
```

### Run

```bash
npm start
```

Then open `http://localhost:3000`.

## Screenshots

Add screenshots here (home page, services list, booking, My Account).

## Author

**Mostafa Attia**, Backend Node.js Developer

- GitHub: [@22moatya](https://github.com/22moatya)
- LinkedIn: [mostafa-attia](https://www.linkedin.com/in/mostafa-attia-bb1693254)
