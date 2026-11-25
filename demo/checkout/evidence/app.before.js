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
  const amount = subtotal();
  lastOrder = { status: 'sending', amount };
  await fetch('/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: cart.items.map((i) => i.sku), code: cart.code, amount }),
  });
  lastOrder.status = 'placed';
  document.getElementById('result').textContent = 'Order placed. Thank you!';
});

render();

// What the app knows to be true, for Beam.
if (window.beam) {
  beam.expose('cart.total', () => total());
  beam.expose('order.amount', () => lastOrder.amount);
  beam.expose('order.status', () => lastOrder.status);
}
