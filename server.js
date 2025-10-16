const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// 🔍 DEBUG: Detailed connection testing
console.log('🚀 Starting Tabish Seva Kendra Server...');
console.log('🔧 Checking Environment Variables:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ PRESENT' : '❌ MISSING');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ PRESENT' : '❌ MISSING');

if (process.env.DATABASE_URL) {
  console.log('📊 DATABASE_URL starts with:', process.env.DATABASE_URL.substring(0, 30) + '...');
}

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

console.log('✅ PostgreSQL Pool Created');

// Test database connection and create tables
const initializeDatabase = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database Connection Successful!');
    
    // Test query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database Time:', result.rows[0].current_time);
    
    // Create tables if not exists
    console.log('🔧 Creating tables...');
    
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(10) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Services table
    await client.query(`
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        icon VARCHAR(10) DEFAULT '📄',
        color VARCHAR(20) DEFAULT '#2196F3',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Requests table - UPDATED WITH REGISTRATION NUMBER
    await client.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        user_name VARCHAR(100) NOT NULL,
        user_phone VARCHAR(10) NOT NULL,
        service_name VARCHAR(100) NOT NULL,
        service_id VARCHAR(50) NOT NULL,
        aadhar_number VARCHAR(12),
        address TEXT,
        registration_no VARCHAR(100) UNIQUE, -- ✅ REGISTRATION NUMBER ADDED
        status VARCHAR(20) DEFAULT 'pending',
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Tables created successfully');

    // ✅ ADD REGISTRATION NUMBER COLUMN IF NOT EXISTS (FOR EXISTING TABLES)
    try {
      await client.query(`
        ALTER TABLE requests 
        ADD COLUMN IF NOT EXISTS registration_no VARCHAR(100)
      `);
      console.log('✅ Registration number column added/verified');
    } catch (alterError) {
      console.log('ℹ️ Registration column already exists or error:', alterError.message);
    }

    // Insert default services
    const servicesResult = await client.query('SELECT COUNT(*) FROM services');
    if (parseInt(servicesResult.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO services (name, description, icon, color) 
        VALUES 
        ('Aadhar Card', 'Aadhar card application and correction services', '🆔', '#2196F3'),
        ('PAN Card', 'PAN card application and update services', '💳', '#4CAF50'),
        ('Voter ID', 'Voter ID card application and verification', '🗳️', '#FF9800'),
        ('Ration Card', 'Ration card application and family member updates', '📋', '#9C27B0')
      `);
      console.log('✅ Default services inserted');
    } else {
      console.log('✅ Services already exist');
    }

    // Check existing tables and columns
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('✅ Existing Tables:', tablesResult.rows.map(row => row.table_name));

    // Check requests table columns
    const columnsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'requests' 
      ORDER BY ordinal_position
    `);
    console.log('✅ Requests Table Columns:', columnsResult.rows.map(row => row.column_name));
    
    client.release();
    console.log('🎉 Database initialization completed!');
    
  } catch (error) {
    console.error('❌ DATABASE INITIALIZATION FAILED:');
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code);
    console.error('Error Detail:', error.detail);
  }
};

initializeDatabase();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'tabish_seva_secret_key';

// Auth Middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// 🔹 1. USER AUTHENTICATION APIs

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide name, phone and password' 
      });
    }

    if (phone.length !== 10) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number must be 10 digits' 
      });
    }

    // Check if user exists
    const userExists = await pool.query(
      'SELECT * FROM users WHERE phone = $1', 
      [phone]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists with this phone number' 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await pool.query(
      'INSERT INTO users (name, phone, password) VALUES ($1, $2, $3) RETURNING *',
      [name, phone, hashedPassword]
    );

    const user = newUser.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during registration' 
    });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide phone and password' 
      });
    }

    // Find user
    const userResult = await pool.query(
      'SELECT * FROM users WHERE phone = $1', 
      [phone]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid phone number or password' 
      });
    }

    const user = userResult.rows[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid phone number or password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
});

// 🔹 2. SERVICES MANAGEMENT APIs

// GET /api/services
app.get('/api/services', async (req, res) => {
  try {
    const servicesResult = await pool.query(
      'SELECT * FROM services WHERE is_active = true ORDER BY created_at DESC'
    );
    
    res.json({
      success: true,
      services: servicesResult.rows
    });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching services' 
    });
  }
});

// POST /api/services
app.post('/api/services', authMiddleware, async (req, res) => {
  try {
    const { name, description, icon, color } = req.body;

    if (!name || !description) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide name and description' 
      });
    }

    const newService = await pool.query(
      'INSERT INTO services (name, description, icon, color) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, icon || '📄', color || '#2196F3']
    );

    res.status(201).json({
      success: true,
      message: 'Service added successfully',
      service: newService.rows[0]
    });

  } catch (error) {
    console.error('Add service error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error adding service' 
    });
  }
});

// PUT /api/services/:id
app.put('/api/services/:id', authMiddleware, async (req, res) => {
  try {
    const { name, description, icon, color } = req.body;

    const updatedService = await pool.query(
      'UPDATE services SET name = $1, description = $2, icon = $3, color = $4 WHERE id = $5 RETURNING *',
      [name, description, icon, color, req.params.id]
    );

    if (updatedService.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Service not found' 
      });
    }

    res.json({
      success: true,
      message: 'Service updated successfully',
      service: updatedService.rows[0]
    });

  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating service' 
    });
  }
});

// DELETE /api/services/:id
app.delete('/api/services/:id', authMiddleware, async (req, res) => {
  try {
    const deletedService = await pool.query(
      'UPDATE services SET is_active = false WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (deletedService.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Service not found' 
      });
    }

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });

  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting service' 
    });
  }
});

// 🔹 3. FORM REQUESTS APIs - UPDATED WITH REGISTRATION NUMBER

// POST /api/requests - UPDATED WITH REGISTRATION NUMBER
app.post('/api/requests', async (req, res) => {
  try {
    const { userName, userPhone, serviceName, serviceId, aadharNumber, address, registrationNo } = req.body;

    if (!userName || !userPhone || !serviceName || !serviceId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields' 
      });
    }

    // ✅ GENERATE REGISTRATION NUMBER IF NOT PROVIDED
    const finalRegistrationNo = registrationNo || `REG${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const newRequest = await pool.query(
      `INSERT INTO requests (user_name, user_phone, service_name, service_id, aadhar_number, address, registration_no) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userName, userPhone, serviceName, serviceId, aadharNumber, address, finalRegistrationNo]
    );

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      request: newRequest.rows[0]
    });

  } catch (error) {
    console.error('Submit request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error submitting application' 
    });
  }
});

// GET /api/requests
app.get('/api/requests', async (req, res) => {
  try {
    const requestsResult = await pool.query(
      'SELECT * FROM requests ORDER BY submitted_at DESC'
    );
    
    res.json({
      success: true,
      requests: requestsResult.rows
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching requests' 
    });
  }
});

// GET /api/requests/user/:phone
app.get('/api/requests/user/:phone', async (req, res) => {
  try {
    const requestsResult = await pool.query(
      'SELECT * FROM requests WHERE user_phone = $1 ORDER BY submitted_at DESC',
      [req.params.phone]
    );
    
    res.json({
      success: true,
      requests: requestsResult.rows
    });
  } catch (error) {
    console.error('Get user requests error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching user requests' 
    });
  }
});

// GET /api/requests/track/:registrationNo - NEW ENDPOINT FOR TRACKING
app.get('/api/requests/track/:registrationNo', async (req, res) => {
  try {
    const requestsResult = await pool.query(
      'SELECT * FROM requests WHERE registration_no = $1',
      [req.params.registrationNo]
    );
    
    if (requestsResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Application not found with this registration number' 
      });
    }

    res.json({
      success: true,
      request: requestsResult.rows[0]
    });
  } catch (error) {
    console.error('Track request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error tracking application' 
    });
  }
});

// PUT /api/requests/:id/status
app.put('/api/requests/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status' 
      });
    }

    const updatedRequest = await pool.query(
      'UPDATE requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );

    if (updatedRequest.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Request not found' 
      });
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      request: updatedRequest.rows[0]
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating status' 
    });
  }
});

// Default route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Tabish Seva Kendra Backend API', 
    version: '1.0.0',
    database: 'PostgreSQL',
    status: 'Running',
    endpoints: [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET  /api/services',
      'POST /api/services',
      'PUT  /api/services/:id',
      'DELETE /api/services/:id',
      'GET  /api/requests',
      'POST /api/requests',
      'GET  /api/requests/user/:phone',
      'GET  /api/requests/track/:registrationNo', // ✅ NEW ENDPOINT
      'PUT  /api/requests/:id/status'
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
