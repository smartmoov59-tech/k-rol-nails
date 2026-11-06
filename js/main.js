/* ==========================================================================
   K ROL NAILS : mouvement (GSAP + ScrollTrigger + Lenis)
   Règles : on n'anime que transform / opacity (hors révélations par masque),
   courbes expo/power3, stagger partout, version allégée sur mobile et si
   prefers-reduced-motion est activé.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.KROL || {};
  var html = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var isDesktop = function () { return window.innerWidth >= 900; };
  var hasGSAP = !!(window.gsap && window.ScrollTrigger);
  var lenis = null;
  var menuOpen = false;

  /* ================= Fonctions qui marchent sans animation ================= */

  function fillPrices() {
    $$('[data-price]').forEach(function (el) {
      var p = D.prix && D.prix[el.getAttribute('data-price')];
      if (p) el.textContent = p;
    });
  }

  function parisNow() {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
    var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
    var map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { day: map[o.weekday], h: parseInt(o.hour, 10) + parseInt(o.minute, 10) / 60 };
  }
  function openStatus() {
    if (!D.horaires) return;
    var n = parisNow(), t = D.horaires[n.day], open = !!(t && n.h >= t[0] && n.h < t[1]);
    var names = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    var msg;
    if (open) msg = 'Ouvert actuellement, jusqu\'à ' + t[1] + ' h.';
    else {
      var d = n.day, add = 0;
      if (t && n.h < t[0]) msg = 'Fermé pour le moment, ouverture à ' + t[0] + ' h.';
      else {
        do { d = (d + 1) % 7; add++; } while (!D.horaires[d] && add < 8);
        var nx = D.horaires[d];
        msg = 'Fermé pour le moment, réouverture ' + (add === 1 ? 'demain' : names[d]) + ' à ' + nx[0] + ' h.';
      }
    }
    $$('[data-open-status]').forEach(function (el) { el.classList.toggle('is-open', open); });
    $$('[data-open-status-long]').forEach(function (el) {
      var base = el.getAttribute('data-base');
      if (base === null) { base = el.textContent.trim(); el.setAttribute('data-base', base); }
      el.textContent = (base ? base + ' ' : '') + msg;
    });
    var row = $('.hours [data-day="' + n.day + '"]');
    if (row) row.classList.add('is-today');
  }

  function setYear() { $$('[data-year]').forEach(function (e) { e.textContent = new Date().getFullYear(); }); }

  function faq() {
    var items = $$('.faq__q');
    items.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        items.forEach(function (b) {
          b.setAttribute('aria-expanded', 'false');
          var p = document.getElementById(b.getAttribute('aria-controls')); if (p) p.classList.remove('is-open');
        });
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        var panel = document.getElementById(btn.getAttribute('aria-controls'));
        if (panel && !open) panel.classList.add('is-open');
        if (window.ScrollTrigger) setTimeout(function () { window.ScrollTrigger.refresh(); }, 700);
      });
    });
  }

  function heroMedia() {
    var v = $('.hero__video'); if (!v) return;
    var s = $('source', v);
    var small = window.innerWidth < 760 || (navigator.connection && navigator.connection.saveData);
    s.src = small ? s.getAttribute('data-src-mobile') : s.getAttribute('data-src-desktop');
    if (reduce) { v.removeAttribute('autoplay'); }
    v.load();
    if (!reduce) { var p = v.play(); if (p && p.catch) p.catch(function () { }); }
    var a = $('.ambiance__video');
    if (a && 'IntersectionObserver' in window && !reduce) {
      new IntersectionObserver(function (en) {
        en.forEach(function (x) { if (x.isIntersecting) { var q = a.play(); if (q && q.catch) q.catch(function () { }); } else a.pause(); });
      }, { threshold: .05 }).observe(a);
    }
  }

  /* Défilement doux des ancres */
  function anchors() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var t = $(id);
      if (!t) return;
      e.preventDefault();
      if (menuOpen) toggleMenu(false);
      if (lenis) lenis.scrollTo(t, { offset: -8, duration: 1.6, easing: function (x) { return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); } });
      else t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', id);
    });
  }

  /* Nav : se cache en descendant, revient en remontant, barre de progression */
  function navBehaviour() {
    var nav = $('[data-nav]'), bar = $('.progress span'), fab = $('.fab'), last = 0, ticking = false;
    function update() {
      var y = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
      nav.classList.toggle('is-solid', y > 40);
      if (!menuOpen) {
        if (y > last + 6 && y > 220) nav.classList.add('is-hidden');
        else if (y < last - 6 || y <= 220) nav.classList.remove('is-hidden');
      }
      if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
      if (fab) {
        var rs = $('#reserver'), inBook = false;
        if (rs) { var rr = rs.getBoundingClientRect(); inBook = rr.top < window.innerHeight * .5 && rr.bottom > window.innerHeight * .25; }
        fab.classList.toggle('is-on', y > window.innerHeight * .7 && !inBook);
      }
      last = y; ticking = false;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* Menu mobile plein écran */
  var menuEl, burger;
  function toggleMenu(open) {
    menuOpen = open;
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    menuEl.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) { menuEl.removeAttribute('inert'); menuEl.classList.add('is-open'); } else { menuEl.setAttribute('inert', ''); }
    $('[data-nav]').classList.remove('is-hidden');
    $('[data-nav]').classList.toggle('menu-open', open);
    if (lenis) { open ? lenis.stop() : lenis.start(); }
    else document.body.style.overflow = open ? 'hidden' : '';
    var bg = $('.menu__bg', menuEl), links = $$('.menu__links a, .menu__foot a', menuEl);
    if (hasGSAP && !reduce) {
      gsap.killTweensOf([bg, links]);
      if (open) {
        gsap.to(bg, { clipPath: 'circle(150% at calc(100% - 2.6rem) 2.6rem)', duration: 1.1, ease: 'expo.inOut' });
        gsap.fromTo(links, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: .06, delay: .35 });
      } else {
        gsap.to(links, { opacity: 0, duration: .25 });
        gsap.to(bg, { clipPath: 'circle(0% at calc(100% - 2.6rem) 2.6rem)', duration: .8, ease: 'expo.inOut', onComplete: function () { menuEl.classList.remove('is-open'); } });
      }
    } else {
      bg.style.clipPath = open ? 'none' : ''; if (!open) menuEl.classList.remove('is-open');
    }
  }
  function menu() {
    menuEl = $('#menu'); burger = $('.nav__burger');
    burger.addEventListener('click', function () { toggleMenu(!menuOpen); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) { toggleMenu(false); burger.focus(); } });
  }

  /* Carrousel d'avis : défilement, glisser-déposer, lecture auto */
  function carousel() {
    var root = $('[data-carousel]'); if (!root) return;
    var track = $('.avis__track', root), prev = $('[data-prev]', root), next = $('[data-next]', root);
    var paused = false, timer = null;
    function step() { var c = track.firstElementChild; return c ? c.getBoundingClientRect().width + 24 : 340; }
    function go(dir) {
      var atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
      if (dir > 0 && atEnd) track.scrollTo({ left: 0, behavior: reduce ? 'auto' : 'smooth' });
      else track.scrollBy({ left: dir * step(), behavior: reduce ? 'auto' : 'smooth' });
    }
    prev.addEventListener('click', function () { paused = true; go(-1); });
    next.addEventListener('click', function () { paused = true; go(1); });
    var down = false, sx = 0, sl = 0, moved = false;
    track.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = track.scrollLeft; });
    window.addEventListener('pointermove', function (e) { if (!down) return; var dx = e.clientX - sx; if (Math.abs(dx) > 4) { moved = true; track.classList.add('is-drag'); } track.scrollLeft = sl - dx; });
    window.addEventListener('pointerup', function () { if (!down) return; down = false; track.classList.remove('is-drag'); paused = true; });
    track.addEventListener('click', function (e) { if (moved) { e.preventDefault(); moved = false; } }, true);
    ['mouseenter', 'focusin'].forEach(function (ev) { root.addEventListener(ev, function () { paused = true; }); });
    track.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { go(1); } if (e.key === 'ArrowLeft') { go(-1); } });
    if (!reduce && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        clearInterval(timer);
        if (en[0].isIntersecting) timer = setInterval(function () { if (!paused) go(1); }, 5500);
      }, { threshold: .4 }).observe(root);
    }
  }

  /* ================= Outils d'animation ================= */

  /* Découpe un texte en mots / lettres (en conservant <em>), avec masque */
  function splitText(el, mode) {
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    var inner = [];
    function mk(cls, txt) { var s = document.createElement('span'); if (cls) s.className = cls; s.textContent = txt; return s; }
    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (part === '') return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            if (mode === 'words') {
              var w = mk('w'), i = mk('', part); w.appendChild(i); frag.appendChild(w); inner.push(i);
            } else {
              var wrap = document.createElement('span'); wrap.style.cssText = 'display:inline-block;white-space:nowrap';
              part.split('').forEach(function (c) { var i2 = mk(c === '-' ? 'ch ch--dash' : 'ch', c); wrap.appendChild(i2); inner.push(i2); });
              frag.appendChild(wrap);
            }
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    }
    walk(el);
    var wrapper = document.createElement('span'); wrapper.setAttribute('aria-hidden', 'true');
    while (el.firstChild) wrapper.appendChild(el.firstChild);
    var sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = text;
    el.appendChild(sr); el.appendChild(wrapper);
    return inner;
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ================= Animations ================= */

  function setupAnimations() {
    gsap.registerPlugin(ScrollTrigger);
    var mobile = !isDesktop();

    /* Smooth scroll global */
    if (!reduce && window.Lenis) {
      lenis = new Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true, touchMultiplier: 1.4 });
      window.__lenis = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    }

    /* États initiaux (masqués derrière le loader) */
    var heroChars = [];
    $$('.hero__line').forEach(function (l) { heroChars = heroChars.concat(splitText(l, 'chars')); });
    gsap.set(heroChars, { yPercent: 120 });
    gsap.set('[data-hero-script]', { opacity: 0 });

    /* Titres : mot par mot, masque qui monte */
    $$('[data-split="words"]').forEach(function (el) {
      if (el.classList.contains('ambiance__title')) return;
      var w = splitText(el, 'words');
      gsap.set(w, { yPercent: 115 });
      ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: function () { gsap.to(w, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: .07 }); } });
    });

    /* Manifeste : les mots s'allument au scroll */
    $$('[data-words]').forEach(function (el) {
      var w = splitText(el, 'words');
      gsap.set(w, { opacity: .16 });
      gsap.to(w, { opacity: 1, ease: 'none', stagger: .12, scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 55%', scrub: true } });
    });

    /* Apparitions génériques */
    $$('[data-reveal]').forEach(function (el) { gsap.set(el, { opacity: 0, y: 46 }); });
    ScrollTrigger.batch('[data-reveal]', { start: 'top 92%', once: true, onEnter: function (b) { gsap.to(b, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: .12 }); } });

    /* Images : rideau + déplacement dans le cadre */
    $$('[data-curtain]').forEach(function (f) {
      var host = f.classList.contains('arch') ? f : ($('.arch', f) || f);
      var c = document.createElement('span'); c.className = 'curtain'; host.appendChild(c);
      ScrollTrigger.create({ trigger: f, start: 'top 86%', once: true, onEnter: function () { gsap.to(c, { scaleY: 0, duration: 1.4, ease: 'expo.inOut' }); } });
    });
    $$('[data-img-parallax]').forEach(function (img) {
      var host = img.closest('.arch') || img.parentNode;
      gsap.fromTo(img, { yPercent: -11, scale: 1.25 }, { yPercent: 11, scale: 1.25, ease: 'none', scrollTrigger: { trigger: host, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* Parallax multicouche (hero) */
    $$('[data-parallax]').forEach(function (el) {
      var s = parseFloat(el.getAttribute('data-parallax')) * (mobile ? .5 : 1);
      gsap.to(el, { y: function () { return s * window.innerHeight; }, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
    });
    if (finePointer && !mobile) {
      $$('.hero__float .arch').forEach(function (a) {
        var depth = parseFloat(a.parentNode.getAttribute('data-depth')) || 30;
        var qx = gsap.quickTo(a, 'x', { duration: 1.2, ease: 'power3.out' }), qy = gsap.quickTo(a, 'y', { duration: 1.2, ease: 'power3.out' });
        $('.hero').addEventListener('pointermove', function (e) {
          qx((e.clientX / window.innerWidth - .5) * -depth); qy((e.clientY / window.innerHeight - .5) * -depth);
        });
      });
      var vid = $('.hero__video');
      var vx = gsap.quickTo(vid, 'x', { duration: 1.6, ease: 'power3.out' }), vy = gsap.quickTo(vid, 'y', { duration: 1.6, ease: 'power3.out' });
      $('.hero').addEventListener('pointermove', function (e) { vx((e.clientX / window.innerWidth - .5) * 24); vy((e.clientY / window.innerHeight - .5) * 14); });
    }

    /* Fleurs décoratives */
    $$('[data-spin]').forEach(function (el) { gsap.to(el, { rotation: 360, duration: 30, ease: 'none', repeat: -1 }); });
    $$('.hero__petal').forEach(function (el, i) { gsap.to(el, { rotation: i ? -360 : 360, duration: 40 + i * 12, ease: 'none', repeat: -1 }); });

    /* Marquees : vitesse et sens liés au scroll */
    var marquees = [];
    $$('[data-marquee]').forEach(function (row) {
      var dir = parseFloat(row.getAttribute('data-marquee')) || 1;
      var track = $('.marquee__track', row);
      var tw = gsap.fromTo(track, { xPercent: dir > 0 ? 0 : -50 }, { xPercent: dir > 0 ? -50 : 0, duration: 36, ease: 'none', repeat: -1 });
      marquees.push({ tw: tw, dir: dir, ts: 1 });
    });
    var vel = 0;
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: function (self) { vel = self.getVelocity(); } });
    gsap.ticker.add(function () {
      var boost = clamp(Math.abs(vel) / 350, 0, 7), sign = vel < -10 ? -1 : 1;
      marquees.forEach(function (m) {
        var target = (1 + boost) * sign;
        m.ts += (target - m.ts) * .08;
        m.tw.timeScale(m.ts);
      });
      vel *= .9;
    });

    /* Compteurs */
    $$('[data-count]').forEach(function (b) {
      var end = parseFloat(b.getAttribute('data-count')), o = { v: 0 }, stat = b.closest('.stat');
      ScrollTrigger.create({ trigger: b, start: 'top 90%', once: true, onEnter: function () {
        gsap.to(o, { v: end, duration: 2.6, ease: 'power3.out', onUpdate: function () { b.textContent = Math.round(o.v); }, onComplete: function () { if (stat) stat.classList.add('is-done'); } });
      } });
    });

    /* Section ambiance : le cercle s'agrandit, le texte monte */
    var amb = $('.ambiance');
    if (amb) {
      var clip = $('.ambiance__clip'), aw = splitText($('.ambiance__title'), 'words');
      gsap.set(aw, { yPercent: 115 }); gsap.set('.ambiance__script', { opacity: 0, y: 30 });
      var atl = gsap.timeline({ scrollTrigger: { trigger: amb, start: 'top top', end: 'bottom bottom', scrub: .6 } });
      atl.fromTo(clip, { clipPath: 'circle(12% at 50% 50%)' }, { clipPath: 'circle(78% at 50% 50%)', ease: 'none', duration: 1 }, 0)
         .fromTo('.ambiance__video', { scale: 1.3 }, { scale: 1, ease: 'none', duration: 1 }, 0)
         .to('.ambiance__script', { opacity: 1, y: 0, ease: 'power2.out', duration: .25 }, .45)
         .to(aw, { yPercent: 0, ease: 'power3.out', duration: .35, stagger: .06 }, .5);
    }

    /* Salon : photos en sens inverse */
    $$('[data-parallax-x]').forEach(function (el) {
      var v = parseFloat(el.getAttribute('data-parallax-x')) * (mobile ? .4 : 1);
      gsap.fromTo(el, { x: -v }, { x: v, ease: 'none', scrollTrigger: { trigger: '.salon', start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* Pied de page : lettres géantes */
    var fg = $('.footer__giant');
    if (fg) {
      var fc = splitText(fg, 'chars');
      gsap.set(fc, { yPercent: 115 });
      ScrollTrigger.create({ trigger: fg, start: 'top 95%', once: true, onEnter: function () { gsap.to(fc, { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: .05 }); } });
    }

    /* ---- Desktop : sections pinnées + défilement horizontal ---- */
    var mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', function () {
      /* Les 4 gestes : storytelling étape par étape */
      var steps = $$('.step');
      if (steps.length) {
        gsap.set(steps.slice(1), { autoAlpha: 0 });
        var tl = gsap.timeline({ scrollTrigger: { trigger: '.gestes', start: 'top top', end: 'bottom bottom', scrub: .7 } });
        tl.to({}, { duration: .8 });
        for (var i = 1; i < steps.length; i++) {
          var prev = steps[i - 1], cur = steps[i], T = tl.duration();
          tl.to(prev, { autoAlpha: 0, y: -60, duration: .5, ease: 'power2.in' }, T)
            .fromTo(cur, { autoAlpha: 0, y: 70 }, { autoAlpha: 1, y: 0, duration: .6, ease: 'power3.out' }, T + .25)
            .fromTo($('.step__img', cur), { rotation: 5, scale: .92 }, { rotation: 0, scale: 1, duration: .8, ease: 'power3.out' }, T + .25)
            .to({}, { duration: .8 });
        }
        gsap.to('.gestes__progress span', { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.gestes', start: 'top top', end: 'bottom bottom', scrub: true } });
      }

      /* Prestations : le scroll vertical fait défiler la piste */
      var sec = $('.hs'), track = $('.hs__track');
      if (sec && track) {
        var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
        var setH = function () { sec.style.height = (dist() + window.innerHeight) + 'px'; };
        setH();
        ScrollTrigger.addEventListener('refreshInit', setH);
        gsap.to(track, { x: function () { return -dist(); }, ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: .5, invalidateOnRefresh: true } });
        gsap.to('.hs__bar span', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: true } });
        var skew = gsap.quickTo(track, 'skewX', { duration: .6, ease: 'power3.out' });
        ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', onUpdate: function (self) { skew(clamp(self.getVelocity() / -500, -5, 5)); } });
        return function () { sec.style.height = ''; ScrollTrigger.removeEventListener('refreshInit', setH); };
      }
    });
    mm.add('(max-width: 899px)', function () {
      $$('.step').forEach(function (s) {
        gsap.from(s, { opacity: 0, y: 50, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 85%', once: true } });
      });
    });

    /* ---- Micro-interactions (souris) ---- */
    if (finePointer && !reduce) {
      /* Boutons magnétiques */
      $$('[data-magnetic]').forEach(function (b) {
        var qx = gsap.quickTo(b, 'x', { duration: .8, ease: 'elastic.out(1,.55)' }), qy = gsap.quickTo(b, 'y', { duration: .8, ease: 'elastic.out(1,.55)' });
        b.addEventListener('pointermove', function (e) {
          var r = b.getBoundingClientRect();
          qx((e.clientX - r.left - r.width / 2) * .32); qy((e.clientY - r.top - r.height / 2) * .4);
        });
        b.addEventListener('pointerleave', function () { qx(0); qy(0); });
      });
      /* Cartes : inclinaison 3D + reflet qui suit la souris */
      $$('[data-tilt]').forEach(function (c) {
        var glare = $('.card__glare', c);
        gsap.set(c, { transformPerspective: 900 });
        var rx = gsap.quickTo(c, 'rotationX', { duration: .7, ease: 'power3.out' }), ry = gsap.quickTo(c, 'rotationY', { duration: .7, ease: 'power3.out' });
        var gx = gsap.quickTo(glare, 'x', { duration: .5, ease: 'power3.out' }), gy = gsap.quickTo(glare, 'y', { duration: .5, ease: 'power3.out' });
        c.addEventListener('pointermove', function (e) {
          var r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
          ry(px * 12); rx(-py * 12); gx(e.clientX - r.left); gy(e.clientY - r.top);
          gsap.to(glare, { opacity: .9, duration: .4, overwrite: 'auto' });
        });
        c.addEventListener('pointerleave', function () { rx(0); ry(0); gsap.to(glare, { opacity: 0, duration: .6 }); });
      });
      /* Galerie : inclinaison légère */
      $$('[data-tilt-lite]').forEach(function (t) {
        t.setAttribute('tabindex', '0');
        var rx = gsap.quickTo(t, 'rotationX', { duration: .8, ease: 'power3.out' }), ry = gsap.quickTo(t, 'rotationY', { duration: .8, ease: 'power3.out' });
        gsap.set(t, { transformPerspective: 1000 });
        t.addEventListener('pointermove', function (e) {
          var r = t.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - .5) * 8); rx(-((e.clientY - r.top) / r.height - .5) * 8);
        });
        t.addEventListener('pointerleave', function () { rx(0); ry(0); });
      });
      /* Curseur : goutte de vernis */
      var cur = $('.cursor'), lab = $('.cursor__label', cur);
      var cx = gsap.quickTo(cur, 'x', { duration: .45, ease: 'power3.out' }), cy = gsap.quickTo(cur, 'y', { duration: .45, ease: 'power3.out' });
      document.addEventListener('pointermove', function (e) { cx(e.clientX); cy(e.clientY); if (cur.style.opacity !== '1') cur.style.opacity = '1'; });
      document.addEventListener('pointerover', function (e) {
        var t = e.target.closest('a, button, .tile, .card, label.chip, .day, .slot');
        if (!t) { cur.classList.remove('is-hover'); gsap.to(cur, { scale: 1, duration: .5, ease: 'power3.out' }); return; }
        var big = t.matches('.tile, .card');
        lab.textContent = t.matches('.tile') ? 'Voir' : '';
        cur.classList.toggle('is-hover', big);
        gsap.to(cur, { scale: big ? 1.9 : 1.5, duration: .5, ease: 'power3.out' });
      });
      document.addEventListener('pointerleave', function () { cur.style.opacity = '0'; });
    }

    /* Téléphone du CTA : micro-pulsation */
    gsap.to('.reserver__tel svg', { scale: 1.15, duration: .9, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  /* ================= Loader → entrée du hero ================= */

  function heroIntro() {
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('.hero__media', { scale: 1.3, duration: 2.8, ease: 'power3.out' }, 0)
      .to($$('.hero__line .ch'), { yPercent: 0, duration: 1.6, stagger: .07 }, .05)
      .fromTo('[data-hero-script]', { opacity: 0, y: 30, rotation: -14 }, { opacity: 1, y: 0, rotation: -5, duration: 1.4 }, .75)
      .from('.hero__kicker, .hero__lead, .hero__cta > *', { opacity: 0, y: 30, duration: 1.1, stagger: .1 }, .85)
      .from('.hero__float .arch', { opacity: 0, scale: .85, rotation: 5, duration: 1.7, stagger: .2 }, .6)
      .from('.hero__petal', { opacity: 0, scale: 0, duration: 1.6, stagger: .15, ease: 'back.out(1.6)' }, 1.1)
      .from('.nav', { yPercent: -100, duration: 1.2, clearProps: 'transform' }, .9)
      .from('.hero__scroll', { opacity: 0, duration: 1 }, 1.6);
  }

  function runLoader(done) {
    var loader = $('.loader');
    if (!loader) { done(); return; }
    if (lenis) lenis.stop();
    gsap.set('.loader__fill', { svgOrigin: '60 200', scaleY: 0 });
    var count = $('[data-loader-count]'), o = { v: 0 };
    var minDone = new Promise(function (res) {
      gsap.timeline({ onComplete: res })
        .to('.loader__outline', { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut' }, 0)
        .to('.loader__fill', { scaleY: 1, duration: 2, ease: 'power2.inOut' }, .4)
        .to(o, { v: 100, duration: 2.2, ease: 'power2.inOut', onUpdate: function () { count.textContent = Math.round(o.v); } }, 0);
    });
    var vid = $('.hero__video');
    var vidReady = new Promise(function (res) {
      if (!vid || vid.readyState >= 3) return res();
      vid.addEventListener('canplay', res, { once: true }); vid.addEventListener('error', res, { once: true });
      setTimeout(res, 3000);
    });
    var fonts = Promise.race([
      (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve(),
      new Promise(function (res) { setTimeout(res, 2600); })
    ]);
    Promise.all([minDone, vidReady, fonts]).then(function () {
      var out = gsap.timeline({ onComplete: function () { loader.remove(); if (lenis) lenis.start(); ScrollTrigger.refresh(); } });
      out.to('.loader__inner', { yPercent: -30, opacity: 0, duration: .7, ease: 'power3.in' })
         .to('.loader__strips i', { yPercent: -101, duration: 1.2, ease: 'expo.inOut', stagger: { each: .08, from: 'center' } }, '-=.35')
         .add(done, '-=.9');
    });
  }

  /* ================= Démarrage ================= */

  fillPrices(); openStatus(); setYear(); faq(); menu(); carousel(); heroMedia(); anchors(); navBehaviour();

  if (!hasGSAP) {
    html.classList.add('no-anim');
    var l = $('.loader'); if (l) l.remove();
    return;
  }
  if (reduce) {
    html.classList.add('no-anim');
    var l2 = $('.loader'); if (l2) l2.remove();
    return;
  }

  setupAnimations();
  runLoader(heroIntro);
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
})();
