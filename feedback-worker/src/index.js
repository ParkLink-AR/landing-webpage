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
            const comentario = String(body.comentario || '').trim().slice(0, 1000);

            if (!nombre || !comentario) {
                return json({ error: 'Falta nombre o comentario' }, 400, cors);
            }

            await env.DB.prepare(
                'INSERT INTO comments (nombre, comentario) VALUES (?, ?)'
            ).bind(nombre, comentario).run();

            return json({ ok: true }, 201, cors);
        }

        if (url.pathname === '/api/comments' && request.method === 'GET') {
            const auth = request.headers.get('Authorization') || '';
            if (auth !== `Bearer ${env.ADMIN_KEY}`) {
                return json({ error: 'No autorizado' }, 401, cors);
            }
            const { results } = await env.DB.prepare(
                'SELECT id, nombre, comentario, created_at FROM comments ORDER BY created_at DESC'
            ).all();
            return json(results, 200, cors);
        }

        return json({ error: 'Not found' }, 404, cors);
    },
};
