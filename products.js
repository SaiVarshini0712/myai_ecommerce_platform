const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const { protect, authorize } = require('../middleware/auth');
 
// GET /api/products - List with filters + pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1, limit = 12, category, gender, minPrice, maxPrice,
      sort = '-createdAt', search, vendor, featured, color, size
    } = req.query;
 
    const filter = { isActive: true };
    if (category) filter.category = category;
    if (gender) filter.gender = gender;
    if (vendor) filter.vendor = vendor;
    if (featured) filter.isFeatured = true;
    if (color) filter.colors = { $in: [color] };
    if (size) filter['sizes.size'] = size;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (search) {
      filter.$text = { $search: search };
    }
 
    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate('vendor', 'brandName logo slug rating')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));
 
    res.json({
      success: true,
      products,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
        limit: Number(limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// GET /api/products/featured
router.get('/featured', async (req, res) => {
  try {
    const products = await Product.find({ isFeatured: true, isActive: true })
      .populate('vendor', 'brandName logo slug')
      .limit(8);
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('vendor', 'brandName logo slug description rating totalSales socialLinks')
      .populate('reviews.user', 'name avatar');
 
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// POST /api/products - Vendor creates product
router.post('/', protect, authorize('vendor', 'admin'), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(403).json({ success: false, message: 'No vendor profile found.' });
 
    const product = await Product.create({ ...req.body, vendor: vendor._id });
    res.status(201).json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// PUT /api/products/:id
router.put('/:id', protect, authorize('vendor', 'admin'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
 
    // Check vendor ownership unless admin
    if (req.user.role !== 'admin') {
      const vendor = await Vendor.findOne({ user: req.user._id });
      if (!product.vendor.equals(vendor._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to edit this product.' });
      }
    }
 
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, product: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// DELETE /api/products/:id
router.delete('/:id', protect, authorize('vendor', 'admin'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
 
    if (req.user.role !== 'admin') {
      const vendor = await Vendor.findOne({ user: req.user._id });
      if (!product.vendor.equals(vendor._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized.' });
      }
    }
 
    await product.deleteOne();
    res.json({ success: true, message: 'Product deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// POST /api/products/:id/reviews
router.post('/:id/reviews', protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
 
    const alreadyReviewed = product.reviews.find(r => r.user.equals(req.user._id));
    if (alreadyReviewed) return res.status(400).json({ success: false, message: 'You already reviewed this product.' });
 
    product.reviews.push({ user: req.user._id, name: req.user.name, rating, comment });
    product.updateRating();
    await product.save();
 
    res.status(201).json({ success: true, message: 'Review added.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
module.exports = router;
