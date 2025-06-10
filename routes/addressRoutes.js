// routes/addressRoutes.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { 
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
} from '../controllers/addressController.js';

const router = express.Router();

// All address routes should be protected 
router.use(authenticate); // Applies 'protect' middleware to all routes below this line 

router.route('/')
  .get(getUserAddresses) // GET /api/addresses - Get all addresses for user
  .post(createAddress); // POST /api/addresses - Add a new address

router.route('/:id')
  .put(updateAddress)   // PUT /api/addresses/:id - Update an address
  .delete(deleteAddress); // DELETE /api/addresses/:id - Delete an address

router.patch('/:id/set-default', setDefaultAddress); // PATCH /api/addresses/:id/set-default - Set as default

export default router;
