/* ==========================================================================
   Réservation 100 % statique : aucun serveur, aucun abonnement.
   Le formulaire prépare un SMS (sms:), un e-mail (mailto:) ou un fichier
   agenda (.ics). L'envoi se fait depuis le téléphone du client.
   ========================================================================== */
(function () {
  'use strict';
  var D = window.KROL;
  var form = document.getElementById('booking');
  if (!form || !D) return;

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var panels = $$('.book__panel', form);
  var stepper = $$('.book__steps li', form);
  var current = 1;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var jourFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  var wdFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
  var moFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(h) { var H = Math.floor(h); return pad(H) + ':' + (h % 1 ? '30' : '00'); }
  function hLabel(v) { var p = v.split(':'); return parseInt(p[0], 10) + 'h' + p[1]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- Prestations ---------- */
  var prestaList = $('#prestaList');
  prestaList.innerHTML = D.prestations.map(function (p) {
    return '<label class="chip"><input type="checkbox" name="presta" value="' + esc(p.id) + '"><span>' + esc(p.nom) + '</span></label>';
  }).join('');

  /* ---------- Jours ouverts ---------- */
  function slotsFor(date) {
    var h = D.horaires[date.getDay()];
    if (!h) return [];
    var out = [];
    var last = Math.min(D.creneaux.fin, h[1] - 1.5);
    var now = new Date();
    for (var t = Math.max(D.creneaux.debut, h[0]); t <= last + 1e-6; t += D.creneaux.pas) {
      var s = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(t), t % 1 ? 30 : 0);
      if (s.getTime() > now.getTime() + 2 * 3600 * 1000) out.push(hm(t));
    }
    return out;
  }
  var days = [];
  (function buildDays() {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    var guard = 0;
    while (days.length < D.joursAffiches && guard++ < 60) {
      var slots = slotsFor(d);
      if (slots.length) days.push({ date: new Date(d), iso: iso(d), slots: slots });
      d.setDate(d.getDate() + 1);
    }
  })();
  var dayList = $('#dayList');
  /* Calendrier : une colonne par jour d'ouverture (lun-ven), le premier jour se place dans sa colonne */
  var openWd = [1, 2, 3, 4, 5, 6, 0].filter(function (d) { return D.horaires[d]; });
  dayList.style.setProperty('--cols', openWd.length);
  dayList.innerHTML = days.map(function (x, i) {
    var col = i === 0 ? ' style="grid-column-start:' + (openWd.indexOf(x.date.getDay()) + 1) + '"' : '';
    return '<label class="day"' + col + '><input type="radio" name="jour" value="' + x.iso + '"><span><b>' + wdFmt.format(x.date).replace('.', '') +
      '</b><strong>' + x.date.getDate() + '</strong><i>' + moFmt.format(x.date).replace('.', '') + '</i></span></label>';
  }).join('');

  var slotList = $('#slotList');
  dayList.addEventListener('change', function (e) {
    if (e.target.name !== 'jour') return;
    var day = days.filter(function (x) { return x.iso === e.target.value; })[0];
    slotList.innerHTML = day.slots.map(function (s) {
      return '<label class="slot"><input type="radio" name="heure" value="' + s + '"><span>' + hLabel(s) + '</span></label>';
    }).join('');
    hideError('jour');
  });
  slotList.addEventListener('change', function () { hideError('heure'); });
  prestaList.addEventListener('change', function () { hideError('presta'); });

  /* ---------- Navigation entre étapes ---------- */
  function showError(key, focusEl) {
    var el = $('[data-error="' + key + '"]', form);
    if (el) el.hidden = false;
    if (focusEl) focusEl.focus({ preventScroll: false });
  }
  function hideError(key) { var el = $('[data-error="' + key + '"]', form); if (el) el.hidden = true; }

  function validate(step) {
    if (step === 1) {
      if (!$$('input[name="presta"]:checked', form).length) { showError('presta', $('input[name="presta"]', form)); return false; }
    }
    if (step === 2) {
      if (!$('input[name="jour"]:checked', form)) { showError('jour', $('input[name="jour"]', form)); return false; }
      if (!$('input[name="heure"]:checked', form)) { showError('heure', $('input[name="heure"]', form)); return false; }
    }
    if (step === 3) {
      var p = $('#f-prenom');
      if (!p.value.trim()) { showError('prenom', p); return false; }
      hideError('prenom');
    }
    return true;
  }

  function go(n) {
    var from = panels[current - 1], to = panels[n - 1];
    current = n;
    stepper.forEach(function (li, i) {
      li.classList.toggle('is-active', i === n - 1);
      li.classList.toggle('is-done', i < n - 1);
    });
    from.hidden = true; to.hidden = false;
    if (window.gsap && !reduce) {
      window.gsap.fromTo(to, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: .7, ease: 'expo.out', clearProps: 'transform,opacity' });
    }
    if (n === 4) fillRecap();
    /* Recadre le formulaire : centré s'il tient dans l'écran, sinon calé sous le menu */
    var rect = form.getBoundingClientRect(), vh = window.innerHeight;
    var wanted = rect.height + 110 < vh ? Math.max(90, (vh - rect.height) / 2) : 90;
    if (Math.abs(rect.top - wanted) > 40) {
      var y = window.scrollY + rect.top - wanted;
      if (window.__lenis) window.__lenis.scrollTo(y, { duration: 1 }); else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    }
    var f = to.querySelector('input:not([type=hidden]), textarea, button');
    if (f && n !== 4) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) { } }, 60);
  }

  form.addEventListener('click', function (e) {
    var b = e.target.closest('[data-next], [data-prev]');
    if (!b) return;
    if (b.hasAttribute('data-next')) { if (validate(current)) go(current + 1); }
    else go(current - 1);
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'radio') {
      e.preventDefault();
      if (validate(current) && current < 4) go(current + 1);
    }
  });

  /* ---------- Récapitulatif + liens d'envoi ---------- */
  function data() {
    var presta = $$('input[name="presta"]:checked', form).map(function (i) {
      return D.prestations.filter(function (p) { return p.id === i.value; })[0].nom;
    });
    var jourIso = ($('input[name="jour"]:checked', form) || {}).value;
    var heure = ($('input[name="heure"]:checked', form) || {}).value;
    var date = jourIso ? new Date(jourIso + 'T' + heure + ':00') : null;
    return {
      presta: presta,
      lieu: $('input[name="lieu"]:checked', form).value,
      date: date, heure: heure,
      prenom: $('#f-prenom').value.trim(),
      tel: $('#f-tel').value.trim(),
      note: $('#f-note').value.trim()
    };
  }
  function creneauTxt(d) { return jourFmt.format(d.date) + ' à ' + hLabel(d.heure); }
  function message(d) {
    var m = 'Bonjour Carole, c\'est ' + d.prenom + '. Je souhaite prendre rendez-vous chez K Rol Nails (' + d.lieu + ') pour : ' + d.presta.join(', ') +
      '. Créneau souhaité : ' + creneauTxt(d) + '.';
    if (d.note) m += ' ' + d.note + (/[.!?…]$/.test(d.note) ? '' : '.');
    if (d.tel) m += ' Mon numéro : ' + d.tel + '.';
    return m + ' Pouvez-vous me confirmer ? Merci !';
  }
  function fillRecap() {
    var d = data();
    $('[data-recap="presta"]').textContent = d.presta.join(', ');
    $('[data-recap="lieu"]').textContent = d.lieu.charAt(0).toUpperCase() + d.lieu.slice(1);
    $('[data-recap="creneau"]').textContent = creneauTxt(d);
    $('[data-recap="prenom"]').textContent = d.prenom;
    var msg = message(d);
    $('[data-send="sms"]').href = 'sms:' + D.tel + '?&body=' + encodeURIComponent(msg);
    $('[data-send="mail"]').href = 'mailto:' + D.email + '?subject=' + encodeURIComponent('Demande de rendez-vous : ' + d.prenom) + '&body=' + encodeURIComponent(msg);
    ensureCopy(msg);
  }

  function ensureCopy(msg) {
    var send = $('.send', form), btn = $('[data-send="copy"]', form);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button'; btn.setAttribute('data-send', 'copy'); btn.className = 'btn btn--ghost-light';
      btn.innerHTML = '<span class="btn__label">Copier le message</span>';
      send.appendChild(btn);
    }
    btn.onclick = function () {
      var label = btn.querySelector('.btn__label');
      function ok() { label.textContent = 'Message copié'; setTimeout(function () { label.textContent = 'Copier le message'; }, 2200); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(msg).then(ok, function () { window.prompt('Copiez ce message :', msg); });
      else window.prompt('Copiez ce message :', msg);
    };
  }

  /* Fichier agenda .ics (heure locale, événement provisoire) */
  function icsDate(d) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00'; }
  function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  $('[data-send="ics"]', form).addEventListener('click', function () {
    var d = data();
    var end = new Date(d.date.getTime() + 60 * 60 * 1000);
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//K Rol Nails//Reservation//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + Date.now() + '@krolnails',
      'DTSTAMP:' + stamp,
      'DTSTART:' + icsDate(d.date),
      'DTEND:' + icsDate(end),
      'SUMMARY:' + icsEsc('RDV K Rol Nails (à confirmer)'),
      'LOCATION:' + icsEsc(d.lieu.indexOf('domicile') > -1 ? 'À domicile (secteur 04)' : '10 boulevard Gassendi, 04000 Digne-les-Bains'),
      'DESCRIPTION:' + icsEsc('Prestation(s) : ' + d.presta.join(', ') + '. Créneau souhaité, à confirmer par Carole (' + D.telAffiche + '). Durée indicative : 1 h.'),
      'STATUS:TENTATIVE',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Rendez-vous K Rol Nails', 'TRIGGER:-PT2H', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ];
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'rdv-k-rol-nails.ics';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  });

  /* Pré-sélection depuis les cartes « Réserver » */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-presta]');
    if (!a) return;
    var box = $('input[name="presta"][value="' + a.getAttribute('data-presta') + '"]', form);
    if (box) { box.checked = true; hideError('presta'); }
    if (current !== 1) go(1);
  });
})();
