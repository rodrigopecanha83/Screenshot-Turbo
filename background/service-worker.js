import { MESSAGE_TYPES } from '../shared/constants.js';
import { getSettings, setTemporaryCaptureData } from '../shared/storage.js';
import { generateFilename } from '../shared/image-export.js';

// Armazenamento em memória do Service Worker para transferências ultra-rápidas
let memoryCaptureData = null;

// Utilitário de espera
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Captura aba ativa com retry inteligente, backoff e tratamento de rate-limit do Chrome
 */
async function captureTabWithRetry(windowId) {
  let lastErr = null;
  const targetWin = (typeof windowId === 'number' && windowId >= 0) ? windowId : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const winToUse = (attempt % 2 === 0) ? targetWin : null;
      const dataUrl = await chrome.tabs.captureVisibleTab(winToUse, { format: 'png' });
      if (dataUrl) return dataUrl;
    } catch (e) {
      lastErr = e;
      console.warn(`Tentativa ${attempt + 1}/5 de captureVisibleTab:`, e?.message || e);
      await sleep(600 + attempt * 200);
    }
  }
  throw lastErr || new Error('Falha ao capturar a janela do navegador. Tente novamente.');
}

/**
 * Escuta mensagens dos componentes (Popup, Content Script, Editor)
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Resposta assíncrona
});

/**
 * Escuta atalhos de teclado registrados no Manifest
 */
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || isRestrictedUrl(tab.url)) {
    return;
  }

  const settings = await getSettings();

  switch (command) {
    case 'capture-visible':
      startCaptureVisible(tab.id, settings);
      break;
    case 'capture-full-page':
      startCaptureFullPage(tab.id, settings);
      break;
    case 'capture-selection':
      injectOverlay(tab.id, { mode: 'free_selection', ratio: 'free', orientation: 'landscape' });
      break;
    case 'capture-ratio-1-1':
      injectOverlay(tab.id, { mode: 'ratio_selection', ratio: '1:1', orientation: 'landscape' });
      break;
    case 'capture-ratio-3-2':
      injectOverlay(tab.id, { mode: 'ratio_selection', ratio: '3:2', orientation: 'landscape' });
      break;
    case 'capture-ratio-4-3':
      injectOverlay(tab.id, { mode: 'ratio_selection', ratio: '4:3', orientation: 'landscape' });
      break;
    case 'capture-ratio-5-4':
      injectOverlay(tab.id, { mode: 'ratio_selection', ratio: '5:4', orientation: 'landscape' });
      break;
    case 'capture-ratio-16-9':
      injectOverlay(tab.id, { mode: 'ratio_selection', ratio: '16:9', orientation: 'landscape' });
      break;
  }
});

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case MESSAGE_TYPES.START_CAPTURE: {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          sendResponse({ error: 'Nenhuma aba ativa encontrada.' });
          return;
        }

        if (isRestrictedUrl(tab.url)) {
          sendResponse({
            error: 'Por motivos de segurança do navegador, extensões não podem capturar telas em páginas internas do sistema (chrome://, edge:// ou Web Store).'
          });
          return;
        }

        const settings = await getSettings();
        const mode = message.mode || settings.defaultMode;

        if (mode === 'visible') {
          await startCaptureVisible(tab.id, settings);
          sendResponse({ success: true });
        } else if (mode === 'full_page') {
          startCaptureFullPage(tab.id, settings);
          sendResponse({ success: true, status: 'started' });
        } else if (mode === 'free_selection' || mode === 'ratio_selection') {
          await injectOverlay(tab.id, {
            mode,
            ratio: message.ratio || 'free',
            orientation: message.orientation || 'landscape'
          });
          sendResponse({ success: true });
        }
        break;
      }

      case 'SELECTION_CONFIRMED': {
        const tabId = sender.tab ? sender.tab.id : null;
        if (!tabId) return;

        await sleep(50);

        const dataUrl = await captureTabWithRetry(sender.tab.windowId);
        const settings = await getSettings();

        const captureData = {
          type: 'selection',
          rawImageDataUrl: dataUrl,
          selection: message.selection,
          options: message.options,
          sourceUrl: message.selection.url,
          sourceDomain: message.selection.domain,
          timestamp: Date.now(),
          settings: settings
        };

        memoryCaptureData = captureData;
        await setTemporaryCaptureData(captureData);
        openEditorTab();
        sendResponse({ success: true });
        break;
      }

      case 'GET_CAPTURED_IMAGE': {
        sendResponse({ captureData: memoryCaptureData });
        break;
      }

      case 'CAPTURE_RAW': {
        // Captura simples para o fluxo "Salvar direto" (recorte feito na página)
        await sleep(50);
        const dataUrl = await captureTabWithRetry(sender.tab?.windowId);
        sendResponse({ dataUrl });
        break;
      }

      case 'DOWNLOAD_IMAGE': {
        const { blobUrl } = message;
        let { filename } = message;
        if (message.autoName || !filename) {
          const settings = await getSettings();
          filename = generateFilename({
            includePrefix: settings.includePrefix !== false,
            includeDomain: settings.includeDomain !== false,
            domain: message.domain || '',
            format: message.format || 'png'
          });
        }
        chrome.downloads.download({
          url: blobUrl,
          filename: filename,
          saveAs: message.saveAs !== false
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true, downloadId });
          }
        });
        break;
      }
    }
  } catch (err) {
    console.error('Erro no processamento do Service Worker:', err);
    sendResponse({ error: err.message });
  }
}

/**
 * Injeta o CSS e JS do overlay de seleção na aba especificada
 */
async function injectOverlay(tabId, options) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/capture-overlay.css']
    });

    // Tenta enviar mensagem diretamente caso o script já esteja injetado na página
    try {
      const res = await chrome.tabs.sendMessage(tabId, {
        type: 'INIT_SELECTION_OVERLAY',
        options
      });
      if (res && res.status === 'overlay_initialized') {
        return;
      }
    } catch (_) {
      // Script ainda não carregado nesta aba, injeta agora
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/capture-overlay.js']
    });

    await chrome.tabs.sendMessage(tabId, {
      type: 'INIT_SELECTION_OVERLAY',
      options
    });
  } catch (e) {
    console.error('Erro ao injetar overlay:', e);
  }
}

/**
 * Captura direta da janela visível
 */
async function startCaptureVisible(tabId, settings) {
  const tab = await chrome.tabs.get(tabId);
  const dataUrl = await captureTabWithRetry(tab.windowId);

  let domain = '';
  try {
    domain = new URL(tab.url).hostname;
  } catch (e) {}

  const captureData = {
    type: 'visible',
    rawImageDataUrl: dataUrl,
    sourceUrl: tab.url,
    sourceDomain: domain,
    timestamp: Date.now(),
    settings: settings
  };

  memoryCaptureData = captureData;
  await setTemporaryCaptureData(captureData);
  openEditorTab();
}

/**
 * Captura da página inteira universal e robusta
 */
async function startCaptureFullPage(tabId, settings) {
  const segments = [];
  let info = null;
  let tab = null;
  let totalHeight = 0;

  try {
    tab = await chrome.tabs.get(tabId);

    // Garante que a aba está focada para captura sem restrições
    try {
      await chrome.tabs.update(tabId, { active: true });
    } catch (e) {}

    // Injeta overlay de progresso
    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content/capture-overlay.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/capture-overlay.js']
      });
    } catch (e) {}

    chrome.tabs.sendMessage(tabId, {
      type: 'FULL_PAGE_PROGRESS',
      progress: 5,
      statusText: 'Iniciando captura...'
    }).catch(() => {});

    // 1. Diagnóstico do Scroller e Inicialização
    const [setupResult] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          // Salva posições originais de rolagem
          window.__sstOriginalScrollX = window.scrollX || window.pageXOffset || 0;
          window.__sstOriginalScrollY = window.scrollY || window.pageYOffset || 0;

          const doc = document.documentElement;
          const body = document.body;

          // Força scroll-behavior instantâneo para evitar que animações suaves atrasem o salto
          window.__sstOriginalDocScrollBehavior = doc.style.scrollBehavior || '';
          doc.style.setProperty('scroll-behavior', 'auto', 'important');
          if (body) {
            window.__sstOriginalBodyScrollBehavior = body.style.scrollBehavior || '';
            body.style.setProperty('scroll-behavior', 'auto', 'important');
          }

          // Salva e normaliza overflow caso estejam travados com overflow: hidden / height: 100%
          window.__sstOriginalDocOverflow = doc.style.overflow || '';
          window.__sstOriginalBodyOverflow = body ? (body.style.overflow || '') : '';

          // Remove qualquer marcação anterior
          const oldScroller = document.querySelector('[data-sst-scroller]');
          if (oldScroller) oldScroller.removeAttribute('data-sst-scroller');

          // Rola tudo para o topo antes de medir
          window.scrollTo(0, 0);
          doc.scrollTop = 0;
          if (body) body.scrollTop = 0;

          // Testa se o window rola nativamente
          window.scrollTo(0, 20);
          const windowScrolled = (window.scrollY || doc.scrollTop || (body ? body.scrollTop : 0)) > 0;
          window.scrollTo(0, 0);

          // Se a janela principal não rolou, tenta desbloquear overflow de html e body
          let windowScrolledAfterUnlock = false;
          if (!windowScrolled) {
            doc.style.setProperty('overflow', 'visible', 'important');
            if (body) body.style.setProperty('overflow', 'visible', 'important');
            window.scrollTo(0, 20);
            windowScrolledAfterUnlock = (window.scrollY || doc.scrollTop || (body ? body.scrollTop : 0)) > 0;
            window.scrollTo(0, 0);
          }

          // Procura por contêineres internos roláveis (comum em SPAs, dashboards e layouts fixos)
          let bestEl = null;
          let maxInternalH = 0;

          const allCandidates = document.querySelectorAll('*');
          for (const el of allCandidates) {
            try {
              if (el.clientHeight >= 200 && el.scrollHeight > el.clientHeight + 40) {
                const style = window.getComputedStyle(el);
                const ov = style.overflowY;
                if (ov === 'auto' || ov === 'scroll' || ov === 'overlay' || ov === 'visible') {
                  // Testa se o elemento realmente aceita rolagem
                  const oldTop = el.scrollTop;
                  el.scrollTop = oldTop + 15;
                  const canScroll = el.scrollTop > oldTop;
                  el.scrollTop = oldTop;

                  if (canScroll && el.scrollHeight > maxInternalH) {
                    maxInternalH = el.scrollHeight;
                    bestEl = el;
                  }
                }
              }
            } catch (e) {}
          }

          // Mede altura tradicional do documento
          const docHeight = Math.max(
            doc.scrollHeight || 0,
            body ? body.scrollHeight : 0,
            doc.offsetHeight || 0,
            body ? body.offsetHeight : 0,
            window.innerHeight
          );

          let scrollerType = 'window';
          let totalHeight = docHeight;

          // Se o window não rolou ou se o contêiner interno for o principal motor de rolagem
          if ((!windowScrolled && !windowScrolledAfterUnlock && bestEl) || (bestEl && maxInternalH > docHeight * 1.1)) {
            bestEl.setAttribute('data-sst-scroller', 'true');
            bestEl.style.setProperty('scroll-behavior', 'auto', 'important');
            bestEl.scrollTop = 0;
            scrollerType = 'element';
            totalHeight = maxInternalH;
          }

          return {
            success: true,
            scrollerType,
            totalHeight,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            dpr: window.devicePixelRatio || 1,
            domain: window.location.hostname || ''
          };
        } catch (err) {
          return {
            success: false,
            scrollerType: 'window',
            totalHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            dpr: window.devicePixelRatio || 1,
            domain: window.location.hostname || ''
          };
        }
      }
    });

    info = setupResult?.result || {
      scrollerType: 'window',
      totalHeight: 1200,
      viewportWidth: 1280,
      viewportHeight: 800,
      dpr: 1,
      domain: ''
    };

    totalHeight = info.totalHeight;
    const viewportHeight = info.viewportHeight;
    const viewportWidth = info.viewportWidth;
    const dpr = info.dpr || 1;

    let currentTargetY = 0;
    let step = 0;
    const MAX_STEPS = 60;
    let lastRecordedY = -1;

    // Aguarda o navegador estabilizar no topo
    await sleep(400);

    while (step < MAX_STEPS) {
      step++;

      const percent = Math.min(95, Math.round((currentTargetY / Math.max(1, totalHeight)) * 90) + 5);
      chrome.tabs.sendMessage(tabId, {
        type: 'FULL_PAGE_PROGRESS',
        progress: percent,
        statusText: `Capturando segmento ${step}...`
      }).catch(() => {});

      // Executa a rolagem até currentTargetY com suporte a headers fixos e fallback inteligente
      const [scrollStep] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (y, isFirst) => {
          try {
            // Oculta cabeçalhos fixos após o primeiro passo para não duplicar no recorte
            if (!isFirst) {
              try {
                const headers = document.querySelectorAll('header, [role="banner"], [class*="fixed-header"], [class*="nav-header"]');
                headers.forEach(h => {
                  const pos = window.getComputedStyle(h).position;
                  if (pos === 'fixed' || pos === 'sticky') {
                    if (!h.dataset.sstSavedVis) h.dataset.sstSavedVis = h.style.visibility || 'visible';
                    h.style.visibility = 'hidden';
                  }
                });
              } catch (e) {}
            }

            const scroller = document.querySelector('[data-sst-scroller="true"]');
            let actualY = 0;
            let currentDocHeight = window.innerHeight;

            if (scroller) {
              scroller.scrollTop = y;
              scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
              actualY = scroller.scrollTop;
              currentDocHeight = scroller.scrollHeight;
            } else {
              window.scrollTo({ top: y, left: 0, behavior: 'instant' });
              document.documentElement.scrollTop = y;
              if (document.body) document.body.scrollTop = y;
              window.dispatchEvent(new Event('scroll', { bubbles: true }));

              const doc = document.documentElement;
              const body = document.body;
              actualY = window.scrollY || window.pageYOffset || doc.scrollTop || (body ? body.scrollTop : 0) || 0;
              currentDocHeight = Math.max(
                doc.scrollHeight || 0,
                body ? body.scrollHeight : 0,
                doc.offsetHeight || 0,
                body ? body.offsetHeight : 0,
                window.innerHeight
              );

              // Fallback dinâmico: se window não rolou (actualY == 0 quando y > 0), localiza elemento rolável
              if (actualY === 0 && y > 0) {
                const candidates = document.querySelectorAll('*');
                for (const el of candidates) {
                  if (el.clientHeight >= 200 && el.scrollHeight > el.clientHeight + 40) {
                    el.scrollTop = y;
                    el.dispatchEvent(new Event('scroll', { bubbles: true }));
                    if (el.scrollTop > 0) {
                      el.setAttribute('data-sst-scroller', 'true');
                      actualY = el.scrollTop;
                      currentDocHeight = el.scrollHeight;
                      break;
                    }
                  }
                }
              }
            }

            return {
              actualY: Math.round(actualY),
              currentDocHeight
            };
          } catch (e) {
            return {
              actualY: y,
              currentDocHeight: y + window.innerHeight
            };
          }
        },
        args: [currentTargetY, step === 1]
      });

      const res = scrollStep?.result || { actualY: currentTargetY, currentDocHeight: totalHeight };
      const actualY = res.actualY;
      totalHeight = Math.max(totalHeight, res.currentDocHeight);

      // Intervalo seguro de 800ms: permite lazy load e evita rate-limit do Chrome
      await sleep(800);

      // Oculta toast antes do clique para que ele não apareça na imagem capturada
      chrome.tabs.sendMessage(tabId, { type: 'SET_TOAST_VISIBILITY', visible: false }).catch(() => {});
      await sleep(40);

      let dataUrl = null;
      try {
        dataUrl = await captureTabWithRetry(tab.windowId);
      } catch (capErr) {
        console.warn(`Falha na captura do segmento ${step}:`, capErr);
        if (segments.length > 0) {
          break; // Aproveita os segmentos já capturados
        } else {
          throw capErr;
        }
      } finally {
        chrome.tabs.sendMessage(tabId, { type: 'SET_TOAST_VISIBILITY', visible: true }).catch(() => {});
      }

      segments.push({
        scrollY: actualY,
        dataUrl: dataUrl
      });

      // Se a página for de apenas 1 tela
      if (totalHeight <= viewportHeight + 30) {
        break;
      }

      // Se o scroll não se moveu em relação ao passo anterior após o primeiro frame
      if (step > 1 && actualY === lastRecordedY) {
        break;
      }
      lastRecordedY = actualY;

      // Avança a rolagem com overlap para permitir junção perfeita
      currentTargetY += Math.max(200, viewportHeight - 80);

      if (currentTargetY >= totalHeight) {
        // Se ainda restam mais de 40px não visíveis no final, faz uma última captura no fundo
        const remaining = totalHeight - (actualY + viewportHeight);
        if (remaining > 40 && actualY < totalHeight - viewportHeight) {
          currentTargetY = totalHeight - viewportHeight;
        } else {
          break;
        }
      }
    }

  } catch (err) {
    console.error('Erro crítico ao capturar página inteira:', err);
    chrome.tabs.sendMessage(tabId, {
      type: 'CAPTURE_ERROR',
      message: err.message || 'Erro ao capturar página inteira.'
    }).catch(() => {});
  } finally {
    // Restaura cabeçalhos fixos, scroller, overflow e posição original
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          try {
            const headers = document.querySelectorAll('[data-sst-saved-vis]');
            headers.forEach(h => {
              h.style.visibility = h.dataset.sstSavedVis;
              delete h.dataset.sstSavedVis;
            });

            const scroller = document.querySelector('[data-sst-scroller]');
            if (scroller) {
              scroller.removeAttribute('data-sst-scroller');
            }

            document.documentElement.style.scrollBehavior = window.__sstOriginalDocScrollBehavior || '';
            if (document.body) {
              document.body.style.scrollBehavior = window.__sstOriginalBodyScrollBehavior || '';
            }

            if (window.__sstOriginalDocOverflow !== undefined) {
              document.documentElement.style.overflow = window.__sstOriginalDocOverflow;
            }
            if (document.body && window.__sstOriginalBodyOverflow !== undefined) {
              document.body.style.overflow = window.__sstOriginalBodyOverflow;
            }

            window.scrollTo(
              window.__sstOriginalScrollX || 0,
              window.__sstOriginalScrollY || 0
            );
          } catch (e) {}
        }
      });
    } catch (e) {}
  }

  // Prepara dados, persiste e abre o Editor imediatamente se tiver ao menos 1 segmento
  if (segments.length > 0) {
    const captureData = {
      type: 'full_page',
      segments: segments,
      totalWidth: info?.viewportWidth || 1280,
      totalHeight: totalHeight,
      viewportHeight: info?.viewportHeight || 800,
      devicePixelRatio: info?.dpr || 1,
      sourceUrl: tab?.url || '',
      sourceDomain: info?.domain || '',
      timestamp: Date.now(),
      settings: settings
    };

    memoryCaptureData = captureData;
    setTemporaryCaptureData(captureData).catch((e) => console.warn('Falha ao persistir captura (tamanho):', e));
    openEditorTab();
    chrome.tabs.sendMessage(tabId, { type: 'FULL_PAGE_COMPLETE' }).catch(() => {});
  } else {
    chrome.tabs.sendMessage(tabId, {
      type: 'CAPTURE_ERROR',
      message: 'Não foi possível capturar imagens desta página.'
    }).catch(() => {});
  }
}

function openEditorTab() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('editor/editor.html'),
    active: true
  });
}

function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('https://chrome.google.com/webstore') ||
    url.startsWith('https://microsoftedge.microsoft.com/addons') ||
    url.startsWith('about:') ||
    url.startsWith('view-source:')
  );
}
