const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const { protect, authorize } = require('../middleware/auth');
 
// POST /api/orders - Place order
router.post('/', protect, async (req, res) => {
  try {
    const { shippingAddress, paymentMethod, couponCode } = req.body;
 
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty.' });
    }
 
    // Build order items
    const orderItems = [];
    let itemsTotal = 0;
 
    for (const item of cart.items) {
      const product = item.product;
      if (!product || !product.isActive) {
        return res.status(400).json({ success: false, message: `Product "${product?.name}" is no longer available.` });
      }
 
      const sizeData = product.sizes.find(s => s.size === item.size);
      if (sizeData && sizeData.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for "${product.name}" in size ${item.size}.` });
      }
 
      orderItems.push({
        product: product._id,
        vendor: product.vendor,
        name: product.name,
        image: product.images[0] || '',
        price: product.discountPrice || product.price,
        quantity: item.quantity,
        size: item.size,
        color: item.color
      });
 
      itemsTotal += (product.discountPrice || product.price) * item.quantity;
    }
 
    const shippingCost = itemsTotal > 999 ? 0 : 99;
    const tax = Math.round(itemsTotal * 0.18); // 18% GST
    const discount = cart.discount || 0;
    const totalAmount = itemsTotal + shippingCost + tax - discount;
 
    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
      itemsTotal,
      shippingCost,
      tax,
      discount,
      totalAmount,
      couponCode,
      estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    });
 
    // Deduct stock
    for (const item of cart.items) {
      await Product.findOneAndUpdate(
        { _id: item.product._id, 'sizes.size': item.size },
        { $inc: { 'sizes.$.stock': -item.quantity, soldCount: item.quantity } }
      );
    }
 
    // Update vendor sales
    for (const item of orderItems) {
      await Vendor.findByIdAndUpdate(item.vendor, {
        $inc: { totalSales: item.quantity, totalRevenue: item.price * item.quantity }
      });
    }
 
    // Clear cart
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [], discount: 0, couponCode: '' });
 
    await order.populate('items.product', 'name images');
    res.status(201).json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// GET /api/orders/my - User's orders
router.get('/my', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product', 'name images')
      .sort('-createdAt');
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// GET /api/orders/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('items.product', 'name images category')
      .populate('items.vendor', 'brandName logo');
 
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
 
    // Allow user or admin
    if (!order.user._id.equals(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
 
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// PUT /api/orders/:id/status - Admin/Vendor update status
router.put('/:id/status', protect, authorize('admin', 'vendor'), async (req, res) => {
  try {
    const { status, note, trackingNumber } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        orderStatus: status,
        $push: { statusHistory: { status, note } },
        ...(trackingNumber && { trackingNumber }),
        ...(status === 'delivered' && { deliveredAt: new Date(), paymentStatus: 'paid' })
      },
      { new: true }
    );
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// PUT /api/orders/:id/cancel - User cancel order
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!['placed', 'confirmed'].includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage.' });
    }
    order.orderStatus = 'cancelled';
    order.statusHistory.push({ status: 'cancelled', note: req.body.reason || 'Cancelled by user' });
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// GET /api/orders/vendor/orders - Vendor sees their orders
router.get('/vendor/orders', protect, authorize('vendor'), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const orders = await Order.find({ 'items.vendor': vendor._id })
      .populate('user', 'name email')
      .populate('items.product', 'name images')
      .sort('-createdAt');
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
module.exports = router;
