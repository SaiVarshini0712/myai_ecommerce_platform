
const mongoose = require('mongoose');
 
const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  size: String,
  color: String,
  price: Number
});
 
const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  couponCode: String,
  discount: { type: Number, default: 0 }
}, { timestamps: true });
 
// Virtual total
cartSchema.virtual('total').get(function () {
  return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
});
 
cartSchema.set('toJSON', { virtuals: true });
cartSchema.set('toObject', { virtuals: true });
 
module.exports = mongoose.model('Cart', cartSchema);
