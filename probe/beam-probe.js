/* Beam probe. Dev builds only.
 * Lets your app report its own truth (values you expose, request status codes, JS errors,
 * localStorage) to the Beam bridge on your machine, so Beam can weigh Kane's verdict against it.
 *
 *   <script src="http://127.0.0.1:4330/beam-probe.js"></script>
 *   beam.expose('cart.total', () => cart.total)
 *
 * Safety: it does nothing on a page that isn't on your own machine (unless BEAM_PROBE_ALLOW is
 * set on purpose), it only ever talks to a bridge on 127.0.0.1, and it blanks out storage values
 * whose keys look like secrets.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.beam) return;

  var LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|.+\.localhost)$/i;
  var noop = { expose: function () {}, snapshot: function () {}, active: false };
  if (!LOOPBACK.test(location.hostname) && !window.BEAM_PROBE_ALLOW) {
    window.beam = noop;
    return;
  }

  var script = document.currentScript;
  var bridge = 'http://127.0.0.1:4330';
  try {
    var src = script && new URL(script.src);
    if (src && LOOPBACK.test(src.hostname)) bridge = src.origin;
  } catch (e) {}

  var SECRET = /(token|secret|password|passwd|auth|session|cookie|api[-_]?key|private)/i;
  var exposed = Object.create(null);
  var network = [];
  var errors = [];
  var page = Math.random().toString(36).slice(2, 10);
  var seq = 0;
  var timer = null;
  var origFetch = window.fetch ? window.fetch.bind(window) : null;

  function isBridge(url) { return String(url).indexOf(bridge) === 0; }
  function note(entry) { network.push(entry); if (network.length > 50) network.shift(); schedule('network'); }
  function abs(url) { try { return new URL(url, location.href).href; } catch (e) { return String(url); } }

  if (origFetch) {
    window.fetch = function (input, init) {
      var url = abs(typeof input === 'string' ? input : input && input.url);
      var method = (init && init.method) || (input && input.method) || 'GET';
      return origFetch(input, init).then(function (res) {
        if (!isBridge(url)) note({ method: method.toUpperCase(), url: url, status: res.status, ok: res.ok, at: Date.now() });
        return res;
      }, function (err) {
        if (!isBridge(url)) note({ method: method.toUpperCase(), url: url, status: 0, ok: false, error: String(err && err.message || err), at: Date.now() });
        throw err;
      });
    };
  }

  var XO = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
  if (XO) {
    var open = XO.open, sendX = XO.send;
    XO.open = function (method, url) { this.__beam = { method: String(method).toUpperCase(), url: abs(url) }; return open.apply(this, arguments); };
    XO.send = function () {
      var x = this;
      if (x.__beam && !isBridge(x.__beam.url)) x.addEventListener('loadend', function () {
        note({ method: x.__beam.method, url: x.__beam.url, status: x.status, ok: x.status >= 200 && x.status < 400, at: Date.now() });
      });
      return sendX.apply(this, arguments);
    };
  }

  window.addEventListener('error', function (e) { errors.push(String(e.message || 'error')); if (errors.length > 20) errors.shift(); schedule('error'); });
  window.addEventListener('unhandledrejection', function (e) { errors.push('Unhandled rejection: ' + String(e.reason && e.reason.message || e.reason)); schedule('error'); });

  function read() {
    var values = {};
    for (var k in exposed) {
      try { values[k] = exposed[k](); } catch (e) { values[k] = { error: String(e && e.message || e) }; }
    }
    var storage = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        storage[key] = SECRET.test(key) ? '[hidden by Beam]' : localStorage.getItem(key);
      }
    } catch (e) {}
    return { values: values, storage: storage, network: network.slice(-20), errors: errors.slice(-10) };
  }

  function send(reason) {
    if (!origFetch) return;
    var snap = read();
    snap.page = page; snap.seq = ++seq; snap.at = Date.now(); snap.url = location.href; snap.reason = reason;
    origFetch(bridge + '/snapshot', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(snap), keepalive: true }).catch(function () {});
  }
  function schedule(reason) { clearTimeout(timer); timer = setTimeout(function () { send(reason); }, 60); }

  if (window.MutationObserver) {
    new MutationObserver(function () { schedule('dom'); }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
  }
  window.addEventListener('load', function () { send('load'); });
  window.addEventListener('pagehide', function () { send('pagehide'); });

  window.beam = {
    active: true,
    expose: function (name, fn) { if (typeof fn === 'function') { exposed[String(name)] = fn; schedule('expose'); } },
    snapshot: function () { send('manual'); },
  };
})();
