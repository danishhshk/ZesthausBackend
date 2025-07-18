const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require("nodemailer");
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: 'https://zesthausevents.com', // or your deployed frontend URL
  credentials: true
}));
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Connect to MongoDB using env variable
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ Mongo error:", err));

// Test Route
app.get('/', (req, res) => {
  res.send('API Running...');
});

// --- Models ---
const Booking = require('./models/Booking');

// Booking route (save to DB and send email)
app.post('/api/bookings', async (req, res) => {
  const { seats, price, paymentId, user } = req.body;

  try {
    const newBooking = new Booking({ seats, price, paymentId, user });
    await newBooking.save();

    // Get seat type from the first seat
    const seatType = getSeatType(Array.isArray(newBooking.seats) && newBooking.seats.length > 0 ? newBooking.seats[0] : "");

    // Generate QR code with booking ID, seat type, and name
    const qrData = JSON.stringify({
      bookingId: newBooking._id,
      frontRowSeats,
      frontRowCount,
      generalCount,
      name: user?.name || ""
    });
    const qrImage = await QRCode.toDataURL(qrData);
    newBooking.qrCode = qrImage;
    await newBooking.save();

    // Extract base64 data
    const base64Data = qrImage.replace(/^data:image\/png;base64,/, "");

    // Email configuration
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'zesthaus.events@gmail.com',
        pass: 'gwbvnvdwoavtlcdb'
      }
    });

    const mailOptions = {
      from: '"Zesthaus Events" <zesthaus.events@gmail.com>',
      to: user.email,
      subject: "Jashn-e-Qawwali – Booking Confirmation",
      html: `
        <h2>Thanks for Booking!</h2>
        <p><strong>Payment ID:</strong> ${paymentId}</p>
        <p><strong>Seats:</strong> ${seats.join(', ')}</p>
        <p><strong>Total Price:</strong> ₹${price}</p>
        <p>📍 See you on <strong>15th July 2025</strong> at the Qawwali Night in Mumbai!</p>
        <p><strong>Your Ticket QR Code:</strong></p>
        <img src="cid:qrcode" alt="QR Code Ticket" />
        <p>Show this QR code at the event entrance for verification.</p>
      `,
      attachments: [
        {
          filename: 'qrcode.png',
          content: base64Data,
          encoding: 'base64',
          cid: 'qrcode'
        }
      ]
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('❌ Email error:', err);
      } else {
        console.log('📧 Email sent:', info.response);
      }
    });

    res.status(201).json({ message: "Booking saved successfully!", bookingId: newBooking._id });
  } catch (error) {
    console.error("❌ Error saving booking:", error);
    res.status(500).json({ message: "Failed to save booking" });
  }
});

// Admin route to get all bookings
app.get('/admin/bookings', async (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== 'Bearer supersecrettoken123') {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const bookings = await Booking.find().sort({ timestamp: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
});

app.post('/admin/verify-ticket', async (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== 'Bearer supersecrettoken123') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const { bookingId } = req.body;
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Ticket not found." });
    }
    if (booking.used) {
      return res.status(400).json({ message: "Ticket already used!" });
    }
    booking.used = true;
    await booking.save();
    return res.json({ message: "Ticket is valid! Marked as used.", booking });
  } catch (err) {
    return res.status(500).json({ message: "Verification failed." });
  }
});

app.get('/api/my-bookings', async (req, res) => {
  const userEmail = req.query.email;
  if (!userEmail) {
    return res.status(400).json({ message: "Email required" });
  }
  try {
    const bookings = await Booking.find({ "user.email": userEmail }).sort({ timestamp: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch bookings" });
  }
});

app.delete('/admin/bookings/:id', async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ message: "Booking deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete booking" });
  }
});

// Admin/offline booking route
app.post('/admin/offline-booking', async (req, res) => {
  const { user, price, paymentId, frontRowSeats = [], frontRowCount = 0, generalCount = 0, vipTable } = req.body;

  // Check for double-booked front row seats
  if (frontRowSeats.length > 0) {
    const available = await areFrontRowSeatsAvailable(frontRowSeats);
    if (!available) {
      return res.status(400).json({ message: "One or more front row seats are already booked." });
    }
  }

  try {
    const newBooking = new Booking({
      user,
      price,
      paymentId,
      frontRowSeats,
      frontRowCount,
      generalCount,
      vipTable
    });

    // QR code logic (customize as needed)
    const qrData = JSON.stringify({
      bookingId: newBooking._id,
      frontRowSeats,
      frontRowCount,
      generalCount,
      vipTable,
      name: user?.name || ""
    });
    const qrImage = await QRCode.toDataURL(qrData);
    newBooking.qrCode = qrImage;
    await newBooking.save();

    // Send email with QR code
    await sendEmailWithQR(user.email, newBooking.qrCode);

    res.json({ message: "Offline booking added and email sent", booking: newBooking });
  } catch (err) {
    res.status(500).json({ message: "Failed to add offline booking or send email" });
  }
});

// Email transporter using env variables
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Utility function to send QR email
async function sendEmailWithQR(to, qrDataUrl) {
  const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "");
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: '🎫 Qawwali Night Ticket Confirmation (Offline)',
    html: `
      <h2>Your Offline Ticket</h2>
      <p>Please present this QR code at the event entrance:</p>
      <img src="cid:qrcode" alt="QR Code Ticket" />
      <p>Thank you for booking with Zesthaus Events!</p>
    `,
    attachments: [
      {
        filename: 'qrcode.png',
        content: base64Data,
        encoding: 'base64',
        cid: 'qrcode'
      }
    ]
  };
  return transporter.sendMail(mailOptions);
}

function getSeatType(seat) {
  if (typeof seat !== "string") return "";
  if (seat.startsWith("VIP-")) return "VIP";
  if (seat.startsWith("1-")) return "frontRow";
  if (seat.startsWith("2-")) return "general";
  if (seat.startsWith("R-")) return "general";
  if (["VIP", "frontRow", "general"].includes(seat)) return seat; // For offline dropdown
  return "";
}

// --- Start Server ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
