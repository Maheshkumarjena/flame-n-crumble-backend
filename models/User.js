import mongoose from 'mongoose';
import bcrypt from 'bcryptjs'; // Import bcrypt for hashing verification tokens

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isVerified: { type: Boolean, default: false }, // New field: tracks if email is verified
  verificationToken: String, // New field: stores hashed verification token
  verificationTokenExpires: Date, // New field: stores expiry date for the token
  createdAt: { type: Date, default: Date.now },
});

// Indexes for faster queries
userSchema.index({ email: 1 });
userSchema.index({ verificationToken: 1 }); // New index for faster token lookups

// Method to compare hashed verification token
userSchema.methods.compareVerificationToken = async function(candidateToken) {
  // Use bcrypt.compare to compare the plaintext candidateToken with the stored hashed token
  // bcrypt.compare handles the hashing of candidateToken internally and then compares.
  return await bcrypt.compare(candidateToken, this.verificationToken);
};

export default mongoose.model('User', userSchema);
