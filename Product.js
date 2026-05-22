const mongoose = require('mongoose');
 
const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: String,
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: String
}, { timestamps: true });
 
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  aiDescription: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  discountPrice: {
    type: Number,
    default: null
  },
  category: {
    type: String,
    required: true,
    enum: ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories', 'activewear', 'formal']
  },
  subCategory: String,
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  images: [String],
  sizes: [{
    size: String,
    stock: { type: Number, default: 0 }
  }],
  colors: [String],
  tags: [String],
  material: String,
  gender: {
    type: String,
    enum: ['men', 'women', 'unisex', 'kids'],
    default: 'unisex'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  reviews: [reviewSchema],
  rating: {
    type: Number,
    default: 0
  },
  numReviews: {
    type: Number,
    default: 0
  },
  soldCount: {
    type: Number,
    default: 0
  },
  aiEmbedding: {
    type: [Number],
    default: []
  }
}, { timestamps: true });
 
// Update rating on review addition
productSchema.methods.updateRating = function () {
  if (this.reviews.length === 0) {
    this.rating = 0;
    this.numReviews = 0;
  } else {
    const total = this.reviews.reduce((sum, r) => sum + r.rating, 0);
    this.rating = (total / this.reviews.length).toFixed(1);
    this.numReviews = this.reviews.length;
  }
};
 
// Text index for search
productSchema.index({ name: 'text', description: 'text', tags: 'text', category: 'text' });
 
module.exports = mongoose.model('Product', productSchema);
