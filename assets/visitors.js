/* Visitor count in the footer, from GoatCounter (no cookies, no personal data).
   The page counts itself through assets/goatcounter.js; this file only shows the
   site total. If GoatCounter cannot be reached, the line stays hidden. */
(function () {
  'use strict';
  var SITE = 'https://msr.goatcounter.com';   /* GoatCounter site code */
  var wrap = document.getElementById('visitorsWrap');
  var out = document.getElementById('visitorCount');
  if (!wrap || !out || !window.fetch) return;
  fetch(SITE + '/counter/TOTAL.json?h=' + Math.floor(Date.now() / 3600000), { credentials: 'omit' })   /* new copy every hour */
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      if (!d || !d.count) return;
      out.textContent = d.count;
      wrap.hidden = false;
    })
    .catch(function () {});
})();
