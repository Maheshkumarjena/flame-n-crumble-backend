import mongoose from 'mongoose';

const wishlistItemSchema = new mongoose.Schema({
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product',
    required: true 
  },
  addedAt: { 
    type: Date, 
    default: Date.now 
  }
});

const wishlistSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    unique: true 
  },
  items: [wishlistItemSchema]
});

// Index for faster user wishlist queries
wishlistSchema.index({ user: 1 });

export default mongoose.model('Wishlist', wishlistSchema);