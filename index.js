const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require("nodemailer");
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
app.use(cors());
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
      seatType,
      name: newBooking.user?.name || ""
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
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const userName = user?.name || "";
    const mailOptions = {
      from: '"Zesthaus Events" <zesthaus.events@gmail.com>',
      to: user.email,
      subject: "Jashn-e-Qawwal – Booking Confirmation",
      html: `
        <h2>Thank you for booking with Zesthaus Events!</h2>
        <p>Dear ${userName},</p>
        <p>Your booking for <strong>Jashn-e-Qawwal</strong> is confirmed.</p>

        <h3>📍 Venue:</h3>
        <p><strong>SANSKRUTI BANQUET</strong><br>Grant Road West, Mumbai</p>

        <h3>🕖 Date & Time:</h3>
        <p><strong>25 July 2025</strong> at <strong>7:00 PM</strong></p>

        <p>Please present the below QR code at the entrance. It is valid for one-time scan only:</p>
        <img src="${qrImage}" alt="QR Code" style="max-width:200px;">

        <p>Looking forward to welcoming you!</p>
        <p>Warm regards,<br>Zesthaus Events Team</p>
        <h3>📌 Terms & Conditions</h3>
        <ul>
          <li>Tickets are non-refundable and non-transferable.</li>
          <li>Entry is subject to QR code scanning and security checks.</li>
          <li>ID proof may be required.</li>
          <li>No outside food, drinks, or prohibited items allowed.</li>
          <li>Only age 16+ allowed. Schedule subject to change.</li>
        </ul>
      `,
      attachments: [
        {
          filename: 'qrcode.png',
          content: base64Data,
          encoding: 'base64',
          cid: 'qrcode' // same as in the img src above
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

// Update the offline booking route to pass the name
app.post('/admin/offline-booking', async (req, res) => {
  try {
    const { user, seats, price, paymentId } = req.body;
    const timestamp = new Date();
    const newBooking = new Booking({
      user,
      seats,
      price,
      paymentId,
      timestamp,
      used: false
    });
    // Generate QR code
    const seatType = getSeatType(Array.isArray(newBooking.seats) && newBooking.seats.length > 0 ? newBooking.seats[0] : "");
    const qrData = JSON.stringify({
      bookingId: newBooking._id,
      seatType,
      name: newBooking.user?.name || ""
    });
    newBooking.qrCode = await QRCode.toDataURL(qrData);
    await newBooking.save();

    // Send email with QR code, pass name as argument
    await sendEmailWithQR(user.email, newBooking.qrCode, user.name);

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

// Update the sendEmailWithQR function to accept name
async function sendEmailWithQR(to, qrDataUrl, name = "") {
  if (!name) {
    name = to.split('@')[0];
  }
  // Extract base64 data from Data URL
  const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "");

  const mailOptions = {
    from: '"Zesthaus Events" <' + process.env.EMAIL_USER + '>',
    to,
    subject: 'Jashn-e-Qawwali – Booking Confirmation',
    html: `
      <h2>Thank you for booking with Zesthaus Events!</h2>
      <p>Dear <strong>${name}</strong>,</p>
      <p>Your booking for <strong>Jashn-e-Qawwal</strong> is confirmed.</p>

      <p><strong>📍 Venue:</strong><br>SANSKRUTI BANQUET, Grant Road West, Mumbai</p>
      <p><strong>📅 Date:</strong> 25 July 2025</p>
      <p><strong>🕖 Time:</strong> 7:00 PM</p>

      <p>Please present the QR code below at the event. This is valid for one-time scan only:</p>
      <img src="cid:qrcode" alt="QR Code" style="max-width: 200px;">

      <h3>📌 Terms & Conditions</h3>
      <ul>
        <li>Tickets are non-refundable and non-transferable.</li>
        <li>Entry is subject to QR code scanning and security checks.</li>
        <li>ID proof may be required.</li>
        <li>No outside food, drinks, or prohibited items allowed.</li>
        <li>Only age 16+ allowed. Schedule subject to change.</li>
      </ul>
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

// const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
