// models/Address.js
import mongoose from 'mongoose';

const AddressSchema = new mongoose.Schema({
  // Reference to the User who owns this address
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['Home', 'Work', 'Other'], // Predefined types of addresses
    default: 'Home',
    required: true,
  },
  fullName: { // Name of the recipient at this address
    type: String,
    required: [true, 'Please provide a full name for the address.'],
    trim: true,
    minlength: [3, 'Full name must be at least 3 characters.'],
  },
  phone: { // Phone number for delivery
    type: String,
    required: [true, 'Please provide a phone number for the address.'],
    trim: true,
    // Add validation for phone number format if needed (e.g., regex)
  },
  line1: {
    type: String,
    required: [true, 'Please provide address line 1.'],
    trim: true,
  },
  line2: {
    type: String,
    trim: true,
  },
  city: {
    type: String,
    required: [true, 'Please provide a city.'],
    trim: true,
  },
  state: {
    type: String,
    required: [true, 'Please provide a state/province.'],
    trim: true,
  },
  zip: {
    type: String,
    required: [true, 'Please provide a zip/postal code.'],
    trim: true,
  },
  country: {
    type: String,
    required: [true, 'Please provide a country.'],
    trim: true,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt timestamps
});

// Index to quickly find addresses by user
AddressSchema.index({ user: 1 });

const Address = mongoose.model('Address', AddressSchema);

export default Address;
