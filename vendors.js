const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protect, authorize } = require('../middleware/auth');
 
// GET /api/vendors - List all vendors
router.get('/', async (req, res) => {
  try {
    const vendors = await Vendor.find({ isActive: true })
      .populate('user', 'name email avatar')
      .sort('-rating');
    res.json({ success: true, vendors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// GET /api/vendors/:slug
router.get('/:slug', async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ slug: req.params.slug, isActive: true })
      .populate('user', 'name avatar');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found.' });
 
    const products = await Product.find({ vendor: vendor._id, isActive: true }).limit(20);
    res.json({ success: true, vendor, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// POST /api/vendors/register - Vendor registration
router.post('/register', protect, async (req, res) => {
  try {
    const existing = await Vendor.findOne({ user: req.user._id });
    if (existing) return res.status(400).json({ success: false, message: 'Already have a vendor account.' });
 
    const vendor = await Vendor.create({ ...req.body, user: req.user._id });
 
    // Update user role
    await require('../models/User').findByIdAndUpdate(req.user._id, { role: 'vendor' });
 
    res.status(201).json({ success: true, vendor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// GET /api/vendors/dashboard/stats - Vendor dashboard
router.get('/dashboard/stats', protect, authorize('vendor'), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
 
    const [totalProducts, activeProducts, recentOrders] = await Promise.all([
      Product.countDocuments({ vendor: vendor._id }),
      Product.countDocuments({ vendor: vendor._id, isActive: true }),
      Order.find({ 'items.vendor': vendor._id }).sort('-createdAt').limit(10)
        .populate('user', 'name').populate('items.product', 'name')
    ]);
 
    // Monthly revenue
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
 
    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          'items.vendor': vendor._id,
          createdAt: { $gte: sixMonthsAgo },
          paymentStatus: 'paid'
        }
      },
      { $unwind: '$items' },
      { $match: { 'items.vendor': vendor._id } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
 
    res.json({
      success: true,
      stats: {
        totalProducts,
        activeProducts,
        totalSales: vendor.totalSales,
        totalRevenue: vendor.totalRevenue,
        rating: vendor.rating,
        recentOrders,
        monthlyRevenue
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// PUT /api/vendors/profile - Update vendor profile
router.put('/profile', protect, authorize('vendor'), async (req, res) => {
  try {
    const vendor = await Vendor.findOneAndUpdate(
      { user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    res.json({ success: true, vendor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// Admin verify vendor
router.put('/:id/verify', protect, authorize('admin'), async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, { isVerified: true }, { new: true });
    res.json({ success: true, vendor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
module.exports = router;
