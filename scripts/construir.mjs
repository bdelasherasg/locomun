// Construye las partes del sitio que dependen del contenido.
//
// Fuente: contenido/publicaciones/*.json (con su cuerpo en *.html) y contenido/monitor/*.json.
// Salida: los bloques marcados de index.html, las páginas analisis/<slug>.html y contenido/feed.json.
//
// Uso: node scripts/construir.mjs   (lo ejecuta la acción de GitHub en cada cambio de contenido)
import fs from 'node:fs';
import path from 'node:path';

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
  if (!re.test(html)) throw new Error(`Falta el marcador auto:${nombre} en index.html`);
  return html.replace(re, (_, a, b) => `${a}\n${contenido}\n${b}`);
}

const numeroTexto = (p) => (p.numero ? `N.° ${p.numero}` : p.clase);
const etiquetaSerie = (p) => (p.serie ? `Serie ${p.serie} · ${numeroTexto(p)} · ${fechaTexto(p.fecha)}` : `${p.clase} · ${fechaTexto(p.fecha)}`);

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
${(p.presentacion || [p.bajada]).map((x) => `          <p>${rico(x)}</p>`).join('\n')}
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
          <p style="font-size:1rem;max-width:var(--measure)">${esc(e.resumen)}</p>
          <ul class="cifras">
${(e.cifras || []).map((c) => `            <li><b>${esc(c.valor)}</b><span>${esc(c.texto)}</span></li>`).join('\n')}
          </ul>
          <dl class="kv"><div><dt>Autor</dt><dd>${esc(e.autor)}</dd></div>${e.revision ? `<div><dt>Revisión</dt><dd>${esc(e.revision)}</dd></div>` : ''}<div><dt>Fuentes</dt><dd>${esc(e.fuentes)}</dd></div></dl>
          <a class="btn btn-ink" href="${esc(e.url)}" target="_blank" rel="noopener" style="justify-self:start">Ver estudio completo <span class="arrow">→</span></a>
        </div>
      </article>`;
}

function portada() {
  const p = pubs[0], e = estudios[0];
  const out = [];
  if (p) {
    const anterior = pubs.find((x) => x !== p && x.serie === p.serie);
    out.push(`        <article class="ficha">
          <div class="ficha-h"><span>${esc(p.serie || p.clase)}</span><span>${esc(numeroTexto(p))}</span></div>
          <div class="ficha-b">
            <h3>${esc(p.titulo_corto || p.titulo)}</h3>
            <p>${esc(p.resumen_portada || p.bajada)}${anterior ? ` La entrega ${esc(numeroTexto(anterior))} está en Publicaciones.` : ''}</p>
            <dl class="kv"><div><dt>Autor</dt><dd>${esc(p.autor)}</dd></div><div><dt>Fecha</dt><dd>${fechaTexto(p.fecha)}</dd></div>${p.proxima_prueba ? `<div><dt>Próxima prueba</dt><dd>${esc(p.proxima_prueba)}</dd></div>` : ''}</dl>
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
            <p>${esc(e.resumen_corto || e.resumen)}${otros.length ? ` También en el Monitor: ${esc(otros.join('; '))}.` : ''}</p>
            <dl class="kv"><div><dt>Autor</dt><dd>${esc(e.autor)}</dd></div>${e.fuente_base ? `<div><dt>Fuente base</dt><dd>${esc(e.fuente_base)}</dd></div>` : ''}</dl>
            <a class="more" href="#monitor">Ver en el Monitor <span class="arrow">→</span></a>
          </div>
        </article>`);
  }
  return out.join('\n');
}

let index = leer('index.html');
index = reemplazar(index, 'publicaciones', pubs.map(bloquePublicacion).join('\n'));
index = reemplazar(index, 'predicciones', filasPredicciones());
index = reemplazar(index, 'monitor', estudios.map(tarjetaEstudio).join('\n\n'));
index = reemplazar(index, 'portada', portada());
// Las secciones fijas que siguen a las publicaciones mantienen la alternancia de fondos.
['registro', 'protocolo', 'indice'].forEach((id, k) => {
  const alt = (pubs.length + k) % 2 === 1;
  index = index.replace(new RegExp(`<section class="sec( sec-alt)?" aria-labelledby="t-${id}">`), `<section class="${alt ? 'sec sec-alt' : 'sec'}" aria-labelledby="t-${id}">`);
});
escribir('index.html', index);

/* ---------- páginas de artículo ---------- */
const i0 = index.indexOf('<style>\n/* Layout');
const cssSitio = index.slice(i0, index.indexOf('</style>', i0) + 8);
const cabecera = index.slice(index.indexOf('<header class="top">'), index.indexOf('</header>') + 9).replace(/href="#/g, 'href="../#');
const pie = index.slice(index.indexOf('<footer class="foot">'), index.indexOf('</footer>') + 9).replace(/href="#/g, 'href="../#');
const cssArticulo = leer('scripts/articulo.css');

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
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(tituloPagina)} · Lo Común</title>
<meta name="description" content="${esc(p.resumen_portada || p.bajada)}">
<meta property="og:title" content="${esc(tituloPagina)}">
<meta property="og:description" content="${esc(p.resumen_portada || p.bajada)}">
<meta property="og:type" content="article">
${p.original ? `<link rel="canonical" href="${esc(p.original.url)}">\n` : ''}<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap">
${cssSitio}
<style>
${cssArticulo}</style>
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
      <p class="lead-art">${rico(p.bajada)}</p>
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
      <a class="btn btn-ink" href="../#publicaciones" style="justify-self:start">Volver a Publicaciones <span class="arrow">→</span></a>
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

console.log(`Construido: ${pubs.length} publicaciones, ${estudios.length} estudios.`);
