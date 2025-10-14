const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MySQL Connection
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'tabishdevelopersDB.mssql.somee.com',
  user: process.env.DB_USER || 'MOHDTABISH41_SQLLogin_1',
  password: process.env.DB_PASSWORD || 'Tabish@1994',
  database: process.env.DB_NAME || 'tabishdevelopersDB',
  port: process.env.DB_PORT || 1433,
  connectTimeout: 60000,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
});

// Connect to MySQL
connection.connect((err) => {
  if (err) {
    console.error('MySQL connection failed:', err.message);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(() => {
      connection.connect();
    }, 5000);
  } else {
    console.log('✅ Connected to MySQL database successfully!');
  }
});

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'MyFlutterAPI is working! 🚀',
    database: 'MySQL Connected',
    timestamp: new Date().toISOString(),
    status: 'success'
  });
});

// Test database connection
app.get('/api/test-db', (req, res) => {
  connection.query('SELECT 1 + 1 AS solution', (error, results) => {
    if (error) {
      return res.status(500).json({ 
        error: 'Database connection failed',
        message: error.message 
      });
    }
    res.json({ 
      message: 'Database connection successful!',
      result: results[0].solution 
    });
  });
});

// Get all users (example API)
app.get('/api/users', (req, res) => {
  connection.query('SELECT * FROM users', (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ users: results });
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    database: 'Connected',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MyFlutterAPI server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  connection.end();
  process.exit(0);
});
