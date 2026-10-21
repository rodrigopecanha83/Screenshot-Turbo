/**
 * Script de Conteúdo: Interface de Seleção e Overlay Interativo
 */
(() => {
  // Evita injeção e ouvintes de mensagens duplicados
  if (window.__sstScriptLoaded) {
    return;
  }
  window.__sstScriptLoaded = true;

  let overlay = null;
  let maskTop, maskBottom, maskLeft, maskRight;
  let selectionBox = null;
  let toolbar = null;
  let isDragging = false;
  let isResizing = false;
  let resizeHandle = null;
  let startX = 0, startY = 0;
  let currentRect = { x: 0, y: 0, w: 0, h: 0 };
  let options = {
    ratio: 'free',
    orientation: 'landscape',
    mode: 'free_selection'
  };

  const RATIO_MAP = {
    '1:1': { w: 1, h: 1 },
    '3:2': { w: 3, h: 2 },
    '4:3': { w: 4, h: 3 },
    '5:4': { w: 5, h: 4 },
    '16:9': { w: 16, h: 9 }
  };

  // Escuta mensagens do background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'INIT_SELECTION_OVERLAY') {
      options = { ...options, ...message.options };
      initOverlay();
      sendResponse({ status: 'overlay_initialized' });
    } else if (message.type === 'FULL_PAGE_PROGRESS') {
      showProgressToast(message.progress, message.statusText);
      sendResponse({ status: 'progress_updated' });
    } else if (message.type === 'SET_TOAST_VISIBILITY') {
      setToastVisibility(message.visible);
      sendResponse({ status: 'visibility_updated' });
    } else if (message.type === 'CAPTURE_ERROR') {
      window.__sstCaptureHasError = true;
      showErrorToast(message.message);
      sendResponse({ status: 'error_displayed' });
    } else if (message.type === 'FULL_PAGE_COMPLETE') {
      if (!window.__sstCaptureHasError) {
        showSuccessToast();
      }
      sendResponse({ status: 'progress_cleared' });
    }
    return true;
  });

  function initOverlay() {
    removeOverlay();
    window.__sstOverlayActive = true;

    overlay = document.createElement('div');
    overlay.id = 'sst-capture-overlay';

    // 4 máscaras para criar a transparência no recorte
    maskTop = createMask();
    maskBottom = createMask();
    maskLeft = createMask();
    maskRight = createMask();

    overlay.appendChild(maskTop);
    overlay.appendChild(maskBottom);
    overlay.appendChild(maskLeft);
    overlay.appendChild(maskRight);

    // Dica inicial
    const hint = document.createElement('div');
    hint.id = 'sst-overlay-hint';
    hint.textContent = options.ratio !== 'free'
      ? `Proporção ${options.ratio} (${options.orientation}) — Clique e arraste para selecionar (ESC para sair)`
      : 'Clique e arraste para selecionar a área desejada (ESC para cancelar)';
    overlay.appendChild(hint);

    // Box de seleção
    selectionBox = document.createElement('div');
    selectionBox.id = 'sst-selection-box';
    selectionBox.style.display = 'none';

    // 8 Alças de redimensionamento
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    handles.forEach(pos => {
      const handle = document.createElement('div');
      handle.className = `sst-handle sst-handle-${pos}`;
      handle.dataset.handle = pos;
      selectionBox.appendChild(handle);
    });

    // Toolbar com botões e info de dimensões
    toolbar = document.createElement('div');
    toolbar.id = 'sst-toolbar';
    toolbar.style.display = 'none';
    toolbar.innerHTML = `
      <span class="sst-dimensions-badge" id="sst-dim">0 × 0 px</span>
      ${options.ratio !== 'free' ? `<span class="sst-ratio-badge">${options.ratio}</span>` : ''}
      <button class="sst-btn sst-btn-confirm" id="sst-btn-confirm">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Confirmar
      </button>
      <button class="sst-btn sst-btn-copy" id="sst-btn-copy" title="Copiar seleção para a área de transferência">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        Copiar
      </button>
      <button class="sst-btn sst-btn-save" id="sst-btn-save" title="Salvar direto, sem abrir o editor">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Salvar
      </button>
      <button class="sst-btn sst-btn-cancel" id="sst-btn-cancel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        Cancelar
      </button>
    `;
    overlay.appendChild(toolbar);
    overlay.appendChild(selectionBox);

    document.body.appendChild(overlay);

    // Eventos de Mouse e Teclado
    overlay.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);

    // Ações dos botões da barra
    toolbar.querySelector('#sst-btn-confirm').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmSelection('editor');
    });

    toolbar.querySelector('#sst-btn-copy').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmSelection('copy');
    });

    toolbar.querySelector('#sst-btn-save').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmSelection('save');
    });

    toolbar.querySelector('#sst-btn-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      removeOverlay();
    });

    updateMasks(0, 0, 0, 0);
  }

  function createMask() {
    const el = document.createElement('div');
    el.className = 'sst-mask';
    return el;
  }

  function updateMasks(x, y, w, h) {
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    maskTop.style.top = '0px';
    maskTop.style.left = '0px';
    maskTop.style.width = '100%';
    maskTop.style.height = `${Math.max(0, y)}px`;

    maskBottom.style.top = `${y + h}px`;
    maskBottom.style.left = '0px';
    maskBottom.style.width = '100%';
    maskBottom.style.height = `${Math.max(0, winH - (y + h))}px`;

    maskLeft.style.top = `${y}px`;
    maskLeft.style.left = '0px';
    maskLeft.style.width = `${Math.max(0, x)}px`;
    maskLeft.style.height = `${h}px`;

    maskRight.style.top = `${y}px`;
    maskRight.style.left = `${x + w}px`;
    maskRight.style.width = `${Math.max(0, winW - (x + w))}px`;
    maskRight.style.height = `${h}px`;
  }

  function applyAspectRatio(w, h, originHandle) {
    if (options.ratio === 'free' || !RATIO_MAP[options.ratio]) {
      return { w, h };
    }

    let { w: rw, h: rh } = RATIO_MAP[options.ratio];

    // Para 1:1, a orientação é sempre quadrada
    if (options.ratio === '1:1') {
      const size = Math.max(Math.abs(w), Math.abs(h));
      return {
        w: (w < 0 ? -1 : 1) * size,
        h: (h < 0 ? -1 : 1) * size
      };
    }

    // Detecção dinâmica e automática de orientação:
    // Se o usuário arrastar mais na vertical do que na horizontal (|h| > |w|),
    // alterna automaticamente para Retrato (Vertical). Caso contrário, Paisagem (Horizontal).
    const isPortrait = Math.abs(h) > Math.abs(w);
    options.orientation = isPortrait ? 'portrait' : 'landscape';

    let targetRatio = isPortrait ? (rh / rw) : (rw / rh);

    let absW = Math.abs(w);
    let absH = Math.abs(h);

    let targetW, targetH;
    if (absW >= absH) {
      targetW = absW;
      targetH = targetW / targetRatio;
    } else {
      targetH = absH;
      targetW = targetH * targetRatio;
    }

    return {
      w: (w < 0 ? -1 : 1) * targetW,
      h: (h < 0 ? -1 : 1) * targetH
    };
  }

  function onMouseDown(e) {
    if (e.target.closest('#sst-toolbar')) return;

    if (e.target.classList.contains('sst-handle')) {
      isResizing = true;
      resizeHandle = e.target.dataset.handle;
      startX = e.clientX;
      startY = e.clientY;
      return;
    }

    if (e.target === selectionBox) {
      isDragging = true;
      startX = e.clientX - currentRect.x;
      startY = e.clientY - currentRect.y;
      return;
    }

    // Início de nova seleção
    isDragging = false;
    isResizing = true;
    resizeHandle = 'se';
    startX = e.clientX;
    startY = e.clientY;
    currentRect = { x: startX, y: startY, w: 0, h: 0 };
    renderSelection();
  }

  function onMouseMove(e) {
    if (!overlay || (!isDragging && !isResizing)) return;

    const winW = window.innerWidth;
    const winH = window.innerHeight;

    if (isDragging) {
      let newX = e.clientX - startX;
      let newY = e.clientY - startY;

      // Limita às bordas da janela
      newX = Math.max(0, Math.min(newX, winW - currentRect.w));
      newY = Math.max(0, Math.min(newY, winH - currentRect.h));

      currentRect.x = newX;
      currentRect.y = newY;
      renderSelection();
      return;
    }

    if (isResizing) {
      let dx = e.clientX - startX;
      let dy = e.clientY - startY;

      if (!selectionBox.style.display || selectionBox.style.display === 'none') {
        selectionBox.style.display = 'block';
        toolbar.style.display = 'flex';
      }

      let newX = startX;
      let newY = startY;
      let newW = dx;
      let newH = dy;

      if (options.ratio !== 'free') {
        const adjusted = applyAspectRatio(newW, newH, resizeHandle);
        newW = adjusted.w;
        newH = adjusted.h;
      }

      let finalX = newW < 0 ? startX + newW : startX;
      let finalY = newH < 0 ? startY + newH : startY;
      let finalW = Math.abs(newW);
      let finalH = Math.abs(newH);

      // Limita à tela
      if (finalX < 0) { finalW += finalX; finalX = 0; }
      if (finalY < 0) { finalH += finalY; finalY = 0; }
      if (finalX + finalW > winW) { finalW = winW - finalX; }
      if (finalY + finalH > winH) { finalH = winH - finalY; }

      currentRect = {
        x: Math.round(finalX),
        y: Math.round(finalY),
        w: Math.round(finalW),
        h: Math.round(finalH)
      };

      renderSelection();
    }
  }

  function onMouseUp() {
    isDragging = false;
    isResizing = false;
    resizeHandle = null;

    if (currentRect.w > 10 && currentRect.h > 10) {
      const hint = document.getElementById('sst-overlay-hint');
      if (hint) hint.style.display = 'none';
    }
  }

  function renderSelection() {
    const { x, y, w, h } = currentRect;
    selectionBox.style.left = `${x}px`;
    selectionBox.style.top = `${y}px`;
    selectionBox.style.width = `${w}px`;
    selectionBox.style.height = `${h}px`;

    updateMasks(x, y, w, h);

    // Ajusta posição da barra de ferramentas
    const dpr = window.devicePixelRatio || 1;
    const realW = Math.round(w * dpr);
    const realH = Math.round(h * dpr);

    const dimBadge = toolbar.querySelector('#sst-dim');
    if (dimBadge) {
      dimBadge.textContent = `${realW} × ${realH} px`;
    }

    const ratioBadge = toolbar.querySelector('.sst-ratio-badge');
    if (ratioBadge && options.ratio !== 'free') {
      const orientLabel = options.orientation === 'portrait' ? 'Vertical' : 'Horizontal';
      ratioBadge.textContent = options.ratio === '1:1' ? '1:1 Quadrado' : `${options.ratio} ${orientLabel}`;
    }

    // Posiciona toolbar abaixo da seleção, ou acima se não couber
    const toolbarHeight = 45;
    const margin = 10;
    if (y + h + toolbarHeight + margin < window.innerHeight) {
      toolbar.style.top = `${y + h + margin}px`;
    } else if (y - toolbarHeight - margin > 0) {
      toolbar.style.top = `${y - toolbarHeight - margin}px`;
    } else {
      toolbar.style.top = `${y + 10}px`;
    }

    toolbar.style.left = `${Math.max(10, Math.min(x, window.innerWidth - 300))}px`;
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      removeOverlay();
    } else if (e.key === 'Enter' && currentRect.w > 10 && currentRect.h > 10) {
      confirmSelection('editor');
    }
  }

  async function confirmSelection(action = 'editor') {
    if (currentRect.w < 10 || currentRect.h < 10) {
      alert('Selecione uma área válida antes de prosseguir.');
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const selectionData = {
      x: currentRect.x,
      y: currentRect.y,
      width: currentRect.w,
      height: currentRect.h,
      devicePixelRatio: dpr,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      url: window.location.href,
      domain: window.location.hostname
    };

    // Remove imediatamente a sobreposição e as máscaras escuras do DOM
    removeOverlay();

    // Aguarda dois frames de renderização (requestAnimationFrame) + pequeno delay
    // para garantir que a GPU e o compositor do Chrome/Edge redesenhem a tela 100% limpa
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise((resolve) => setTimeout(resolve, 80));

    if (action === 'save' || action === true) {
      try {
        const res = await chrome.runtime.sendMessage({ type: 'CAPTURE_RAW' });
        if (!res || res.error || !res.dataUrl) throw new Error(res?.error || 'Falha na captura.');
        const cropped = await cropDataUrl(res.dataUrl, selectionData);
        const dl = await chrome.runtime.sendMessage({
          type: 'DOWNLOAD_IMAGE',
          blobUrl: cropped,
          autoName: true,
          domain: selectionData.domain || '',
          format: 'png',
          saveAs: false
        });
        if (dl && dl.success === false) throw new Error(dl.error);
      } catch (err) {
        showErrorToast(err.message);
      }
      return;
    }

    if (action === 'copy') {
      try {
        const res = await chrome.runtime.sendMessage({ type: 'CAPTURE_RAW' });
        if (!res || res.error || !res.dataUrl) throw new Error(res?.error || 'Falha na captura.');
        const cropped = await cropDataUrl(res.dataUrl, selectionData);
        const response = await fetch(cropped);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        showCopySuccessToast();
      } catch (err) {
        showErrorToast(err.message || 'Falha ao copiar imagem para a área de transferência.');
      }
      return;
    }

    // Notifica o service worker para tirar o screenshot limpo e abrir o editor
    chrome.runtime.sendMessage({
      type: 'SELECTION_CONFIRMED',
      selection: selectionData,
      options: options
    });
  }

  function cropDataUrl(dataUrl, sel) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Escala real entre a imagem capturada e a viewport
        const scale = img.naturalWidth / sel.windowWidth;
        const sx = Math.round(sel.x * scale);
        const sy = Math.round(sel.y * scale);
        const sw = Math.round(sel.width * scale);
        const sh = Math.round(sel.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Falha ao processar a imagem.'));
      img.src = dataUrl;
    });
  }

  function removeOverlay() {
    window.__sstOverlayActive = false;
    isDragging = false;
    isResizing = false;
    resizeHandle = null;
    currentRect = { x: 0, y: 0, w: 0, h: 0 };

    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('keydown', onKeyDown);

    if (overlay) {
      overlay.removeEventListener('mousedown', onMouseDown);
    }

    // Remove qualquer elemento de overlay existente na página
    const existingOverlays = document.querySelectorAll('#sst-capture-overlay');
    existingOverlays.forEach(el => el.remove());

    overlay = null;
    selectionBox = null;
    toolbar = null;
    maskTop = null;
    maskBottom = null;
    maskLeft = null;
    maskRight = null;
  }

  // Toast de progresso para captura de página inteira
  let progressToast = null;
  function showProgressToast(progress, statusText) {
    if (!progressToast) {
      progressToast = document.createElement('div');
      progressToast.id = 'sst-progress-toast';
      document.body.appendChild(progressToast);
    }
    progressToast.style.visibility = 'visible';
    progressToast.innerHTML = `
      <div style="font-weight:600; font-size:14px; display:flex; justify-content:space-between;">
        <span>ScreenShot Turbo</span>
        <span>${Math.round(progress)}%</span>
      </div>
      <div style="font-size:12px; color:#94a3b8;">${statusText || 'Capturando página inteira...'}</div>
      <div class="sst-progress-bar-bg">
        <div class="sst-progress-bar-fill" style="width: ${progress}%;"></div>
      </div>
    `;
  }

  function setToastVisibility(visible) {
    if (progressToast) {
      progressToast.style.visibility = visible ? 'visible' : 'hidden';
    }
  }

  function removeProgressToast() {
    if (progressToast && progressToast.parentNode) {
      progressToast.parentNode.removeChild(progressToast);
    }
    progressToast = null;
  }

  function showSuccessToast() {
    if (!progressToast) {
      progressToast = document.createElement('div');
      progressToast.id = 'sst-progress-toast';
      document.body.appendChild(progressToast);
    }
    progressToast.style.visibility = 'visible';
    progressToast.style.borderColor = 'rgba(74, 222, 128, 0.4)';
    progressToast.innerHTML = `
      <div style="font-weight:600; font-size:14px; color:#4ade80; display:flex; align-items:center; gap:8px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Captura concluída!
      </div>
      <div style="font-size:12px; color:#e2e8f0; margin-top:4px;">Abrindo editor de confirmação...</div>
      <div class="sst-progress-bar-bg" style="margin-top:8px;">
        <div class="sst-progress-bar-fill" style="width: 100%; background: #22c55e;"></div>
      </div>
    `;
    setTimeout(() => {
      removeProgressToast();
    }, 1500);
  }

  function showCopySuccessToast() {
    removeProgressToast();
    const copyToast = document.createElement('div');
    copyToast.id = 'sst-progress-toast';
    copyToast.style.borderColor = 'rgba(56, 189, 248, 0.5)';
    copyToast.innerHTML = `
      <div style="font-weight:600; font-size:14px; color:#38bdf8; display:flex; align-items:center; gap:8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Imagem copiada!
      </div>
      <div style="font-size:12px; color:#e2e8f0; margin-top:4px;">Pronta para colar onde quiser (Ctrl+V).</div>
    `;
    document.body.appendChild(copyToast);
    setTimeout(() => {
      if (copyToast.parentNode) copyToast.parentNode.removeChild(copyToast);
    }, 2000);
  }

  function showErrorToast(msg) {
    removeProgressToast();
    const errorToast = document.createElement('div');
    errorToast.id = 'sst-progress-toast';
    errorToast.style.border = '1px solid rgba(239, 68, 68, 0.6)';
    errorToast.innerHTML = `
      <div style="font-weight:600; font-size:14px; color:#f87171; display:flex; align-items:center; gap:8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        Erro na captura
      </div>
      <div style="font-size:12px; color:#e2e8f0;">${msg || 'Não foi possível completar a captura.'}</div>
    `;
    document.body.appendChild(errorToast);
    setTimeout(() => {
      if (errorToast.parentNode) errorToast.parentNode.removeChild(errorToast);
    }, 4500);
  }
})();
