(() => {
    function initWorks() {
        const section = document.querySelector('#works .works-section');
        const cards = document.querySelectorAll('#works .work-card');
        if (!section || !cards.length) return;

        if (section.dataset.initialized === 'true') return;
        section.dataset.initialized = 'true';

        // Always reveal cards first so a failed IntersectionObserver cannot hide the projects.
        cards.forEach((card, index) => {
            card.style.transitionDelay = `${index * 80}ms`;
        });

        if (!('IntersectionObserver' in window)) {
            cards.forEach(card => card.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver((entries, observerInstance) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observerInstance.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

        cards.forEach(card => observer.observe(card));

        // Safety fallback: reveal anything still hidden after 2 seconds.
        window.setTimeout(() => {
            cards.forEach(card => card.classList.add('is-visible'));
        }, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWorks, { once: true });
    } else {
        initWorks();
    }
    document.addEventListener('componentsLoaded', initWorks);
document.addEventListener('worksHydrated', initWorks);
})();
