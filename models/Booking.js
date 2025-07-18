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

<<<<<<< HEAD
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
=======
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
>>>>>>> d85ae4ea5f2f52f44efb0be8c451bd098813e405
});

module.exports = mongoose.model('Booking', BookingSchema);
