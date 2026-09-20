document.addEventListener('DOMContentLoaded', async () => {
    const components = {
        navbar: 'html/navbar.html',
        home: 'html/home.html',
        about: 'html/about.html',
        services: 'html/services.html',
        works: 'html/works.html',
        team: 'html/team.html',
        testimonials: 'html/testimonials.html',
        trusted: 'html/trusted.html',
        contact: 'html/contact.html',
        footer: 'html/footer.html'
    };

    const loadComponent = async (id, file) => {
        const container = document.getElementById(id);
        if (!container) return;

        try {
            const response = await fetch(file, { cache: 'no-store' });
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            const html = await response.text();
            if (!html.trim()) throw new Error('Empty component');
            container.innerHTML = html;
            container.dataset.loaded = 'true';
        } catch (error) {
            console.error(`[VELNOX] Failed to load ${file}:`, error);
            container.dataset.loaded = 'false';
            container.innerHTML = `<div class="component-error" role="alert">
                <strong>Section unavailable</strong>
                <span>Please refresh the page.</span>
            </div>`;
        }
    };

    await Promise.all(
        Object.entries(components).map(([id, file]) => loadComponent(id, file))
    );

    // Backend content is optional. Static HTML remains the fallback.
    if (window.VELNOX_API) {
        await hydrateProjects();
        await hydrateTestimonials();
    }

    document.dispatchEvent(new Event('componentsLoaded'));
});

async function hydrateProjects() {
    try {
        const response = await fetch(`${window.VELNOX_API}/api/projects`, {
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) return;

        const projects = await response.json();
        const grid = document.querySelector('#works .works-grid');
        if (!grid || !Array.isArray(projects) || !projects.length) return;

        grid.innerHTML = projects.map((p, i) => `
            <article class="work-card">
                <div class="work-image">
                    ${p.image
                        ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}" loading="lazy">`
                        : `<div class="work-grid-art"><div></div><div></div><div></div><div></div></div>`}
                    <div class="work-number">${String(i + 1).padStart(2, '0')}</div>
                </div>
                <div class="work-info">
                    <div class="work-type">${escapeHtml(p.type)}</div>
                    <h3>${escapeHtml(p.title)}</h3>
                    <p>${escapeHtml(p.description)}</p>
                    <div class="work-meta">
                        ${String(p.meta || '').split('|').filter(Boolean)
                            .map(x => `<span>${escapeHtml(x)}</span>`).join('')}
                    </div>
                    ${p.url
                        ? `<a href="${escapeAttribute(p.url)}" target="_blank" rel="noopener noreferrer" class="view-project">View Project <span>↗</span></a>`
                        : `<button class="view-project disabled-project" type="button">Coming Soon <span>→</span></button>`}
                </div>
            </article>
        `).join('');

        document.dispatchEvent(new Event('worksHydrated'));
    } catch (error) {
        console.warn('[VELNOX] Project API unavailable; using static content.', error);
    }
}

async function hydrateTestimonials() {
    try {
        const response = await fetch(`${window.VELNOX_API}/api/testimonials`, {
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) return;

        const items = await response.json();
        const grid = document.querySelector('#testimonials .testimonials-grid');
        if (!grid || !Array.isArray(items) || !items.length) return;

        grid.innerHTML = items.map(item => `
            <article class="testimonial-card">
                <div class="testimonial-rating" aria-label="${Number(item.rating || 0)} out of 5">
                    ${'★'.repeat(Math.min(5, Math.max(0, Number(item.rating || 0))))}
                </div>
                <blockquote>“${escapeHtml(item.quote)}”</blockquote>
                <div class="testimonial-author">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.role || 'Client')}</span>
                </div>
            </article>
        `).join('');
    } catch (error) {
        console.warn('[VELNOX] Testimonial API unavailable; using static content.', error);
    }
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
}

function escapeAttribute(value) {
    return String(value ?? '').replace(/["<>]/g, char => ({
        '"': '&quot;', '<': '&lt;', '>': '&gt;'
    }[char]));
}
