// const mongoose = require('mongoose');

// const bookingSchema = new mongoose.Schema({
//   seats: [String],
//   price: Number,
//   paymentId: String,
//   user: {
//     name: String,
//     email: String
//   },
//   timestamp: Date,
//   used: { type: Boolean, default: false },
//   qrCode: String // <-- Add this line
// });

// module.exports = mongoose.model('Booking', bookingSchema);


const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  frontRowSeats: [String], // e.g. ["A1", "A2"]
  frontRowCount: Number,
  generalCount: Number,
  price: Number,
  paymentId: { type: String, unique: true }, // <-- Make paymentId unique
  user: {
    name: { type: String, required: true },
    email: { type: String, required: true },
  },
  createdAt: { type: Date, default: Date.now },
  used: { type: Boolean, default: false },
  qrCode: String,
});

module.exports = mongoose.model('Booking', bookingSchema);
