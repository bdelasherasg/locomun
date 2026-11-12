/* Google Analytics con consentimiento previo.
   No se descarga ni se ejecuta nada de Google hasta que la persona acepta el aviso.
   La elección se guarda en el navegador y puede cambiarse desde el pie de página. */
(function () {
  'use strict';
  var IDS = {
    'locomun.cl': 'G-FPMX3J3FKV',
    'www.locomun.cl': 'G-FPMX3J3FKV',
    'urgenciaskast.cl': 'G-QFPFRNNBJ5',
    'www.urgenciaskast.cl': 'G-QFPFRNNBJ5'
  };
  var ID = IDS[location.hostname];
  if (!ID) return;
  var CLAVE = 'analitica-consentimiento';

  function leer() { try { return localStorage.getItem(CLAVE); } catch (e) { return null; } }
  function guardar(v) { try { localStorage.setItem(CLAVE, v); } catch (e) {} }

  function cargar() {
    if (window.__gaCargado) return;
    window.__gaCargado = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ID, { anonymize_ip: true });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(s);
  }

  function cerrar() {
    var b = document.getElementById('aviso-analitica');
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  function elegir(v) {
    guardar(v);
    cerrar();
    if (v === 'si') cargar();
  }

  function mostrar() {
    if (document.getElementById('aviso-analitica')) return;
    var d = document.createElement('div');
    d.id = 'aviso-analitica';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-live', 'polite');
    d.setAttribute('aria-label', 'Aviso sobre medición de visitas');
    d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;max-width:640px;margin:0 auto;z-index:2147483000;' +
      'background:#1f1d2b;color:#f6f0e2;border:1px solid rgba(246,240,226,.25);border-radius:14px;padding:16px 18px;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.35);font:14px/1.5 Figtree,Montserrat,system-ui,sans-serif';
    d.innerHTML = '<p style="margin:0 0 12px">Este sitio usa Google Analytics para medir cuántas personas lo visitan y qué páginas leen. ' +
      'Solo se activa si usted lo acepta, y los datos se usan únicamente para mejorar el sitio, no para publicidad.</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<button type="button" data-v="si" style="cursor:pointer;border:0;border-radius:999px;padding:9px 18px;background:#f6f0e2;color:#1f1d2b;font:600 14px Figtree,Montserrat,system-ui,sans-serif">Aceptar</button>' +
      '<button type="button" data-v="no" style="cursor:pointer;border:1px solid rgba(246,240,226,.5);border-radius:999px;padding:9px 18px;background:transparent;color:#f6f0e2;font:600 14px Figtree,Montserrat,system-ui,sans-serif">Rechazar</button>' +
      '</div>';
    d.addEventListener('click', function (e) {
      var v = e.target && e.target.getAttribute && e.target.getAttribute('data-v');
      if (v) elegir(v);
    });
    document.body.appendChild(d);
  }

  function enlacePie() {
    var pie = document.querySelector('footer');
    if (!pie || document.getElementById('cambiar-analitica')) return;
    var b = document.createElement('button');
    b.id = 'cambiar-analitica';
    b.type = 'button';
    b.textContent = 'Preferencias de medición de visitas';
    b.style.cssText = 'display:block;margin:14px auto 10px;background:none;border:0;padding:0;color:inherit;font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;opacity:.8';
    b.addEventListener('click', mostrar);
    pie.appendChild(b);
  }

  function iniciar() {
    enlacePie();
    var v = leer();
    if (v === 'si') cargar();
    else if (v !== 'no') mostrar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
