# parklink-feedback

Worker + D1 que recibe los comentarios del popup "Dejar un comentario" de la landing
(pensado para el día de la presentación: QR → sitio → modal de agradecimiento + feedback).

- API: `https://feedback.parklink.com.ar`
- `POST /api/comments` — body `{ "nombre": "...", "comentario": "..." }`. Público (lo usa el
  formulario del sitio).
- `GET /api/comments` — requiere `Authorization: Bearer <ADMIN_KEY>`. Devuelve todos los
  comentarios, más nuevos primero.

## Ver los comentarios

```bash
curl https://feedback.parklink.com.ar/api/comments \
  -H "Authorization: Bearer <ADMIN_KEY>"
```

El `ADMIN_KEY` se generó una sola vez y se guardó como secreto del Worker (`wrangler secret
put ADMIN_KEY`) — no está en este repo. Si se pierde, se puede generar uno nuevo con el mismo
comando y volver a guardarlo.

## Redeploy

```bash
cd feedback-worker
npx wrangler deploy
```

## Orígenes permitidos (CORS)

Configurados en `wrangler.toml` (`ALLOWED_ORIGINS`). `localhost`/`127.0.0.1` siempre están
permitidos (hardcodeado en `src/index.js`) para poder probar en local.
