import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String, required: true },
  bestseller: { type: Boolean, default: false },
  isNew: { type: Boolean, default: false },
  category: { type: String, enum: ['candles', 'cookies', 'chocolates'] },
  stock: { type: Number, default: 0 },
  image: { type: String, required: true },
  isFeatured: { type: Boolean, default: false },
});

// Indexes for query optimization
productSchema.index({ category: 1, isFeatured: 1 });
productSchema.index({ createdAt: -1 });  // For sorting by newest
productSchema.index({ price: 1 });       // For price filtering
productSchema.index({ stock: 1 });       // For stock availability checks
productSchema.index({ name: 'text' });   // For full-text search

export default mongoose.model('Product', productSchema);