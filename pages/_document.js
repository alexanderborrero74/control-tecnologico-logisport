// pages/_document.js
import Document, { Html, Head, Main, NextScript } from "next/document";

export default class MyDocument extends Document {
  render() {
    // Enforcer global: reubica cualquier cápsula (actual o futura) arriba-izquierda
    // Estrategia:
    // 1) Busca nodos con position:fixed cuyo texto contiene "Ciberseguridad".
    // 2) Aplica top/left con prioridad 'important'.
    // 3) Refuerza cada 250ms y ante cualquier mutación del DOM.
    const enforcer = `
(function () {
  const TEXT_MARKER = /ciberseguridad/i;

  function isFixed(el) {
    const s = window.getComputedStyle(el);
    return s && s.position === 'fixed';
  }

  function looksLikeCapsule(el) {
    if (!el || el.nodeType !== 1) return false;
    // Evita tocar scripts/iframes/etc
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'IFRAME') return false;

    // Texto visible
    let txt = '';
    try { txt = (el.innerText || el.textContent || '').slice(0, 2000); } catch {}
    if (!txt || !TEXT_MARKER.test(txt)) return false;

    // Debe ser fixed o contener un hijo fixed (algunas estructuras envuelven el panel)
    if (isFixed(el)) return true;
    for (const child of el.querySelectorAll('*')) {
      if (isFixed(child)) return true;
    }
    return false;
  }

  function applyTopLeft(el) {
    // Si el propio el no es fixed, busca el descendiente fixed y aplica ahí
    let target = isFixed(el) ? el : null;
    if (!target) {
      target = [...el.querySelectorAll('*')].find(isFixed);
      if (!target) return;
    }
    try {
      target.style.setProperty('position', 'fixed', 'important');
      target.style.setProperty('top', '24px', 'important');
      target.style.setProperty('left', '20px', 'important');
      target.style.setProperty('right', 'auto', 'important');
      target.style.setProperty('bottom', 'auto', 'important');
      target.style.setProperty('transform', 'none', 'important');
      target.style.setProperty('z-index', '2147483647', 'important');
    } catch (e) {
      target.style.position = 'fixed';
      target.style.top = '24px';
      target.style.left = '20px';
      target.style.right = 'auto';
      target.style.bottom = 'auto';
      target.style.transform = 'none';
      target.style.zIndex = 2147483647;
    }
  }

  function scanAndFix(root) {
    const scope = root && root.nodeType === 1 ? root : document.body;
    if (!scope) return;

    // 1) Elementos marcados explícitamente (si existen en tu proyecto)
    const explicit = scope.querySelectorAll('#capsula-flotante, .capsula-flotante, [data-capsula-flotante]');
    explicit.forEach(applyTopLeft);

    // 2) Elementos por contenido (Ciberseguridad) + posición fixed
    // Recorremos bloques razonables (evitamos tocar todo el DOM en bruto)
    const candidates = scope.querySelectorAll('div, section, aside, article, header, footer');
    candidates.forEach((el) => {
      if (looksLikeCapsule(el)) applyTopLeft(el);
    });
  }

  function init() {
    scanAndFix(document.body);

    // Refuerzo periódico
    const interval = setInterval(() => scanAndFix(document.body), 250);

    // Observa cualquier cambio en el DOM
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes && m.addedNodes.forEach((n) => scanAndFix(n));
        } else if (m.type === 'attributes') {
          scanAndFix(m.target);
        }
      }
    });
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    // Limpieza al navegar/salir
    window.addEventListener('beforeunload', function () {
      clearInterval(interval);
      observer.disconnect();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
    `;

    return (
      <Html lang="es">
        <Head />
        <body>
          <Main />
          <NextScript />
          <script dangerouslySetInnerHTML={{ __html: enforcer }} />
        </body>
      </Html>
    );
  }
}
