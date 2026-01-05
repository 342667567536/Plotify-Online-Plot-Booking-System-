const mongoose = require('mongoose');

const PlotSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  location: {
    sector: String,
    plotNumber: String,
    coordinates: { lat: Number, lng: Number }
  },
  status: { type: String, enum: ['available','booked','sold'], default: 'available' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Plot', PlotSchema);