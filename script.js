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
