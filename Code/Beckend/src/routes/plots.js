const express = require('express');
const jwt = require('jsonwebtoken');
const Plot = require('../models/Plot');
const Booking = require('../models/Booking');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret_dev';

// simple auth middleware
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'Missing auth' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// list plots
router.get('/', async (req, res) => {
  const plots = await Plot.find().populate('owner', 'name email');
  res.json(plots);
});

// create plot (admin only)
router.post('/', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user || !user.isAdmin) return res.status(403).json({ message: 'Admin only' });
  const data = req.body;
  const plot = await Plot.create(data);
  res.status(201).json(plot);
});

// get single
router.get('/:id', async (req, res) => {
  const plot = await Plot.findById(req.params.id).populate('owner', 'name email');
  if (!plot) return res.status(404).json({ message: 'Not found' });
  res.json(plot);
});

// book a plot
router.post('/:id/book', authMiddleware, async (req, res) => {
  try {
    const plot = await Plot.findById(req.params.id);
    if (!plot) return res.status(404).json({ message: 'Plot not found' });
    if (plot.status !== 'available') return res.status(400).json({ message: 'Plot not available' });

    const booking = await Booking.create({ user: req.user.id, plot: plot._id, note: req.body.note });
    plot.status = 'booked';
    plot.owner = req.user.id;
    await plot.save();

    // In a full app, enqueue a payment or notification job here. Worker will pick pending bookings.
    res.status(201).json({ booking });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// confirm or cancel booking (admin)
router.post('/booking/:bookingId/confirm', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user || !user.isAdmin) return res.status(403).json({ message: 'Admin only' });
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  booking.status = req.body.status === 'confirmed' ? 'confirmed' : 'cancelled';
  await booking.save();
  if (booking.status === 'cancelled') {
    const plot = await Plot.findById(booking.plot);
    if (plot) {
      plot.status = 'available';
      plot.owner = null;
      await plot.save();
    }
  } else if (booking.status === 'confirmed') {
    const plot = await Plot.findById(booking.plot);
    if (plot) plot.status = 'sold';
    await plot.save();
  }
  res.json({ booking });
});

module.exports = router;