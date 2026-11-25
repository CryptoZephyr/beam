const cart = { items: [{ sku: 'guji-250', price: 30 }, { sku: 'huila-250', price: 20 }], code: null, discount: 0 };
const money = (n) => '$' + n.toFixed(2);
const subtotal = () => cart.items.reduce((s, i) => s + i.price, 0);
const total = () => subtotal() - cart.discount;
let lastOrder = { status: 'none', amount: null };

function render() {
  document.getElementById('subtotal').textContent = money(subtotal());
  document.getElementById('discount-line').textContent = cart.discount ? '-' + money(cart.discount) : '$0.00';
  document.getElementById('total').textContent = money(total());
}

document.getElementById('discount').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = document.getElementById('code').value.trim().toUpperCase();
  const msg = document.getElementById('discount-msg');
  if (code === 'SAVE10') {
    cart.code = code;
    cart.discount = subtotal() * 0.1;
    msg.textContent = 'SAVE10 applied: 10% off.';
  } else {
    cart.code = null;
    cart.discount = 0;
    msg.textContent = 'That code isn\'t valid.';
  }
  render();
});

document.getElementById('place').addEventListener('click', async () => {
  // Charge the total the customer was shown, not the pre-discount subtotal.
  const amount = total();
  lastOrder = { status: 'sending', amount };
  const result = document.getElementById('result');
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: cart.items.map((i) => i.sku), code: cart.code, amount }),
    });
    if (!res.ok) throw new Error(`order rejected: ${res.status}`);
    lastOrder.status = 'placed';
    result.textContent = 'Order placed. Thank you!';
  } catch {
    // Never tell the customer an order was placed when the API did not accept it.
    lastOrder.status = 'failed';
    result.textContent = "We couldn't place your order. Nothing has been charged.";
  }
});

render();

// What the app knows to be true, for Beam.
if (window.beam) {
  beam.expose('cart.total', () => total());
  beam.expose('order.amount', () => lastOrder.amount);
  beam.expose('order.status', () => lastOrder.status);
}
