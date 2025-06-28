const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  seats: [String],
  price: Number,
  paymentId: String,
  user: {
    name: String,
    email: String
  },
  timestamp: Date,
  used: { type: Boolean, default: false },
  qrCode: String // <-- Add this line
});

module.exports = mongoose.model('Booking', bookingSchema);
