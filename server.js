const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection (Atlas ya local)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tabish_seva_kendra';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('MongoDB Error:', err));

// MongoDB Models
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

const ServiceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, default: '📄' },
  color: { type: String, default: '#2196F3' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const RequestSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  userPhone: { type: String, required: true },
  serviceName: { type: String, required: true },
  serviceId: { type: String, required: true },
  aadharNumber: { type: String },
  address: { type: String },
  status: { type: String, default: 'pending' }, // pending, approved, rejected, completed
  submittedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Service = mongoose.model('Service', ServiceSchema);
const Request = mongoose.model('Request', RequestSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

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

    // Validation
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

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists with this phone number' 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      name,
      phone,
      password: hashedPassword
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: user._id,
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

    // Validation
    if (!phone || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide phone and password' 
      });
    }

    // Find user
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid phone number or password' 
      });
    }

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
      { userId: user._id, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
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
    const services = await Service.find({ isActive: true });
    res.json({
      success: true,
      services: services
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

    const service = new Service({
      name,
      description,
      icon: icon || '📄',
      color: color || '#2196F3'
    });

    await service.save();

    res.status(201).json({
      success: true,
      message: 'Service added successfully',
      service: service
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

    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { name, description, icon, color, updatedAt: Date.now() },
      { new: true }
    );

    if (!service) {
      return res.status(404).json({ 
        success: false, 
        message: 'Service not found' 
      });
    }

    res.json({
      success: true,
      message: 'Service updated successfully',
      service: service
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
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!service) {
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

// 🔹 3. FORM REQUESTS APIs
// POST /api/requests
app.post('/api/requests', async (req, res) => {
  try {
    const { userName, userPhone, serviceName, serviceId, aadharNumber, address } = req.body;

    // Validation
    if (!userName || !userPhone || !serviceName || !serviceId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields' 
      });
    }

    const request = new Request({
      userName,
      userPhone,
      serviceName,
      serviceId,
      aadharNumber,
      address,
      status: 'pending'
    });

    await request.save();

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      request: request
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
    const requests = await Request.find().sort({ submittedAt: -1 });
    res.json({
      success: true,
      requests: requests
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
    const requests = await Request.find({ userPhone: req.params.phone }).sort({ submittedAt: -1 });
    res.json({
      success: true,
      requests: requests
    });
  } catch (error) {
    console.error('Get user requests error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching user requests' 
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

    const request = await Request.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Request not found' 
      });
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      request: request
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
      'PUT  /api/requests/:id/status'
    ]
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
