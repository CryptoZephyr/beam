// Northwind Coffee demo: static checkout + a tiny orders API on http://127.0.0.1:4402
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const PRICES = { 'guji-250': 30, 'huila-250': 20 };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
const orders = [];

function createOrder({ items, code, amount }) {
  const subtotal = items.reduce((s, sku) => s + PRICES[sku], 0);
  const discount = code ? subtotal * 0.1 : 0;
  const expected = subtotal - discount;
  if (code && !discountCodes().has(code)) throw new Error(`unknown code ${code}`);
  const order = { id: orders.length + 1, items, code, amount, expected, at: new Date().toISOString() };
  orders.push(order);
  return order;
}

function discountCodes() {
  return new Set(fs.readFileSync(path.join(path.dirname(ROOT), 'codes.txt'), 'utf8').split(/\s+/).filter(Boolean));
}

http.createServer((req, res) => {
  if (req.url === '/api/orders' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const order = createOrder(JSON.parse(body));
        res.writeHead(201, { 'content-type': 'application/json' }).end(JSON.stringify(order));
      } catch (e) {
        res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ error: String(e.message) }));
      }
    });
    return;
  }
  if (req.url === '/api/orders') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(orders));
  const f = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) return res.writeHead(404).end('not found');
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'text/plain', 'cache-control': 'no-store' }).end(fs.readFileSync(f));
}).listen(4402, '127.0.0.1', () => console.log('Northwind Coffee on http://127.0.0.1:4402'));
