/* ================================================
   NAVBAR
================================================ */
const navbar    = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks  = document.querySelector('.nav-links');

if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  });
}

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
    document.body.classList.toggle('nav-open');
  });

  navLinks.addEventListener('click', e => {
    if (e.target.tagName === 'A') {
      e.preventDefault();
      const href = e.target.getAttribute('href');
      hamburger.classList.remove('open');
      navLinks.classList.remove('open');
      document.body.classList.remove('nav-open');
      setTimeout(() => {
        window.location.href = href;
      }, 150);
    }
  });
}

/* ================================================
   DYNAMIC SECTION LOADING
================================================ */
const contentArea = document.getElementById('content');

function scrollToHero() {
  const hero = document.getElementById('hero');
  if (!hero) return;
  hero.scrollIntoView({ behavior: 'smooth' });
}

async function loadSection(sectionName) {
  const id = sectionName;
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  if (!contentArea) return;
  contentArea.classList.add('loaded');
}

/* ================================================
   SLIDER FACTORY
   initSlider({ trackId, prevId, nextId, dotsId, progressId, wrapperSelector })
================================================ */
function initSlider({ trackId, prevId, nextId, dotsId, progressId, wrapperSelector }) {
  const track    = document.getElementById(trackId);
  const prev     = document.getElementById(prevId);
  const next     = document.getElementById(nextId);
  const dotsEl   = document.getElementById(dotsId);
  const progress = document.getElementById(progressId);

  if (!track) return;

  const slides = Array.from(track.children);
  const total  = slides.length;
  let current  = 0;

  // Clear old dots
  dotsEl.innerHTML = '';

  // Build dots
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', `Slide ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dotsEl.appendChild(dot);
  });

  function goTo(index) {
    current = (index + total) % total;
    track.style.transform = `translateX(-${current * 100}%)`;
    Array.from(dotsEl.children).forEach((d, i) =>
      d.classList.toggle('active', i === current)
    );
    progress.style.width = `${((current + 1) / total) * 100}%`;
  }

  prev.addEventListener('click', () => goTo(current - 1));
  next.addEventListener('click', () => goTo(current + 1));

  // Touch / swipe
  let touchStartX = 0;
  track.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  track.addEventListener('touchend', e => {
    const delta = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) goTo(delta > 0 ? current + 1 : current - 1);
  });

  goTo(0);
}

function initSliders() {
  const contentTrack = document.getElementById('contentTrack');
  const devTrack = document.getElementById('devTrack');

  if (contentTrack) {
    initSlider({
      trackId:         'contentTrack',
      prevId:          'contentPrev',
      nextId:          'contentNext',
      dotsId:          'contentDots',
      progressId:      'contentProgress',
      wrapperSelector: '#contentSliderWrapper',
    });
  }

  if (devTrack) {
    initSlider({
      trackId:         'devTrack',
      prevId:          'devPrev',
      nextId:          'devNext',
      dotsId:          'devDots',
      progressId:      'devProgress',
      wrapperSelector: '#devSliderWrapper',
    });
  }
}

/* ================================================
   SKILL BAR ANIMATION
================================================ */
function initSkillBars() {
  const skillFills = document.querySelectorAll('.skill-fill');
  const skillObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const fill = entry.target;
        fill.style.width = fill.dataset.width + '%';
        skillObserver.unobserve(fill);
      }
    });
  }, { threshold: 0.3 });

  skillFills.forEach(el => skillObserver.observe(el));
}

/* ================================================
   SCROLL REVEAL
================================================ */
function initScrollReveal() {
  const revealEls = document.querySelectorAll(
    '.service-card, .par-card, .contact-item, .about-skill-chip, .tech-chip, .metric, .dev-feature-list li, .tech-pill'
  );

  revealEls.forEach(el => {
    if (!el.classList.contains('reveal')) {
      el.classList.add('reveal');
    }
  });

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  revealEls.forEach(el => revealObserver.observe(el));

  // Stagger sibling reveals
  document.querySelectorAll(
    '.services-grid, .par-cards, .about-skills-grid, .skill-tech-grid, .dev-feature-list, .tech-stack'
  ).forEach(container => {
    Array.from(container.children).forEach((child, i) => {
      if (child.classList.contains('reveal')) {
        child.style.transitionDelay = `${i * 70}ms`;
      }
    });
  });
}

/* ================================================
   CONTACT FORM
================================================ */
function initContactForm() {
  const form     = document.getElementById('contactForm');
  const feedback = document.getElementById('formFeedback');

  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    feedback.textContent = '';
    feedback.className   = 'form-feedback';

    const name    = form.name.value.trim();
    const email   = form.email.value.trim();
    const message = form.message.value.trim();

    if (!name || !email || !message) {
      feedback.textContent = 'Please fill in all required fields.';
      feedback.classList.add('error');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      feedback.textContent = 'Please enter a valid email address.';
      feedback.classList.add('error');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled    = true;
    btn.textContent = 'Sending…';

    setTimeout(() => {
      form.reset();
      feedback.textContent = "Message sent! I'll get back to you within 24 hours.";
      feedback.classList.add('success');
      btn.disabled  = false;
      btn.innerHTML = 'Send Message <i class="fas fa-paper-plane"></i>';
    }, 1200);
  });
}

/* ================================================
   FOOTER YEAR
================================================ */
const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

/* ================================================
   ACTIVE NAV LINK (scroll spy)
================================================ */
const sections = document.querySelectorAll('section[id]');

if (sections.length) {
  const navObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        document.querySelectorAll('.nav-links a').forEach(a => {
          const href = a.getAttribute('href') || '';
          // Handle both anchor links (#hero) and full URLs (index.html#hero)
          const isActive = href === `#${id}` || href.endsWith(`#${id}`);
          a.style.color = isActive ? 'var(--cyan)' : '';
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => navObserver.observe(s));
}

/* ================================================
   SMOOTH SCROLL FOR ANCHOR LINKS
================================================ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
      // Close mobile menu if open
      if (hamburger && navLinks) {
        hamburger.classList.remove('open');
        navLinks.classList.remove('open');
      }
    }
  });
});

/* ================================================
   MISSION CONTROL — Full Skills Page JS
================================================ */
(function initMissionControl() {

  /* ---- Scroll reveal ---- */
  const revealEls = document.querySelectorAll('.sk-reveal');
  if (revealEls.length) {
    const ro = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const delay = parseInt(el.dataset.delay) || 0;
        setTimeout(() => el.classList.add('sk-visible'), delay);
        ro.unobserve(el);
      });
    }, { threshold: 0.1 });
    revealEls.forEach((el, i) => {
      if (!el.dataset.delay) el.dataset.delay = (i % 6) * 90;
      ro.observe(el);
    });
  }

  /* ---- Typewriter ---- */
  const tw = document.getElementById('mcTypewriter');
  if (tw) {
    const phrases = [
      '> initializing AI core...',
      '> loading Flutter SDK...',
      '> connecting Firebase...',
      '> OpenAI ready.',
      '> all systems operational.',
    ];
    let pi = 0, ci = 0, deleting = false;
    function type() {
      const phrase = phrases[pi];
      if (!deleting) {
        tw.textContent = phrase.slice(0, ++ci);
        if (ci === phrase.length) { deleting = true; setTimeout(type, 1800); return; }
      } else {
        tw.textContent = phrase.slice(0, --ci);
        if (ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; }
      }
      setTimeout(type, deleting ? 40 : 65);
    }
    setTimeout(type, 1200);
  }

  /* ---- Radar canvas ---- */
  const radarCanvas = document.getElementById('mcRadarCanvas');
  if (radarCanvas) {
    const rc = radarCanvas.getContext('2d');
    let angle = 0;
    const SIZE = 460;
    radarCanvas.width = SIZE; radarCanvas.height = SIZE;
    const cx = SIZE / 2, cy = SIZE / 2, R = SIZE / 2 - 10;

    function drawRadar() {
      rc.clearRect(0, 0, SIZE, SIZE);

      /* rings */
      [0.25, 0.5, 0.75, 1].forEach(f => {
        rc.beginPath();
        rc.arc(cx, cy, R * f, 0, Math.PI * 2);
        rc.strokeStyle = 'rgba(0,212,255,0.12)';
        rc.lineWidth = 1;
        rc.stroke();
      });

      /* crosshairs */
      rc.strokeStyle = 'rgba(0,212,255,0.1)';
      rc.beginPath(); rc.moveTo(cx - R, cy); rc.lineTo(cx + R, cy); rc.stroke();
      rc.beginPath(); rc.moveTo(cx, cy - R); rc.lineTo(cx, cy + R); rc.stroke();

      /* sweep gradient */
      const sweep = rc.createConicalGradient ? null : null;
      rc.save();
      rc.translate(cx, cy);
      rc.rotate(angle);
      const grad = rc.createLinearGradient(0, 0, R, 0);
      grad.addColorStop(0, 'rgba(0,212,255,0.5)');
      grad.addColorStop(1, 'rgba(0,212,255,0)');
      rc.beginPath();
      rc.moveTo(0, 0);
      rc.arc(0, 0, R, -Math.PI / 6, 0);
      rc.closePath();
      rc.fillStyle = grad;
      rc.fill();
      rc.restore();

      /* outer ring */
      rc.beginPath();
      rc.arc(cx, cy, R, 0, Math.PI * 2);
      rc.strokeStyle = 'rgba(0,212,255,0.25)';
      rc.lineWidth = 1.5;
      rc.stroke();

      angle += 0.018;
      requestAnimationFrame(drawRadar);
    }
    drawRadar();
  }

  /* ---- Core orbit particles ---- */
  const coreCanvas = document.getElementById('mcCoreParticles');
  if (coreCanvas) {
    const cc = coreCanvas.getContext('2d');
    let cW, cH;
    function resizeCore() {
      cW = coreCanvas.width  = coreCanvas.offsetWidth;
      cH = coreCanvas.height = coreCanvas.offsetHeight;
    }
    resizeCore();
    window.addEventListener('resize', resizeCore);

    const cpts = Array.from({ length: 40 }, () => ({
      x: Math.random() * 500, y: Math.random() * 500,
      r: Math.random() * 1.3 + 0.2,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      a: Math.random() * 0.35 + 0.05,
    }));

    function drawCore() {
      cc.clearRect(0, 0, cW, cH);
      cpts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = cW; if (p.x > cW) p.x = 0;
        if (p.y < 0) p.y = cH; if (p.y > cH) p.y = 0;
        cc.beginPath();
        cc.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        cc.fillStyle = `rgba(0,212,255,${p.a})`;
        cc.fill();
      });
      requestAnimationFrame(drawCore);
    }
    drawCore();

    /* Mouse parallax on core */
    const coreWrap = document.getElementById('mcCoreWrap');
    const coreSystem = document.getElementById('mcCoreSystem');
    if (coreWrap && coreSystem) {
      coreWrap.addEventListener('mousemove', e => {
        const r = coreWrap.getBoundingClientRect();
        const dx = ((e.clientX - r.left) / r.width  - 0.5) * 18;
        const dy = ((e.clientY - r.top)  / r.height - 0.5) * 18;
        coreSystem.style.transform = `translate(${dx}px,${dy}px)`;
      });
      coreWrap.addEventListener('mouseleave', () => {
        coreSystem.style.transform = '';
      });
    }
  }

  /* ---- Skill bars ---- */
  const bars = document.querySelectorAll('.mc-bar-item');
  if (bars.length) {
    const bo = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const fill = entry.target.querySelector('.mc-bar-fill');
        const pct  = entry.target.dataset.pct || 0;
        if (fill) fill.style.width = pct + '%';
        bo.unobserve(entry.target);
      });
    }, { threshold: 0.3 });
    bars.forEach(b => bo.observe(b));
  }

  /* ---- Future section particles ---- */
  const futCanvas = document.getElementById('mcFutureCanvas');
  if (futCanvas) {
    const fc = futCanvas.getContext('2d');
    let fW, fH;
    function resizeFut() {
      fW = futCanvas.width  = futCanvas.offsetWidth;
      fH = futCanvas.height = futCanvas.offsetHeight;
    }
    resizeFut();
    window.addEventListener('resize', resizeFut);

    const fpts = Array.from({ length: 50 }, () => ({
      x: Math.random() * 1400, y: Math.random() * 600,
      r: Math.random() * 1.5 + 0.2,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      a: Math.random() * 0.3 + 0.04,
      hue: Math.random() > 0.7 ? 270 : 185,
    }));

    function drawFut() {
      fc.clearRect(0, 0, fW, fH);
      fpts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = fW; if (p.x > fW) p.x = 0;
        if (p.y < 0) p.y = fH; if (p.y > fH) p.y = 0;
        fc.beginPath();
        fc.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        fc.fillStyle = `hsla(${p.hue},100%,70%,${p.a})`;
        fc.fill();
      });
      requestAnimationFrame(drawFut);
    }
    drawFut();
  }

})();

/* ================================================
   SERVICES — TILT + MOUSE GLOW + PARTICLES
================================================ */
(function initServices() {
  /* Card tilt + glow tracking */
  document.querySelectorAll('.svc-card[data-tilt]').forEach(card => {
    const glow = card.querySelector('.svc-card-glow');

    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const cx = r.width  / 2;
      const cy = r.height / 2;
      const rotX = ((y - cy) / cy) * -8;
      const rotY = ((x - cx) / cx) *  8;
      card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;
      if (glow) { glow.style.left = x + 'px'; glow.style.top = y + 'px'; }
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

  /* Background particles for services section */
  const canvas = document.getElementById('svcParticles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const pts = Array.from({ length: 40 }, () => ({
    x: Math.random() * 1400,
    y: Math.random() * 800,
    r: Math.random() * 1.2 + 0.2,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    a: Math.random() * 0.35 + 0.05,
  }));

  function draw() {
    ctx.clearRect(0, 0, W, H);
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,212,255,${p.a})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ================================================
   AI CORE — MOUSE PARALLAX + PARTICLES
================================================ */
(function initAiCore() {
  const core = document.getElementById('heroAiCore');
  const canvas = document.getElementById('aiParticlesCanvas');
  if (!core || !canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H;

  function resize() {
    W = canvas.width  = core.offsetWidth;
    H = canvas.height = core.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  /* Particles */
  const particles = Array.from({ length: 55 }, () => ({
    x: Math.random() * 420,
    y: Math.random() * 420,
    r: Math.random() * 1.5 + 0.3,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    alpha: Math.random() * 0.5 + 0.1,
  }));

  function drawParticles() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,212,255,${p.alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(drawParticles);
  }
  drawParticles();

  /* Mouse parallax */
  document.addEventListener('mousemove', e => {
    const x = (e.clientX / window.innerWidth  - 0.5) * 22;
    const y = (e.clientY / window.innerHeight - 0.5) * 22;
    core.style.transform = `translate(${x}px, ${y}px)`;
  });

  /* Click orb = launch into full-screen float bounce */
  const orb = core.querySelector('.ai-orb');
  const heroVisual = core.closest('.hero-visual') || core.parentElement;
  let floatRAF = null;
  let isFloating = false;
  let originRect = null;

  function stopFloat() {
    isFloating = false;
    if (floatRAF) { cancelAnimationFrame(floatRAF); floatRAF = null; }
    heroVisual.classList.remove('floating');
    heroVisual.style.left = '';
    heroVisual.style.top  = '';
    heroVisual.style.width = '';
    heroVisual.style.height = '';
  }

  if (orb) {
    orb.addEventListener('click', () => {
      if (isFloating) { stopFloat(); return; }

      isFloating = true;
      originRect = heroVisual.getBoundingClientRect();

      const W = heroVisual.offsetWidth;
      const H = heroVisual.offsetHeight;

      let x = originRect.left;
      let y = originRect.top;
      const speed = 0.8;
      const angle = Math.random() * Math.PI * 2;
      let vx = Math.cos(angle) * speed;
      let vy = Math.sin(angle) * speed;

      heroVisual.classList.add('floating');
      heroVisual.style.width  = W + 'px';
      heroVisual.style.height = H + 'px';
      heroVisual.style.left   = x + 'px';
      heroVisual.style.top    = y + 'px';

      const ripple = document.createElement('div');
      ripple.className = 'ai-click-ripple';
      core.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());

      function loop() {
        if (!isFloating) return;
        x += vx;
        y += vy;

        if (x <= 0)                { x = 0;                  vx = Math.abs(vx); }
        if (x + W >= window.innerWidth)  { x = window.innerWidth - W;  vx = -Math.abs(vx); }
        if (y <= 0)                { y = 0;                  vy = Math.abs(vy); }
        if (y + H >= window.innerHeight) { y = window.innerHeight - H; vy = -Math.abs(vy); }

        heroVisual.style.left = x + 'px';
        heroVisual.style.top  = y + 'px';
        floatRAF = requestAnimationFrame(loop);
      }
      loop();
    });
  }
})();

// Initialize content area as loaded on page load
if (contentArea) {
  contentArea.classList.add('loaded');
}

if (document.getElementById('contentTrack') || document.getElementById('devTrack')) {
  initSliders();
}
if (document.getElementById('contactForm')) {
  initContactForm();
}
if (document.querySelector('.skill-fill')) {
  initSkillBars();
}
if (
  document.querySelector('.service-card') ||
  document.querySelector('.par-card') ||
  document.querySelector('.contact-item') ||
  document.querySelector('.about-skill-chip') ||
  document.querySelector('.tech-chip') ||
  document.querySelector('.metric') ||
  document.querySelector('.dev-feature-list li') ||
  document.querySelector('.tech-pill')
) {
  initScrollReveal();
}
