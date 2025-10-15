const mongoose = require('mongoose');

const RequestSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  userPhone: { type: String, required: true },
  serviceName: { type: String, required: true },
  serviceId: { type: String, required: true },
  aadharNumber: { type: String },
  address: { type: String },
  status: { type: String, default: 'pending' },
  submittedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Request', RequestSchema);
