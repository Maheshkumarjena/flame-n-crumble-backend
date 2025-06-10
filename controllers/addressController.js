// controllers/addressController.js
import Address from '../models/Address.js';
import User from '../models/User.js'; // Might need to interact with User for default address logic
import logger from '../utils/logger.js';
// impoort error errorHandler from '../utils/errorHandler.js';
import errorHandler from '../middleware/error.js';

/**
 * @desc Get all addresses for the logged-in user
 * @route GET /api/addresses
 * @access Private
 */
export const getUserAddresses = async (req, res, next) => {
  try {
    // req.userId is set by the authentication middleware
    const addresses = await Address.find({ user: req.userId }).sort({ isDefault: -1, createdAt: 1 });
    res.status(200).json({ addresses });
  } catch (error) {
    logger.error(`Error getting addresses for user ${req.userId}:`, error);
    next(new errorHandler('Failed to fetch addresses', 500));
  }
};

/**
 * @desc Add a new address for the logged-in user
 * @route POST /api/addresses
 * @access Private
 */
export const createAddress = async (req, res, next) => {
  try {
    const { type, fullName, phone, line1, line2, city, state, zip, country, isDefault } = req.body;

    // Check if the user already has an address, if not, make this the default
    const existingAddressesCount = await Address.countDocuments({ user: req.userId });
    let shouldBeDefault = existingAddressesCount === 0 ? true : (isDefault || false);

    const newAddress = new Address({
      user: req.userId,
      type,
      fullName,
      phone,
      line1,
      line2,
      city,
      state,
      zip,
      country,
      isDefault: shouldBeDefault,
    });

    // If this new address is set as default, unset previous default for this user
    if (newAddress.isDefault) {
      await Address.updateMany(
        { user: req.userId, _id: { $ne: newAddress._id }, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    await newAddress.save();
    res.status(201).json({ message: 'Address added successfully', address: newAddress });
  } catch (error) {
    logger.error(`Error creating address for user ${req.userId}:`, error);
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return next(new errorHandler(messages.join(', '), 400));
    }
    next(new errorHandler('Failed to add address', 500));
  }
};

/**
 * @desc Update an existing address for the logged-in user
 * @route PUT /api/addresses/:id
 * @access Private
 */
export const updateAddress = async (req, res, next) => {
  try {
    const { id } = req.params; // Address ID
    const { type, fullName, phone, line1, line2, city, state, zip, country, isDefault } = req.body;

    const address = await Address.findOne({ _id: id, user: req.userId });

    if (!address) {
      throw new errorHandler('Address not found or not authorized', 404);
    }

    // Update fields
    address.type = type || address.type;
    address.fullName = fullName || address.fullName;
    address.phone = phone || address.phone;
    address.line1 = line1 || address.line1;
    address.line2 = line2; // line2 can be explicitly set to null/empty string
    address.city = city || address.city;
    address.state = state || address.state;
    address.zip = zip || address.zip;
    address.country = country || address.country;

    // Handle setting as default
    if (isDefault !== undefined && isDefault !== address.isDefault) {
      if (isDefault) {
        // Unset previous default for this user
        await Address.updateMany(
          { user: req.userId, _id: { $ne: id }, isDefault: true },
          { $set: { isDefault: false } }
        );
        address.isDefault = true;
      } else {
        // If user tries to unset a default, ensure there's at least one default or prevent it
        // For simplicity, we'll allow unsetting, but a more complex app might require a default
        address.isDefault = false;
      }
    }

    await address.save();
    res.status(200).json({ message: 'Address updated successfully', address });
  } catch (error) {
    logger.error(`Error updating address ${req.params.id} for user ${req.userId}:`, error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return next(new errorHandler(messages.join(', '), 400));
    }
    next(error); // Pass errorHandler directly, or wrap others
  }
};

/**
 * @desc Delete an address for the logged-in user
 * @route DELETE /api/addresses/:id
 * @access Private
 */
export const deleteAddress = async (req, res, next) => {
  try {
    const { id } = req.params; // Address ID

    const address = await Address.findOne({ _id: id, user: req.userId });

    if (!address) {
      throw new errorHandler('Address not found or not authorized', 404);
    }

    if (address.isDefault) {
      // Prevent deleting the default address unless it's the only one
      const remainingAddressesCount = await Address.countDocuments({ user: req.userId, _id: { $ne: id } });
      if (remainingAddressesCount > 0) {
        throw new errorHandler('Cannot delete default address. Please set another address as default first.', 400);
      }
    }

    await Address.deleteOne({ _id: id }); // Use deleteOne on the document
    res.status(200).json({ message: 'Address deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting address ${req.params.id} for user ${req.userId}:`, error);
    next(error);
  }
};

/**
 * @desc Set a specific address as the default for the logged-in user
 * @route PATCH /api/addresses/:id/set-default
 * @access Private
 */
export const setDefaultAddress = async (req, res, next) => {
  try {
    const { id } = req.params; // Address ID

    // Find the address to set as default
    const addressToSetDefault = await Address.findOne({ _id: id, user: req.userId });

    if (!addressToSetDefault) {
      throw new errorHandler('Address not found or not authorized', 404);
    }

    if (addressToSetDefault.isDefault) {
      return res.status(200).json({ message: 'Address is already default', address: addressToSetDefault });
    }

    // Unset previous default address for this user
    await Address.updateMany(
      { user: req.userId, isDefault: true },
      { $set: { isDefault: false } }
    );

    // Set the specified address as default
    addressToSetDefault.isDefault = true;
    await addressToSetDefault.save();

    res.status(200).json({ message: 'Address set as default', address: addressToSetDefault });
  } catch (error) {
    logger.error(`Error setting default address ${req.params.id} for user ${req.userId}:`, error);
    next(error);
  }
};
