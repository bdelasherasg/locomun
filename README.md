# Lo Común · sitio

Sitio de Lo Común: Laboratorio de Relato y Producción Narrativa. Página estática para GitHub Pages.

- `index.html`: sitio completo; las secciones se muestran por ancla (`#metodo`, `#publicaciones`, `#monitor`, `#etica`, `#equipo`, `#aportes`).
- `img/`: fotografías de Wikimedia Commons (créditos y licencias en el pie del sitio).

Contenido bajo licencia CC BY-SA 4.0.

## Intercambio automático con Urgencias Kast

- `contenido/feed.json` resume las publicaciones y el Monitor económico de Lo Común. Urgencias Kast lo copia cada tres
  horas y muestra en su portada y en su serie Prueba pública lo que aquí se agregue. Al publicar una entrega o un
  estudio nuevo en este sitio, súmelo también a ese archivo (el más reciente primero).
- La tarjeta de Urgencias Kast en la portada lee `https://urgenciaskast.cl/data/feed.json` y muestra las cifras del
  día y los próximos plazos. Si ese archivo no responde, la tarjeta queda con su texto fijo.
