/* cinematic-site-builder — motion
   Three things and nothing else:
   1. One orchestrated hero entrance on load.
   2. Scroll reveals for sections (once, then done).
   3. Small hover responses handled in CSS, not here.
   Respects prefers-reduced-motion. No dependencies. GSAP is optional; see
   references/motion-recipes.md for the GSAP variant. */

(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = window.matchMedia('(max-width: 720px)').matches;

  // 1. Hero entrance: elements with [data-hero] stagger in, in DOM order.
  const heroEls = document.querySelectorAll('[data-hero]');
  if (reduce) {
    heroEls.forEach(el => el.classList.add('is-in'));
  } else {
    heroEls.forEach((el, i) => {
      el.style.transitionDelay = (120 + i * 110) + 'ms';
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
    });
  }

  // 2. Scroll reveals: [data-reveal] on a block; [data-reveal-stagger] staggers its children.
  const targets = document.querySelectorAll('[data-reveal], [data-reveal-stagger]');
  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      if (el.hasAttribute('data-reveal-stagger')) {
        Array.from(el.children).forEach((c, i) => { c.style.transitionDelay = (i * (mobile ? 60 : 90)) + 'ms'; });
      }
      el.classList.add('is-in');
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  targets.forEach(el => io.observe(el));
})();
