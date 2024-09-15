const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes'); // Ensure this path is correct
require('dotenv').config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: 'http://localhost:4000', // Adjust if necessary for your frontend origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json()); // Built-in middleware to parse JSON bodies

// Logging middleware (should be placed before route handlers)
app.use((req, res, next) => {
  console.log(`Request URL: ${req.url}, Request Method: ${req.method}`);
  next();
});

// Routes
app.use('/api/users', userRoutes); // Add the user routes to your server

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
