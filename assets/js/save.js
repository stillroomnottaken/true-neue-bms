/* BMS: also saves each enquiry on the server (Admin → Inquiries) so a lead is not lost.
   The forms themselves are driven by main.js (identical to the static site): it validates and opens WhatsApp.
   This file only watches for the "WhatsApp should now be open" box and then sends a copy to the server. Never blocks anything. */
(function () {
  'use strict';
  var ENDPOINT = '/api/index.php?a=inquiry';
  document.querySelectorAll('form[data-kind]').forEach(function (form) {
    var box = form.querySelector('[data-sent]');
    if (!box || !('MutationObserver' in window)) return;
    var el = function (n) { return form.elements[n]; };
    var val = function (n) { return el(n) && el(n).value != null ? String(el(n).value).trim() : ''; };
    new MutationObserver(function () {
      if (!box.classList.contains('show')) return;
      var sel = el('material');
      var mat = sel.value === 'other' ? (val('other') || sel.options[sel.selectedIndex].text) : sel.options[sel.selectedIndex].text;
      var unit = el('unit');
      var payload = {
        role: form.getAttribute('data-kind') === 'supplier' ? 'supplier' : 'buyer',
        material: mat, qty: val('qty'), unit: unit ? unit.value : '', location: val('location'), notes: val('notes'),
        name: val('name'), company: val('company'), phone: val('phone'), email: val('email'),
        lang: form.getAttribute('data-lang') === 'id' ? 'id' : 'en', website: val('_gotcha')
      };
      try {
        fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin', keepalive: true }).catch(function () {});
      } catch (e) {}
    }).observe(box, { attributes: true, attributeFilter: ['class'] });
  });
})();
