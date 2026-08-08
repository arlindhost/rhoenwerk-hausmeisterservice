/* RHÖNWERK — Interaktionen */

var htmlEl = document.documentElement;
htmlEl.classList.add('js');

// Eingangs-Zustand aktivieren (Hero als Vorhang) — Deep-Links (#anker) überspringen ihn
(function () {
  var hero = document.querySelector('.hero');
  var chip = document.getElementById('gate-open');
  if (hero && chip && !location.hash) {
    htmlEl.classList.add('gate');
  }
})();

// Scroll-Effekte warten hinter dem Eingang: Sie starten erst, wenn er sich öffnet,
// damit die Inhalte sichtbar einfliegen, während sich der Vorhang hebt.
var pendingFX = [];

function startFX() {
  var fns = pendingFX;
  pendingFX = [];
  fns.forEach(function (fn) { fn(); });
}

function scheduleFX(fn) {
  if (htmlEl.classList.contains('gate')) {
    pendingFX.push(fn);
  } else {
    fn();
  }
}

// Ladescreen: großes Logo erscheint, wandert dann an seine Header-Position
(function () {
  var pre = document.getElementById('preloader');
  var preLogo = document.getElementById('preloader-logo');
  var headerLogo = document.querySelector('.site-header .logo');

  function done() {
    if (!htmlEl.classList.contains('preload')) return;
    htmlEl.classList.remove('preload');
    htmlEl.classList.add('intro-done');
    if (pre) {
      pre.classList.add('preloader-hide');
      setTimeout(function () { if (pre.parentNode) pre.parentNode.removeChild(pre); }, 450);
    }
  }

  if (!pre || !preLogo || !headerLogo || !htmlEl.classList.contains('preload')) {
    done();
    return;
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var t0 = Date.now();

  function go() {
    /* Ladescreen mindestens kurz zeigen, damit die Logo-Animation wirkt */
    var wait = Math.max(0, 1100 - (Date.now() - t0));
    setTimeout(function () {
      if (reduce) { done(); return; }
      /* Einblend-Animation beenden, sonst überstimmt ihr Fill-Modus den Inline-Transform */
      preLogo.style.animation = 'none';
      var from = preLogo.getBoundingClientRect();
      var to = headerLogo.getBoundingClientRect();
      preLogo.style.transition = 'transform 0.8s cubic-bezier(0.76, 0, 0.24, 1)';
      preLogo.style.transform =
        'translate(' + (to.left - from.left) + 'px,' + (to.top - from.top) + 'px) ' +
        'scale(' + (to.width / from.width) + ')';
      preLogo.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 1000); /* Fallback */
    }, wait);
  }

  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go);
})();

// Gestaffelte Einflug-Animationen: Kinder von [data-stagger] werden zu Reveals mit Verzögerung
(function () {
  document.querySelectorAll('.section-top').forEach(function (el) {
    el.classList.add('reveal');
  });
  document.querySelectorAll('[data-stagger]').forEach(function (wrap) {
    var cols = parseInt(wrap.getAttribute('data-stagger-dir'), 10) || 0;
    Array.prototype.forEach.call(wrap.children, function (child, i) {
      child.classList.add('reveal');
      child.style.setProperty('--d', (i * 0.11).toFixed(2) + 's');
      /* Spaltenweise Einflug-Richtung: links / unten / rechts */
      if (cols > 1) {
        if (i % cols === 0) child.classList.add('from-left');
        else if (i % cols === cols - 1) child.classList.add('from-right');
      }
    });
  });
})();

// Reveal-on-Scroll (hinter dem Eingang aufgeschoben)
scheduleFX(function () {
  var els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  var vh = window.innerHeight;
  els.forEach(function (el) {
    var r = el.getBoundingClientRect();
    if (r.top < vh * 0.95 && r.bottom > 0) {
      /* bereits im Blickfeld (z. B. direkt nach dem Öffnen des Eingangs):
         sofort einfliegen lassen, ohne auf den Observer zu warten */
      el.classList.add('in');
    } else {
      io.observe(el);
    }
  });
});

// Header: Logo-Farbe an der tatsächlichen Hero-Unterkante wechseln
var updateHeader = (function () {
  var header = document.querySelector('.site-header');
  if (!header) return function () {};

  var hero = document.querySelector('.hero');
  var logo = header.querySelector('.logo');
  /* Flächen mit dunklem Grund: darüber wird das Logo hell */
  var darkAreas = document.querySelectorAll('.hero, .svc-hero, .section.dark, .site-footer');
  var ticking = false;

  function apply() {
    ticking = false;

    if (htmlEl.classList.contains('gate')) {
      header.classList.remove('scrolled');
      header.classList.add('on-dark');
      return;
    }

    if (hero) {
      header.classList.toggle('scrolled', window.scrollY > hero.offsetHeight - 40);
    }

    /* Messpunkt: Mitte des Logos — was liegt dort darunter? */
    var box = (logo || header).getBoundingClientRect();
    if (box.bottom < 0) return; /* Header ausgescrollt (Unterseiten) */
    var y = box.top + box.height / 2;

    var onDark = false;
    for (var i = 0; i < darkAreas.length; i++) {
      var b = darkAreas[i].getBoundingClientRect();
      if (b.top <= y && b.bottom >= y) { onDark = true; break; }
    }
    header.classList.toggle('on-dark', onDark);
  }

  function update() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(apply);
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  apply();
  return apply;
})();

// Eingang: Bildschirm ist gesperrt. Die erste Scroll-Geste lässt die Kacheln
// einfliegen, die nächste öffnet die Seite mit der Iris-Blende.
(function () {
  var hero = document.querySelector('.hero');
  if (!hero) return;

  var opening = false;
  var cardsShown = false;
  var cardsAt = 0;

  function showCards() {
    if (cardsShown) return;
    cardsShown = true;
    cardsAt = Date.now();
    htmlEl.classList.remove('cards-wait');
    htmlEl.classList.add('cards-in');
  }

  function finish(targetSel) {
    if (!htmlEl.classList.contains('gate')) return;
    htmlEl.classList.remove('gate');
    htmlEl.classList.remove('opening-page');
    hero.classList.remove('opening');
    /* Sofort (ohne smooth) unter den Hero springen — sonst sichtbarer Doppel-Scroll */
    var prevBehavior = htmlEl.style.scrollBehavior;
    htmlEl.style.scrollBehavior = 'auto';
    window.scrollTo(0, hero.offsetHeight);
    htmlEl.style.scrollBehavior = prevBehavior;
    updateHeader();
    startFX(); /* jetzt fliegen die Inhalte gestaffelt ein */
    if (targetSel && targetSel !== '#top' && targetSel !== '#leistungen') {
      var el = document.querySelector(targetSel);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function openGate(targetSel) {
    if (!htmlEl.classList.contains('gate') || opening) return;
    showCards(); /* falls noch verborgen: nicht ohne Kacheln öffnen */
    opening = true;
    hero.classList.add('opening');
    htmlEl.classList.add('opening-page'); /* lässt die Seite darunter aufsteigen */
    /* Nur die Hero-eigene Transition zählt — transitionend von Kind-Elementen
       (z. B. Hover des Pfeils) würde die Animation abbrechen */
    hero.addEventListener('transitionend', function onEnd(e) {
      /* clip-path = Iris-Blende, opacity = Überblendung bei reduzierter Bewegung */
      if (e.target !== hero || (e.propertyName !== 'clip-path' && e.propertyName !== 'opacity')) return;
      hero.removeEventListener('transitionend', onEnd);
      finish(targetSel);
    });
    setTimeout(function () { finish(targetSel); }, 1800); /* Fallback */
  }

  /* Scroll-Geste: erst Kacheln zeigen, dann (mit kurzer Wirkpause) öffnen */
  function onScrollIntent() {
    if (!htmlEl.classList.contains('gate') || opening) return;
    if (!cardsShown) { showCards(); return; }
    if (Date.now() - cardsAt < 900) return; /* Kacheln erst wirken lassen */
    openGate();
  }

  window.addEventListener('wheel', function (e) {
    if (e.deltaY > 0) onScrollIntent();
  }, { passive: true });

  window.addEventListener('touchmove', onScrollIntent, { passive: true });

  window.addEventListener('keydown', function (e) {
    if (['ArrowDown', 'PageDown', ' ', 'End'].indexOf(e.key) !== -1) onScrollIntent();
  });

  /* Klicks funktionieren weiterhin: Pfeil, Navigation oder Hero-Buttons */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (!htmlEl.classList.contains('gate')) return;
      e.preventDefault();
      openGate(a.getAttribute('href'));
    });
  });

  /* Fallback: Kacheln nach kurzer Wartezeit automatisch zeigen */
  if (htmlEl.classList.contains('gate')) {
    setTimeout(showCards, 4200);
  } else {
    showCards();
  }
})();

// Mobiles Menü
(function () {
  var toggle = document.getElementById('nav-toggle');
  var panel = document.getElementById('nav-panel');
  if (!toggle || !panel) return;

  function setOpen(open) {
    panel.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
  }

  toggle.addEventListener('click', function () {
    setOpen(!panel.classList.contains('open'));
  });

  panel.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 1100 && panel.classList.contains('open')) setOpen(false);
  });
})();

// Statements: aktives Statement hervorheben, Zähler mitführen (hinter dem Eingang aufgeschoben)
scheduleFX(function () {
  var wrap = document.getElementById('statements');
  var counter = document.getElementById('statement-counter');
  if (!wrap) return;

  var items = Array.prototype.slice.call(wrap.querySelectorAll('.statement'));
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('lit'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      entry.target.classList.toggle('lit', entry.isIntersecting);
      if (entry.isIntersecting && counter) {
        var idx = items.indexOf(entry.target) + 1;
        counter.textContent = String(idx < 10 ? '0' + idx : idx);
      }
    });
  }, { threshold: 0.4 });

  items.forEach(function (el) { io.observe(el); });
});

// Vorher/Nachher-Slider (Range-Input steuert Clip-Path — Maus, Touch & Tastatur)
(function () {
  var range = document.getElementById('vn-range');
  var after = document.getElementById('vn-after');
  var divider = document.getElementById('vn-divider');
  var handle = document.getElementById('vn-handle');
  if (!range || !after) return;

  function update() {
    var pct = Number(range.value);
    after.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
    divider.style.left = pct + '%';
    handle.style.left = pct + '%';
  }

  range.addEventListener('input', update);
  update();
})();

// Terminformular → vorausgefüllte E-Mail
(function () {
  var form = document.getElementById('appt-form');
  var status = document.getElementById('form-status');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!form.reportValidity()) return;

    var data = new FormData(form);
    var name = data.get('name') || '';
    var phone = data.get('phone') || '';
    var service = data.get('service') || '';
    var date = data.get('date') || '';
    var address = data.get('address') || '';
    var message = data.get('message') || '';

    var subject = 'Terminanfrage von ' + name;
    var body = 'Neue Terminanfrage über die Website:\n\n';
    body += 'Name: ' + name + '\n';
    body += 'Telefon: ' + phone + '\n';
    body += 'Leistung: ' + service + '\n';
    if (date) body += 'Wunschtermin: ' + date + '\n';
    if (address) body += 'Adresse: ' + address + '\n';
    if (message) body += 'Nachricht: ' + message + '\n';

    window.location.href =
      'mailto:rhoenwerk@gmail.com?subject=' +
      encodeURIComponent(subject) +
      '&body=' +
      encodeURIComponent(body);

    if (status) status.classList.add('show');
    form.reset();
  });
})();

// Google-Bewertungen aktualisieren.
// Holt die aktuellen Bewertungen von reviews.php (serverseitiger Abruf bei Google).
// Ist das Skript nicht eingerichtet, bleiben die fest hinterlegten Bewertungen stehen.
(function () {
  var meta = document.getElementById('review-meta');
  var featured = document.getElementById('review-featured');
  var grid = document.getElementById('review-grid');
  if (!featured && !grid) return;
  if (!window.fetch) return;

  function stars(n) {
    n = Math.max(0, Math.min(5, Math.round(n || 5)));
    return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
  }

  function shorten(text, max) {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    var cut = text.slice(0, max);
    var sp = cut.lastIndexOf(' ');
    return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,.;:!?-]+$/, '') + '…';
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* Autorenzeile: Initiale, Name (bei Bedarf als Link zu Google), Zusatz */
  function author(r, sub) {
    var wrap = el('div', 'review-author');
    wrap.appendChild(el('span', 'avatar', (r.author || '?').trim().charAt(0).toUpperCase()));

    var col = el('div');
    var name = el('b');
    if (r.authorUrl) {
      var a = el('a', null, r.author);
      a.href = r.authorUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      name.appendChild(a);
    } else {
      name.textContent = r.author;
    }
    col.appendChild(name);
    col.appendChild(el('span', null, sub));
    wrap.appendChild(col);
    return wrap;
  }

  function tagText(r) {
    return 'Google-Rezension' + (r.relative ? ' · ' + r.relative : '');
  }

  function render(data) {
    var list = data.reviews || [];
    if (!list.length) return;

    /* Bewertungsschnitt und Anzahl */
    var count = data.total + ' Google-Rezension' + (data.total === 1 ? '' : 'en');
    if (meta) {
      meta.textContent = '';
      var s = el('span', 'stars', stars(data.rating));
      s.setAttribute('aria-hidden', 'true');
      meta.appendChild(s);
      meta.appendChild(document.createTextNode(' ' + data.ratingText + ' / 5 · ' + count));
    }
    var heroVal = document.getElementById('hero-rating');
    var heroCount = document.getElementById('hero-rating-count');
    if (heroVal) heroVal.textContent = data.ratingText + ' / 5';
    if (heroCount) heroCount.textContent = count;

    /* Neueste Bewertung groß hervorheben */
    if (featured) {
      var f = list[0];
      featured.textContent = '';
      featured.appendChild(el('span', 'review-tag', tagText(f)));
      featured.appendChild(el('blockquote', null, '„' + shorten(f.text, 320) + '“'));
      featured.appendChild(author(f, stars(f.rating) + ' · ' + f.rating + ' von 5'));
    }

    /* Weitere Bewertungen als Karten */
    if (grid) {
      var rest = list.slice(featured ? 1 : 0, featured ? 4 : 3);
      if (!rest.length) return;
      grid.textContent = '';
      rest.forEach(function (r) {
        var card = el('article', 'review-card');
        card.appendChild(el('span', 'review-tag', tagText(r)));
        var st = el('span', 'stars', stars(r.rating));
        st.setAttribute('aria-label', r.rating + ' von 5 Sternen');
        card.appendChild(st);
        card.appendChild(el('blockquote', null, '„' + shorten(r.text, 180) + '“'));
        card.appendChild(author(r, 'Google-Rezension'));
        grid.appendChild(card);
      });
    }
  }

  fetch('reviews.php')
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (data && data.configured && data.reviews && data.reviews.length) render(data);
    })
    .catch(function () { /* offline oder nicht eingerichtet: Standardtexte bleiben */ });
})();

// Jahr im Footer aktuell halten
(function () {
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
