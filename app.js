const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    
    res.json({ 
      message: '✅ PostgreSQL Database Connected Successfully!',
      current_time: result.rows[0].current_time,
      status: 'success',
      database: 'Render PostgreSQL'
    });
  } catch (err) {
    res.status(500).json({ 
      error: 'Database connection failed',
      message: err.message 
    });
  }
});

// Create users table (first time ke liye)
app.get('/api/init-db', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insert sample data
    await client.query(`
      INSERT INTO users (name, email, phone) 
      VALUES 
        ('Tabish', 'tabish@example.com', '9876543210'),
        ('John Doe', 'john@example.com', '1234567890')
      ON CONFLICT (email) DO NOTHING
    `);
    
    client.release();
    res.json({ message: '✅ Database initialized successfully with sample data!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM users ORDER BY id');
    client.release();
    res.json({ 
      success: true,
      users: result.rows 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// Add new user
app.post('/api/users', async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const client = await pool.connect();
    const result = await client.query(
      'INSERT INTO users (name, email, phone) VALUES ($1, $2, $3) RETURNING *',
      [name, email, phone]
    );
    client.release();
    res.json({ 
      success: true,
      user: result.rows[0],
      message: 'User added successfully!'
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'MyFlutterAPI is working! 🚀',
    database: 'Render PostgreSQL',
    timestamp: new Date().toISOString(),
    status: 'success',
    endpoints: {
      test_db: '/api/test-db',
      init_db: '/api/init-db', 
      get_users: '/api/users',
      add_user: 'POST /api/users'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    database: 'PostgreSQL',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MyFlutterAPI server running on port ${PORT}`);
  console.log(`📊 Database: Render PostgreSQL`);
  console.log(`🔗 URL: https://tabish-seva-kendra.onrender.com`);
});
