const io = new IntersectionObserver(
    entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
    { threshold: 0.1 }
);
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

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
