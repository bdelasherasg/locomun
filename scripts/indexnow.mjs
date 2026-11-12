/* Avisa a los buscadores que usan IndexNow (Bing, Yandex, Seznam, Naver) de las páginas que cambiaron en el último commit.
   Es gratuito y no requiere cuenta. Un fallo no detiene la publicación. */
import { execSync } from 'node:child_process';

const SITIO = 'https://locomun.cl';
const CLAVE = 'ea9dfc0db4db76162e41f24eabf912c1';
try {
  const cambios = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' }).split('\n').filter(Boolean);
  const urls = new Set();
  for (const f of cambios) {
    if (f === 'index.html') urls.add(`${SITIO}/`);
    else if (/^analisis\/.+\.html$/.test(f)) urls.add(`${SITIO}/${f}`);
  }
  if (!urls.size) { console.log('IndexNow: sin páginas nuevas.'); process.exit(0); }
  const r = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: 'locomun.cl', key: CLAVE, keyLocation: `${SITIO}/${CLAVE}.txt`, urlList: [...urls] }),
  });
  console.log(`IndexNow: ${urls.size} URL enviadas, respuesta ${r.status}.`);
} catch (e) {
  console.log('IndexNow no disponible:', e.message);
}
