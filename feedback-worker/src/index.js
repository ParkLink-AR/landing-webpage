const TEAM = ['Facundo Luzzi', 'Thiago Baez', 'Santiago Dominguez', 'Santiago Varga'];

function corsHeaders(origin, allowedOrigins) {
    const isLocalDev = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const allowed = (allowedOrigins.includes(origin) || isLocalDev) ? origin : allowedOrigins[0];
    return {
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Vary': 'Origin',
    };
}

function json(data, status, headers) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    });
}

async function verifyTurnstile(token, env, request) {
    if (!token) return false;
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET_KEY);
    form.append('response', token);
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) form.append('remoteip', ip);

    try {
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: form,
        });
        const data = await res.json();
        return data.success === true;
    } catch {
        return false;
    }
}

function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendDigest(env) {
    const { results: rows } = await env.DB.prepare(
        "SELECT id, nombre, vine_por, comentario, created_at FROM comments WHERE emailed = 0 ORDER BY created_at ASC"
    ).all();

    if (!rows.length) {
        return { sent: false, count: 0 };
    }

    const rowsHtml = rows.map(r => `
        <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #DDE3EC;font-weight:600;color:#032152;">${escapeHtml(r.nombre)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #DDE3EC;color:#168B8D;">${escapeHtml(r.vine_por || '—')}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #DDE3EC;">${escapeHtml(r.comentario)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #DDE3EC;color:#64778A;font-size:12px;white-space:nowrap;">${escapeHtml(r.created_at)}</td>
        </tr>`).join('');

    const html = `
        <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;">
            <h2 style="color:#032152;">Comentarios de la presentación de ParkLink</h2>
            <p style="color:#64778A;">${rows.length} comentario(s) nuevo(s).</p>
            <table style="border-collapse:collapse;width:100%;font-size:14px;">
                <thead>
                    <tr style="background:#F7F8FA;text-align:left;">
                        <th style="padding:8px 12px;">Nombre</th>
                        <th style="padding:8px 12px;">Vino por</th>
                        <th style="padding:8px 12px;">Comentario</th>
                        <th style="padding:8px 12px;">Fecha</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>`;

    const recipients = env.DIGEST_RECIPIENTS.split(',').map(email => ({ email: email.trim() }));

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': env.BREVO_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            sender: { name: env.DIGEST_SENDER, email: env.DIGEST_SENDER },
            to: recipients,
            subject: `ParkLink — ${rows.length} comentario(s) nuevo(s) de la presentación`,
            htmlContent: html,
        }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Brevo respondió ${res.status}: ${text}`);
    }

    const ids = rows.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    await env.DB.prepare(`UPDATE comments SET emailed = 1 WHERE id IN (${placeholders})`).bind(...ids).run();

    return { sent: true, count: rows.length };
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const allowedOrigins = env.ALLOWED_ORIGINS.split(',');
        const origin = request.headers.get('Origin') || '';
        const cors = corsHeaders(origin, allowedOrigins);

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: cors });
        }

        if (url.pathname === '/api/comments' && request.method === 'POST') {
            let body;
            try {
                body = await request.json();
            } catch {
                return json({ error: 'JSON inválido' }, 400, cors);
            }

            const nombre = String(body.nombre || '').trim().slice(0, 120);
            const vinePorList = Array.isArray(body.vine_por) ? body.vine_por : [body.vine_por];
            const vinePor = vinePorList.map(v => String(v || '').trim()).filter(Boolean);
            const comentario = String(body.comentario || '').trim().slice(0, 1000);

            const vinePorValid = vinePor.length > 0 && vinePor.every(v => TEAM.includes(v));
            if (!nombre || !comentario || !vinePorValid) {
                return json({ error: 'Faltan datos o "vine_por" inválido' }, 400, cors);
            }

            const turnstileOk = await verifyTurnstile(String(body.turnstileToken || ''), env, request);
            if (!turnstileOk) {
                return json({ error: 'Verificación anti-spam fallida' }, 403, cors);
            }

            await env.DB.prepare(
                'INSERT INTO comments (nombre, vine_por, comentario) VALUES (?, ?, ?)'
            ).bind(nombre, vinePor.join(', '), comentario).run();

            return json({ ok: true }, 201, cors);
        }

        if (url.pathname === '/api/comments' && request.method === 'GET') {
            const auth = request.headers.get('Authorization') || '';
            if (auth !== `Bearer ${env.ADMIN_KEY}`) {
                return json({ error: 'No autorizado' }, 401, cors);
            }
            const { results } = await env.DB.prepare(
                'SELECT id, nombre, vine_por, comentario, created_at, emailed FROM comments ORDER BY created_at DESC'
            ).all();
            return json(results, 200, cors);
        }

        if (url.pathname === '/api/send-digest' && request.method === 'POST') {
            const auth = request.headers.get('Authorization') || '';
            if (auth !== `Bearer ${env.ADMIN_KEY}`) {
                return json({ error: 'No autorizado' }, 401, cors);
            }
            try {
                const result = await sendDigest(env);
                return json(result, 200, cors);
            } catch (err) {
                return json({ error: String(err) }, 500, cors);
            }
        }

        return json({ error: 'Not found' }, 404, cors);
    },

    async scheduled(controller, env, ctx) {
        ctx.waitUntil(sendDigest(env));
    },
};
