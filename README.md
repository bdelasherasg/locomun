# Lo Común · sitio

Sitio de Lo Común: Laboratorio de Relato y Producción Narrativa. Página estática para GitHub Pages.

- `fuente/sitio.html`: fuente del sitio, con todas las secciones en un solo archivo. Los cambios de texto del sitio se hacen aquí.
- `index.html`, `metodo.html`, `publicaciones.html`, `monitor.html`, `etica.html`, `equipo.html` y `aportes.html`: una página por sección, generadas desde `fuente/sitio.html`; no se editan a mano. Los enlaces antiguos con ancla (`locomun.cl/#metodo`) llevan a la página de la sección.
- `img/`: fotografías de Wikimedia Commons (créditos y licencias en el pie del sitio).

Contenido bajo licencia CC BY-SA 4.0.

## Intercambio automático con Urgencias Kast

- `contenido/feed.json` resume las publicaciones y el Monitor económico de Lo Común. Urgencias Kast lo copia cada tres
  horas y muestra en su portada y en su serie Prueba pública lo que aquí se agregue. Al publicar una entrega o un
  estudio nuevo en este sitio, súmelo también a ese archivo (el más reciente primero).
- La tarjeta de Urgencias Kast en la portada lee `https://urgenciaskast.cl/data/feed.json` y muestra las cifras del
  día y los próximos plazos. Si ese archivo no responde, la tarjeta queda con su texto fijo.

## Contenido y construcción

Las publicaciones y los estudios del Monitor viven como datos en `contenido/`:

- `contenido/publicaciones/<slug>.json`: ficha de cada artículo (título, bajada, ficha epistémica, predicciones). Su texto está en `<slug>.html`.
- `contenido/monitor/<slug>.json`: tarjeta de cada estudio (resumen, cifras, enlace al Google Site).

`node scripts/construir.mjs` regenera desde esos datos los bloques marcados `<!-- auto:... -->` de `fuente/sitio.html`, la portada y las páginas de cada sección, las páginas `analisis/<slug>.html` y `contenido/feed.json`. Una acción de GitHub lo ejecuta en cada cambio de `contenido/`, de modo que el panel de Lo Común solo escribe datos. No edite a mano lo que está entre los marcadores: se sobrescribe.

Para retirar una publicación o un estudio sin borrarlo, agregue `"retirado": true` a su archivo.
