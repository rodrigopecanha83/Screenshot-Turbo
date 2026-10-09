(async () => {
  const originalScrollTop = window.scrollY || window.pageYOffset || 0;
  const originalScrollLeft = window.scrollX || window.pageXOffset || 0;

  const docEl = document.documentElement;
  const body = document.body || { scrollWidth: 0, scrollHeight: 0, offsetWidth: 0, offsetHeight: 0 };

  const fullWidth = Math.max(
    docEl.scrollWidth || 0,
    body.scrollWidth || 0,
    docEl.offsetWidth || 0,
    docEl.clientWidth || 0
  );

  const fullHeight = Math.max(
    docEl.scrollHeight || 0,
    body.scrollHeight || 0,
    docEl.offsetHeight || 0,
    docEl.clientHeight || 0
  );

  const viewportWidth = window.innerWidth || docEl.clientWidth || 1280;
  const viewportHeight = window.innerHeight || docEl.clientHeight || 800;
  const dpr = window.devicePixelRatio || 1;

  // Salva no objeto window para controle do background worker
  window.__sstFullPageContext = {
    fullWidth,
    fullHeight,
    viewportWidth,
    viewportHeight,
    dpr,
    originalScrollTop,
    originalScrollLeft,
    fixedElements: []
  };

  // Coleta elementos fixos
  try {
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed') {
        window.__sstFullPageContext.fixedElements.push({ el, originalVisibility: style.visibility });
      }
    });
  } catch (e) {}

  return {
    fullWidth,
    fullHeight,
    viewportWidth,
    viewportHeight,
    dpr,
    url: window.location.href,
    domain: window.location.hostname
  };
})();
