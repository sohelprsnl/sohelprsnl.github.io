/* Visitor count in the footer, from GoatCounter (no cookies, no personal data).
   Each website shows its own number. The footer element says which pages to add up:
     data-paths="/a/,/a/index.html"   -> sum of those pages
     data-minus="/a/,/b/"             -> site total minus those pages (the portfolio)
   If GoatCounter cannot be reached, the line stays hidden. */
(function () {
  'use strict';
  var SITE = 'https://msr.goatcounter.com';   /* GoatCounter site code */
  var wrap = document.getElementById('visitorsWrap');
  var out = document.getElementById('visitorCount');
  if (!wrap || !out || !window.fetch || !window.Promise) return;
  var hour = Math.floor(Date.now() / 3600000);   /* a new copy every hour */
  function list(attr) {
    return (wrap.getAttribute(attr) || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function count(path) {
    return fetch(SITE + '/counter/' + encodeURI(path) + '.json?h=' + hour, { credentials: 'omit' })
      .then(function (r) {
        if (r.status === 404) return 0;              /* page not visited yet */
        if (!r.ok) throw new Error(r.status);
        return r.json().then(function (d) { return parseInt(String(d.count).replace(/[^0-9]/g, ''), 10) || 0; });
      })
      .catch(function () { return null; });           /* unreadable: count as 0, see below */
  }
  function ok(a) { return a.some(function (x) { return x !== null; }); }
  var paths = list('data-paths'), minus = list('data-minus'), jobs;
  if (paths.length) jobs = Promise.all(paths.map(count)).then(function (a) {
    if (!ok(a)) throw new Error('unreachable');
    return a.reduce(function (x, y) { return x + (y || 0); }, 0);
  });
  else jobs = Promise.all([count('TOTAL')].concat(minus.map(count))).then(function (a) {
    if (a[0] === null) throw new Error('unreachable');
    return a.slice(1).reduce(function (x, y) { return x - (y || 0); }, a[0]);
  });
  jobs.then(function (n) {
    out.textContent = Math.max(0, n).toLocaleString('en-US');
    wrap.hidden = false;
  }).catch(function () {});
})();
