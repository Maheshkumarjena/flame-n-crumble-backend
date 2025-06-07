import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, enum: ['candles', 'cookies', 'chocolates'] },
  stock: { type: Number, default: 0 },
  image: { type: String, required: true },
  isFeatured: { type: Boolean, default: false },
});

// Indexes
productSchema.index({ category: 1, isFeatured: 1 });

export default mongoose.model('Product', productSchema);