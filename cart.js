const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');
 
// GET /api/cart
router.get('/', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'name images price discountPrice sizes isActive vendor')
      .populate('items.product.vendor', 'brandName');
 
    if (!cart) return res.json({ success: true, cart: { items: [], total: 0 } });
    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// POST /api/cart/add
router.post('/add', protect, async (req, res) => {
  try {
    const { productId, quantity = 1, size, color } = req.body;
 
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not available.' });
    }
 
    // Check stock
    if (size) {
      const sizeData = product.sizes.find(s => s.size === size);
      if (!sizeData || sizeData.stock < quantity) {
        return res.status(400).json({ success: false, message: 'Insufficient stock.' });
      }
    }
 
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }
 
    const existingIdx = cart.items.findIndex(
      item => item.product.equals(productId) && item.size === size && item.color === color
    );
 
    if (existingIdx > -1) {
      cart.items[existingIdx].quantity += quantity;
    } else {
      cart.items.push({
        product: productId,
        quantity,
        size,
        color,
        price: product.discountPrice || product.price
      });
    }
 
    await cart.save();
    await cart.populate('items.product', 'name images price discountPrice sizes');
    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// PUT /api/cart/update/:itemId
router.put('/update/:itemId', protect, async (req, res) => {
  try {
    const { quantity } = req.body;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found.' });
 
    const item = cart.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found in cart.' });
 
    if (quantity <= 0) {
      item.deleteOne();
    } else {
      item.quantity = quantity;
    }
 
    await cart.save();
    await cart.populate('items.product', 'name images price discountPrice sizes');
    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// DELETE /api/cart/remove/:itemId
router.delete('/remove/:itemId', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found.' });
 
    cart.items = cart.items.filter(item => !item._id.equals(req.params.itemId));
    await cart.save();
    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// DELETE /api/cart/clear
router.delete('/clear', protect, async (req, res) => {
  try {
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });
    res.json({ success: true, message: 'Cart cleared.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// POST /api/cart/coupon
router.post('/coupon', protect, async (req, res) => {
  try {
    const { code } = req.body;
    // Simple hardcoded coupons for demo
    const coupons = { 'SAVE10': 10, 'FIRST20': 20, 'FASHION15': 15 };
    const discount = coupons[code.toUpperCase()];
    if (!discount) return res.status(400).json({ success: false, message: 'Invalid coupon code.' });
 
    const cart = await Cart.findOneAndUpdate(
      { user: req.user._id },
      { couponCode: code.toUpperCase(), discount },
      { new: true }
    );
    res.json({ success: true, discount, message: `${discount}% discount applied!`, cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
module.exports = router;
