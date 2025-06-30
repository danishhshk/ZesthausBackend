const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  user: { type: Object, required: true },
  price: { type: Number, required: true },
  paymentId: { type: String },
  frontRowSeats: [String],      // e.g. ["A1", "A2"]
  frontRowCount: { type: Number, default: 0 },
  generalCount: { type: Number, default: 0 },
  vipTable: { type: String },   // Only for admin/offline
  qrCode: { type: String },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', BookingSchema);
