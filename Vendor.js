const mongoose = require('mongoose');
 
const vendorSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  brandName: {
    type: String,
    required: [true, 'Brand name is required'],
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: String,
  logo: String,
  banner: String,
  categories: [String],
  contactEmail: String,
  phone: String,
  address: {
    street: String,
    city: String,
    state: String,
    zip: String,
    country: String
  },
  bankDetails: {
    accountName: String,
    accountNumber: String,
    bankName: String,
    ifscCode: String
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rating: {
    type: Number,
    default: 0
  },
  totalSales: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  commissionRate: {
    type: Number,
    default: 0.1  // 10% platform commission
  },
  socialLinks: {
    instagram: String,
    facebook: String,
    website: String
  }
}, { timestamps: true });
 
// Auto-generate slug from brandName
vendorSchema.pre('save', function (next) {
  if (this.isModified('brandName')) {
    this.slug = this.brandName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
  next();
});
 
module.exports = mongoose.model('Vendor', vendorSchema);
