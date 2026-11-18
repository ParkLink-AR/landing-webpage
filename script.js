const io = new IntersectionObserver(
    entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
    { threshold: 0.1 }
);
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

(() => {
    const overlay = document.getElementById('feedbackOverlay');
    const form = document.getElementById('feedbackForm');
    if (!overlay || !form) return;

    const success = document.getElementById('feedbackSuccess');
    const closeBtn = document.getElementById('feedbackClose');
    const fab = document.getElementById('feedbackTrigger');
    const submitBtn = form.querySelector('button[type="submit"]');
    const API_URL = 'https://feedback.parklink.com.ar/api/comments';

    const open = () => {
        form.hidden = false;
        success.hidden = true;
        form.reset();
        if (window.turnstile) turnstile.reset();
        overlay.hidden = false;
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-open')));
    };
    const close = () => {
        overlay.classList.remove('is-open');
        document.body.style.overflow = '';
        setTimeout(() => { overlay.hidden = true; }, 250);
    };

    closeBtn.addEventListener('click', close);
    fab.addEventListener('click', open);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) close(); });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const nombre = form.nombre.value.trim();
        const vinePor = [...form.querySelectorAll('input[name="vine_por"]:checked')].map(el => el.value);
        const comentario = form.comentario.value.trim();
        const turnstileToken = form.querySelector('[name="cf-turnstile-response"]')?.value || '';
        if (!nombre || !vinePor.length || !comentario) return;
        if (!turnstileToken) {
            alert('Esperá un segundo a que termine de cargar la verificación y probá de nuevo.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando…';
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, vine_por: vinePor, comentario, turnstileToken }),
            });
            if (!res.ok) throw new Error(`status ${res.status}`);
            form.hidden = true;
            success.hidden = false;
            setTimeout(close, 2200);
        } catch (err) {
            console.warn('[feedback] submit error:', err);
            alert('No se pudo enviar el comentario. Probá de nuevo en un momento.');
            if (window.turnstile) turnstile.reset();
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar comentario';
        }
    });

    if (!sessionStorage.getItem('parklink_feedback_seen')) {
        sessionStorage.setItem('parklink_feedback_seen', '1');
        const openAfterLoad = () => setTimeout(open, 900);
        if (document.getElementById('preloader')) {
            document.addEventListener('preloader:done', openAfterLoad, { once: true });
        } else {
            openAfterLoad();
        }
    }
})();

const navEl = document.querySelector('nav');
const heroLogo = document.querySelector('.hero-logo');
if (navEl && heroLogo) {
    const navObserver = new IntersectionObserver(
        ([entry]) => navEl.classList.toggle('nav-scrolled', !entry.isIntersecting),
        { threshold: 0 }
    );
    navObserver.observe(heroLogo);
}

const track = document.getElementById('marqueeTrack');
if (track) {
    const count = track.children.length;
    const clone = track.innerHTML;
    track.insertAdjacentHTML('beforeend', clone);
    track.querySelectorAll(`.phone-item:nth-child(n+${count + 1}) img`).forEach(img => img.setAttribute('aria-hidden', 'true'));
    track.querySelectorAll('img').forEach(img => img.draggable = false);

    const viewport = track.parentElement;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    track.classList.add('is-js');

    let offset = 0, period = 1, speed = 0;
    let dragging = false, dragStartX = 0, dragStartOffset = 0;

    const measure = () => {
        period = track.children[count].offsetLeft - track.children[0].offsetLeft || 1;
        const secs = parseFloat(getComputedStyle(track).getPropertyValue('--marquee-duration')) || 58;
        speed = reducedMotion.matches ? 0 : period / secs;
    };
    const render = () => {
        offset = ((offset % period) + period) % period;
        track.style.transform = `translateX(${-offset}px)`;
    };

    let last = performance.now();
    const tick = now => {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        if (!dragging) offset += speed * dt;
        render();
        requestAnimationFrame(tick);
    };

    viewport.addEventListener('pointerdown', e => {
        dragging = true;
        dragStartX = e.clientX;
        dragStartOffset = offset;
        viewport.setPointerCapture(e.pointerId);
        viewport.classList.add('is-dragging');
    });
    viewport.addEventListener('pointermove', e => {
        if (dragging) offset = dragStartOffset - (e.clientX - dragStartX);
    });
    const endDrag = () => { dragging = false; viewport.classList.remove('is-dragging'); };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

    measure();
    addEventListener('resize', measure);
    addEventListener('load', measure);
    reducedMotion.addEventListener('change', measure);
    requestAnimationFrame(tick);
}
