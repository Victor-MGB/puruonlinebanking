const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const bodyParser = require("body-parser");
const userRoutes = require('./routes/userRoutes'); // Uncomment and ensure the path is correct
require('dotenv').config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(bodyParser.json());
// CORS configuration
app.use(cors());

app.use(express.json());

// Routes
app.use('/api/users', userRoutes); // Add the user routes to your server

app.use((req, res, next) => {
    console.log(`Request URL: ${req.url}, Request Method: ${req.method}`);
    next();
  });
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal Server Error' });
  });

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
