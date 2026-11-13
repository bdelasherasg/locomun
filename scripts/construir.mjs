// Construye las partes del sitio que dependen del contenido.
//
// Fuente: contenido/publicaciones/*.json (con su cuerpo en *.html) y contenido/monitor/*.json.
// Fuente del sitio: fuente/sitio.html (todas las secciones en un archivo, con bloques marcados <!-- auto:... -->).
// Salida: index.html y una página por sección (metodo.html, publicaciones.html, ...), las páginas analisis/<slug>.html,
// contenido/feed.json, sitemap.xml y llms.txt.
//
// Uso: node scripts/construir.mjs   (lo ejecuta la acción de GitHub en cada cambio de contenido)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const leer = (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8');
const escribir = (r, t) => fs.writeFileSync(path.join(RAIZ, r), t);

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaTexto = (iso) => { const [a, m, d] = String(iso).split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${a}`; };
const mesTexto = (iso) => { const [a, m] = String(iso).split('-').map(Number); const t = `${MESES[m - 1]} ${a}`; return t[0].toUpperCase() + t.slice(1); };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Texto con marcas simples permitidas (<strong>, <em>) que vienen del propio equipo.
const rico = (s) => esc(s).replace(/&lt;(\/?)(strong|em)&gt;/g, '<$1$2>');

function cargar(carpeta) {
  const dir = path.join(RAIZ, 'contenido', carpeta);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!d.slug) d.slug = f.replace(/\.json$/, '');
    return d;
  }).filter((d) => !d.retirado);
}

const pubs = cargar('publicaciones').sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || (b.numero || 0) - (a.numero || 0));
const estudios = cargar('monitor').sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || (b.numero || 0) - (a.numero || 0));

function reemplazar(html, nombre, contenido) {
  const re = new RegExp(`(<!-- auto:${nombre} -->)[\\s\\S]*?(<!-- /auto:${nombre} -->)`);
  if (!re.test(html)) throw new Error(`Falta el marcador auto:${nombre} en fuente/sitio.html`);
  return html.replace(re, (_, a, b) => `${a}\n${contenido}\n${b}`);
}

const numeroTexto = (p) => (p.numero ? `N.° ${p.numero}` : (p.clase || ''));
const etiquetaSerie = (p) => [p.serie ? `Serie ${p.serie}` : '', p.serie ? numeroTexto(p) : p.clase, p.fecha ? fechaTexto(p.fecha) : ''].filter(Boolean).join(' · ');
// Ningún dato es obligatorio: lo que no viene no se muestra (ni su etiqueta).
const dato = (k, v) => (v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '');
// Párrafo con las frases que existan (escapadas) y lista de datos solo si hay alguno.
const lista = (frases) => { const t = frases.filter(Boolean).map(esc).join(' '); return t ? `<p>${t}</p>` : ''; };
const kv = (html) => (html ? `<dl class="kv">${html}</dl>` : '');
const parrafos = (p) => { const x = (p.presentacion || []).filter((t) => String(t || '').trim()); return x.length ? x : [p.bajada].filter(Boolean); };

/* ---------- index.html ---------- */
function bloquePublicacion(p, i) {
  const clase = i % 2 ? 'sec sec-alt' : 'sec';
  const filas = [
    ['Clase', p.clase], ['Autor', p.autor],
    p.original ? ['Publicación', `${fechaTexto(p.fecha)}, originalmente en ${p.original.sitio}`] : null,
    ['Marco declarado', p.marco], ['Fuentes', p.fuentes], ['Condición de refutación', p.condicion],
    ['Revisión', p.revision], ['Licencia', 'CC BY-SA 4.0'],
  ].filter((x) => x && x[1]);
  return `  <section class="${clase}" aria-labelledby="t-${p.slug}">
    <div class="wrap split">
      <div style="display:grid;gap:22px">
        <span class="eyebrow">${esc(etiquetaSerie(p))}</span>
        <h2 id="t-${p.slug}" style="font-size:clamp(1.7rem,2.8vw,2.3rem);line-height:1.2">${esc(p.titulo)}</h2>
        <div class="prose">
${parrafos(p).map((x) => `          <p>${rico(x)}</p>`).join('\n')}
        </div>
        <a class="btn btn-ink" href="analisis/${p.slug}.html" style="justify-self:start">Leer el artículo completo <span class="arrow">→</span></a>
      </div>
      <aside class="ficha" aria-label="Ficha epistémica">
        <div class="ficha-h"><span>Ficha epistémica</span><span>${esc(numeroTexto(p))}</span></div>
        <div class="ficha-b">
          <dl class="kv">
${filas.map(([k, v]) => `            <div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n')}
          </dl>
        </div>
      </aside>
    </div>
  </section>
`;
}

const ESTADOS = { pendiente: ['e-pend', 'Pendiente'], inmunizada: ['e-inm', 'Inmunizada'], corroborada: ['e-ok', 'Corroborada'], refutada: ['e-inm', 'Refutada'], indeterminada: ['e-pend', 'Indeterminada'] };
function filasPredicciones() {
  const filas = [];
  [...pubs].reverse().forEach((p) => (p.predicciones || []).forEach((x) => {
    const [cl, tx] = ESTADOS[x.estado] || ESTADOS.pendiente;
    const origen = x.origen || (p.serie ? `${p.serie} ${numeroTexto(p)}` : p.titulo_corto || p.titulo);
    filas.push(`            <tr>
              <td><b>${esc(x.afirmacion)}</b><br><span style="font-size:.82rem;color:var(--fg-3)">${esc(origen)}</span></td>
              <td>${esc(x.refuta)}</td>
              <td style="white-space:nowrap">${esc(x.verificacion)}</td>
              <td><span class="estado ${cl}">${tx}</span>${x.nota ? `<br><span style="font-size:.78rem;color:var(--fg-3)">${esc(x.nota)}</span>` : ''}</td>
            </tr>`);
  }));
  return filas.join('\n');
}

function tarjetaEstudio(e) {
  return `      <article class="ficha">
        <div class="ficha-h"><span>Estudio ${esc(e.numero)}</span><span>${esc(e.etiqueta || mesTexto(e.fecha))}</span></div>
        <div class="ficha-b" style="gap:20px;padding:30px 30px 32px">
          <h3 style="font-size:1.8rem">${esc(e.titulo)}</h3>
${e.resumen ? `          <p style="font-size:1rem;max-width:var(--measure)">${esc(e.resumen)}</p>\n` : ''}${(e.cifras || []).length ? `          <ul class="cifras">
${e.cifras.map((c) => `            <li><b>${esc(c.valor)}</b><span>${esc(c.texto)}</span></li>`).join('\n')}
          </ul>\n` : ''}${(e.autor || e.revision || e.fuentes) ? `          <dl class="kv">${dato('Autor', esc(e.autor))}${dato('Revisión', esc(e.revision))}${dato('Fuentes', esc(e.fuentes))}</dl>\n` : ''}${e.url ? `          <a class="btn btn-ink" href="${esc(e.url)}" target="_blank" rel="noopener" style="justify-self:start">Ver estudio completo <span class="arrow">→</span></a>` : ''}
        </div>
      </article>`;
}

function portada() {
  const p = pubs[0], e = estudios[0];
  const out = [];
  if (p) {
    const anterior = pubs.find((x) => x !== p && x.serie === p.serie);
    out.push(`        <article class="ficha">
          <div class="ficha-h"><span>${esc(p.serie || p.clase || 'Publicación')}</span><span>${esc(p.serie ? numeroTexto(p) : '')}</span></div>
          <div class="ficha-b">
            <h3>${esc(p.titulo_corto || p.titulo)}</h3>
            ${lista([p.resumen_portada || p.bajada, anterior ? `La entrega ${numeroTexto(anterior)} está en Publicaciones.` : ''])}
            ${kv(dato('Autor', esc(p.autor)) + dato('Fecha', p.fecha ? fechaTexto(p.fecha) : '') + dato('Próxima prueba', esc(p.proxima_prueba)))}
            <a class="more" href="analisis/${p.slug}.html">Leer el artículo <span class="arrow">→</span></a>
          </div>
        </article>`);
  }
  if (e) {
    const otros = estudios.slice(1).map((x) => x.titulo.charAt(0).toLowerCase() + x.titulo.slice(1));
    out.push(`        <article class="ficha">
          <div class="ficha-h"><span>Monitor económico</span><span>${estudios.length} ${estudios.length === 1 ? 'estudio' : 'estudios'}</span></div>
          <div class="ficha-b">
            <h3>${esc(e.titulo)}</h3>
            ${lista([e.resumen_corto || e.resumen, otros.length ? `También en el Monitor: ${otros.join('; ')}.` : ''])}
            ${kv(dato('Autor', esc(e.autor)) + dato('Fuente base', esc(e.fuente_base)))}
            <a class="more" href="#monitor">Ver en el Monitor <span class="arrow">→</span></a>
          </div>
        </article>`);
  }
  return out.join('\n');
}

let index = leer('fuente/sitio.html');
index = reemplazar(index, 'publicaciones', pubs.map(bloquePublicacion).join('\n'));
index = reemplazar(index, 'predicciones', filasPredicciones());
index = reemplazar(index, 'monitor', estudios.map(tarjetaEstudio).join('\n\n'));
index = reemplazar(index, 'portada', portada());
// Las secciones fijas que siguen a las publicaciones mantienen la alternancia de fondos.
['registro', 'protocolo', 'indice'].forEach((id, k) => {
  const alt = (pubs.length + k) % 2 === 1;
  index = index.replace(new RegExp(`<section class="sec( sec-alt)?" aria-labelledby="t-${id}">`), `<section class="${alt ? 'sec sec-alt' : 'sec'}" aria-labelledby="t-${id}">`);
});

/* ---------- páginas de artículo ---------- */
const i0 = index.lastIndexOf('<style>', index.indexOf('/* Layout'));
const cssSitio = index.slice(i0, index.indexOf('</style>', i0) + 8);
// Cada sección del sitio es una página propia; los enlaces internos #seccion apuntan a ella.
const SECCIONES = [
  ['inicio', 'Inicio', '/'], ['metodo', 'Método', '/metodo.html'], ['publicaciones', 'Publicaciones', '/publicaciones.html'],
  ['monitor', 'Monitor económico', '/monitor.html'], ['etica', 'Código ético', '/etica.html'], ['equipo', 'Equipo', '/equipo.html'],
  ['aportes', 'Aportes y contacto', '/aportes.html'],
];
const RUTA = Object.fromEntries(SECCIONES.map(([v, , r]) => [v, r]));
const enlaces = (html) => html.replace(/href="#([a-z]+)"/g, (m, v) => (RUTA[v] ? `href="${RUTA[v]}"` : m));
const cabecera = enlaces(index.slice(index.indexOf('<header class="top">'), index.indexOf('</header>') + 9));
const pie = enlaces(index.slice(index.indexOf('<footer class="foot">'), index.indexOf('</footer>') + 9));
const cssArticulo = leer('scripts/articulo.css');
// Hoja de estilos compartida por las páginas de artículo: se descarga una vez y queda en caché.
const cssPagina = cssSitio.replace(/^<style>\n?/, '').replace(/<\/style>$/, '') + '\n' + cssArticulo;
fs.mkdirSync(path.join(RAIZ, 'css'), { recursive: true });
escribir('css/pagina.css', cssPagina);
const versionCss = crypto.createHash('sha1').update(cssPagina).digest('hex').slice(0, 8);


/* ---------- SEO: URL canónica, datos estructurados, sitemap y llms.txt ---------- */
const SITIO = 'https://locomun.cl';
const textoPlano = (t) => String(t == null ? '' : t).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
// Una publicación con "original" declara como canónica la URL donde apareció primero.
const urlPropia = (p) => `${SITIO}/analisis/${p.slug}.html`;
const urlDePagina = (p) => (p.original && p.original.url ? p.original.url : urlPropia(p));
function jsonLdArticulo(p, url, descripcion) {
  const dato = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: textoPlano(p.titulo),
    description: descripcion,
    inLanguage: 'es-CL',
    datePublished: p.fecha,
    dateModified: p.fecha_modificacion || p.fecha,
    author: { '@type': 'Person', name: p.autor, ...(p.cargo_autor ? { jobTitle: p.cargo_autor } : {}) },
    publisher: { '@type': 'Organization', '@id': `${SITIO}/#organizacion`, name: 'Lo Común', url: `${SITIO}/` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    image: `${SITIO}/img/salon.jpg`,
    license: 'https://creativecommons.org/licenses/by-sa/4.0/',
    ...(p.serie ? { isPartOf: { '@type': 'CreativeWorkSeries', name: p.serie } } : {}),
  };
  const migas = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Lo Común', item: `${SITIO}/` },
      { '@type': 'ListItem', position: 2, name: 'Publicaciones', item: `${SITIO}/publicaciones.html` },
      { '@type': 'ListItem', position: 3, name: textoPlano(p.titulo_corto || p.titulo), item: url },
    ],
  };
  return JSON.stringify([dato, migas]).replace(/</g, '\\u003c');
}

function pagina(p) {
  const cuerpo = fs.existsSync(path.join(RAIZ, `contenido/publicaciones/${p.slug}.html`)) ? leer(`contenido/publicaciones/${p.slug}.html`) : '';
  const misma = pubs.filter((x) => x.serie && x.serie === p.serie).sort((a, b) => (a.numero || 0) - (b.numero || 0));
  const pos = misma.indexOf(p);
  const vecinos = [misma[pos - 1], misma[pos + 1]].filter(Boolean)
    .map((x) => `      <a class="btn btn-ink" href="${x.slug}.html" style="justify-self:start">Leer la entrega ${esc(numeroTexto(x))} <span class="arrow">→</span></a>`);
  const filas = [
    ['Clase', p.clase], p.serie ? ['Serie', `${p.serie}, entrega ${numeroTexto(p)}`] : null, ['Autor', p.autor],
    ['Publicación', p.original ? `${fechaTexto(p.fecha)}, originalmente en <a href="${esc(p.original.url)}" target="_blank" rel="noopener">${esc(p.original.sitio)}</a>` : esc(fechaTexto(p.fecha))],
    ['Marco declarado', esc(p.marco)], ['Fuentes', esc(p.fuentes)], ['Condición de refutación', esc(p.condicion)],
    ['Conflictos', esc(p.conflictos)], ['Revisión', esc(p.revision)], ['Licencia', 'CC BY-SA 4.0'],
  ].filter((x) => x && x[1]).map(([k, v]) => [k, k === 'Serie' || k === 'Clase' || k === 'Autor' ? esc(v) : v]);
  const tituloPagina = p.serie ? `${p.serie} ${numeroTexto(p)}: ${p.titulo_corto || p.titulo}` : (p.titulo_corto || p.titulo);
  const descripcion = textoPlano(p.resumen_portada || p.bajada || p.titulo);
  const urlCanonica = urlDePagina(p);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(tituloPagina)} · Lo Común</title>
<meta name="description" content="${esc(descripcion)}">
<meta property="og:title" content="${esc(tituloPagina)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Lo Común">
<meta property="og:locale" content="es_CL">
<meta property="og:url" content="${esc(urlCanonica)}">
<meta property="og:image" content="${SITIO}/img/salon.jpg">
<meta property="article:published_time" content="${esc(p.fecha)}">
<meta property="article:author" content="${esc(p.autor)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(tituloPagina)}">
<meta name="twitter:description" content="${esc(descripcion)}">
<meta name="twitter:image" content="${SITIO}/img/salon.jpg">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${esc(urlCanonica)}">
<script type="application/ld+json">${jsonLdArticulo(p, urlCanonica, descripcion)}</script>
<link rel="preload" href="../fonts/montserrat-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="../fonts/playfair-display-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../css/pagina.css?v=${versionCss}">
<script src="../analitica.js" defer></script>
</head>
<body>
${cabecera}
<main>
  <div class="art-head"><div class="wrap">
    <span class="crumb">${esc(p.serie ? `Serie ${p.serie} · ${numeroTexto(p)}` : p.clase)}</span>
    <h1>${esc(p.titulo)}</h1>
    <p class="meta">${esc([p.autor, p.cargo_autor, fechaTexto(p.fecha), p.lectura_minutos ? `Lectura de ${p.lectura_minutos} minutos` : ''].filter(Boolean).join(' · '))}</p>
  </div></div>
  <section class="sec"><div class="wrap art-grid">
    <article class="art">
      ${p.bajada ? `<p class="lead-art">${rico(p.bajada)}</p>` : ''}
      ${cuerpo.trim()}
    </article>
    <div class="aside-sticky">
      <aside class="ficha" aria-label="Ficha epistémica">
        <div class="ficha-h"><span>Ficha epistémica</span><span>${esc(numeroTexto(p))}</span></div>
        <div class="ficha-b"><dl class="kv">
${filas.map(([k, v]) => `          <div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('\n')}
        </dl></div>
      </aside>
${vecinos.join('\n')}
      <a class="btn btn-ink" href="/publicaciones.html" style="justify-self:start">Volver a Publicaciones <span class="arrow">→</span></a>
    </div>
  </div></section>
</main>
${pie}
<script>(function(){var n=document.getElementById('nav'),b=document.getElementById('menu-btn');b.addEventListener('click',function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o?'true':'false');});})();</script>
</body>
</html>
`;
}
fs.mkdirSync(path.join(RAIZ, 'analisis'), { recursive: true });
pubs.forEach((p) => escribir(`analisis/${p.slug}.html`, pagina(p)));


/* ---------- páginas por sección ---------- */
// Recorta el texto a una descripción breve: la primera oración si cabe; si no, hasta la última palabra completa.
function breve(t, max = 158) {
  const x = textoPlano(t);
  const m = x.match(/^.+?\.(?=\s|$)/);
  if (m && m[0].length <= max) return m[0];
  if (x.length <= max) return x;
  return x.slice(0, x.lastIndexOf(' ', max - 1)).replace(/[,;:]$/, '') + '…';
}
const iniciosVista = SECCIONES.map(([v]) => index.indexOf(`<section class="view" id="v-${v}"`));
const finMain = index.indexOf('</main>');
const vista = (k) => index.slice(iniciosVista[k], k + 1 < SECCIONES.length ? iniciosVista[k + 1] : finMain).replace(/\n*<!-- =+ [^>]*=+ -->\n*$/, '\n');
function paginaSeccion(k) {
  const [v, etiqueta, ruta] = SECCIONES[k];
  const url = `${SITIO}${ruta}`;
  const cuerpo = vista(k).replace(/(<section class="view"[^>]*?) hidden>/, '$1>');
  const h1 = textoPlano((cuerpo.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || etiqueta);
  const lead = (cuerpo.match(/<p class="lead"[^>]*>([\s\S]*?)<\/p>/) || cuerpo.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '';
  let html = index.slice(0, index.indexOf('<main>') + 6) + '\n' + cuerpo + index.slice(finMain);
  if (v !== 'inicio') {
    const h = h1.replace(/\.$/, '');
    const titulo = `${etiqueta}: ${h[0].toLowerCase()}${h.slice(1)}`;
    const tituloCompleto = /Lo Común/.test(titulo) ? titulo : `${titulo} · Lo Común`;
    const desc = breve(lead);
    const ld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', '@id': url, url, name: titulo, description: desc, inLanguage: 'es-CL',
          isPartOf: { '@id': `${SITIO}/#sitio` }, publisher: { '@id': `${SITIO}/#organizacion` } },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Lo Común', item: `${SITIO}/` },
          { '@type': 'ListItem', position: 2, name: etiqueta, item: url },
        ] },
      ],
    };
    html = html
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(tituloCompleto)}</title>`)
      .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(desc)}`)
      .replace(/(<link rel="canonical" href=")[^"]*/, `$1${url}`)
      .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
      .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(titulo)}`)
      .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(desc)}`)
      .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${esc(titulo)}`)
      .replace(/(<meta name="twitter:description" content=")[^"]*/, `$1${esc(desc)}`)
      .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`);
  } else {
    // Los enlaces antiguos con ancla (locomun.cl/#metodo) llevan a la página de la sección.
    const mapa = JSON.stringify(Object.fromEntries(SECCIONES.slice(1).map(([s, , r]) => [s, r])));
    html = html.replace('</title>', `</title>\n<script>(function(){var r=${mapa},h=location.hash.slice(1);if(r[h])location.replace(r[h]);})();</script>`);
  }
  html = enlaces(html).replace(`<a href="${ruta}">`, `<a href="${ruta}" aria-current="page">`);
  return html;
}
SECCIONES.forEach(([v, , ruta], k) => escribir(v === 'inicio' ? 'index.html' : ruta.slice(1), paginaSeccion(k)));

/* ---------- feed compartido (lo lee Urgencias Kast) ---------- */
const feedRuta = 'contenido/feed.json';
const feedPrevio = fs.existsSync(path.join(RAIZ, feedRuta)) ? JSON.parse(leer(feedRuta)) : {};
const hoy = new Date().toISOString().slice(0, 10);
const feed = {
  sitio: 'https://locomun.cl',
  descripcion: feedPrevio.descripcion || 'Resumen de la producción pública de Lo Común para que otros sitios la muestren.',
  actualizado: hoy,
  publicaciones: pubs.map((p) => ({
    serie: p.serie || '', numero: p.numero || null, titulo: p.titulo, autor: p.autor, fecha: p.fecha, fecha_texto: fechaTexto(p.fecha),
    minutos: p.lectura_minutos || null, proxima_prueba: p.proxima_prueba || '', resumen: p.resumen_feed || p.resumen_portada || p.bajada,
    url: `https://locomun.cl/analisis/${p.slug}.html`,
  })),
  monitor: estudios.map((e) => ({
    numero: e.numero, titulo: e.titulo, resumen: e.resumen, autor: e.autor, fecha_texto: e.fecha ? mesTexto(e.fecha).replace(' ', ' de ') : '',
    cifras: (e.cifras || []).slice(0, 3).map((c) => [c.valor, c.texto]), fuentes: e.fuentes, url: e.url,
  })),
};
const sinFecha = (f) => JSON.stringify({ ...f, actualizado: '' });
if (sinFecha(feed) !== sinFecha(feedPrevio)) escribir(feedRuta, JSON.stringify(feed, null, 1) + '\n');

/* ---------- sitemap.xml y llms.txt ---------- */
const propias = pubs.filter((p) => !(p.original && p.original.url));
const ultimaPub = (pubs[0] && pubs[0].fecha) || hoy;
const ultimoEst = (estudios[0] && estudios[0].fecha) || ultimaPub;
const urlsMapa = [`  <url><loc>${SITIO}/</loc><lastmod>${ultimaPub}</lastmod><priority>1.0</priority></url>`]
  .concat(SECCIONES.slice(1).map(([v, , r]) => `  <url><loc>${SITIO}${r}</loc>${v === 'publicaciones' ? `<lastmod>${ultimaPub}</lastmod>` : v === 'monitor' ? `<lastmod>${ultimoEst}</lastmod>` : ''}<priority>0.9</priority></url>`))
  .concat(propias.map((p) => `  <url><loc>${urlPropia(p)}</loc><lastmod>${esc(p.fecha_modificacion || p.fecha)}</lastmod><priority>0.8</priority></url>`));
escribir('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsMapa.join('\n')}\n</urlset>\n`);

const lineaPub = (p) => {
  const t = p.serie ? `${p.serie} ${numeroTexto(p)}: ${p.titulo_corto || p.titulo}` : (p.titulo_corto || p.titulo);
  return `- [${textoPlano(t)}](${urlDePagina(p)}): ${textoPlano(p.resumen_portada || p.bajada || p.titulo)} (${p.autor}, ${fechaTexto(p.fecha)})`;
};
const lineaEst = (e) => `- [${textoPlano(e.titulo)}](${e.url}): ${textoPlano(e.resumen_corto || e.resumen)} (${e.autor})`;
const llms = `# Lo Común

> Lo Común: Laboratorio de Relato y Producción Narrativa. Traduce la teoría política en relato, dispositivos de comunicación pública y medición para el trabajo parlamentario del espacio progresista y liberal chileno, con método público y verdad de hecho.

Lo Común publica su producción bajo licencia CC BY-SA 4.0 y la expone a la crítica con ficha epistémica, condiciones de refutación y fechas de verificación. Sus codirectores son Bernardo de Las Heras y Esteban Pinto. Es una entidad independiente del Congreso Nacional y de la Biblioteca del Congreso Nacional.

## Secciones del sitio

- [Inicio](${SITIO}/): tesis, diagnósticos, funciones y condiciones de una acción comunicativa correcta.
- [Método](${SITIO}/metodo.html): cómo se convierte un concepto teórico en una herramienta; quince herramientas y cuatro secuencias de aplicación.
- [Publicaciones](${SITIO}/publicaciones.html): serie Prueba pública, registro público de predicciones, protocolo de aportes e índice de coherencia.
- [Monitor económico](${SITIO}/monitor.html): estudios de mercado de materias que discute el Congreso.
- [Código ético](${SITIO}/etica.html): reglas de trabajo verificables, compromisos con clientes y límites.
- [Equipo](${SITIO}/equipo.html): biografías de los codirectores.
- [Aportes y contacto](${SITIO}/aportes.html): encargos, aportes de autores y aportes voluntarios.

## Publicaciones

${pubs.map(lineaPub).join('\n')}

## Monitor económico

${estudios.map(lineaEst).join('\n')}

## Producto relacionado

- [Urgencias Kast](https://urgenciaskast.cl/): seguimiento gratuito de los proyectos con urgencia del Ejecutivo y de la agenda legislativa de dos semanas, con fichas por proyecto.

## Contacto y licencia

- Correo: contacto@locomun.cl
- Licencia de la producción pública: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
`;
escribir('llms.txt', llms);

console.log(`Construido: ${pubs.length} publicaciones, ${estudios.length} estudios.`);
