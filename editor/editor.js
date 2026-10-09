import { getTemporaryCaptureData } from '../shared/storage.js';
import { canvasToBlob, loadImage, cropImageToCanvas, generateFilename } from '../shared/image-export.js';
import { RATIO_VALUES } from '../shared/constants.js';

let rawImage = null; // HTMLImageElement ou Canvas original completo
let canvas = null;
let ctx = null;
let currentCaptureData = null;

// Estados do Editor
let zoomLevel = 1.0;
let currentRatio = 'free';
let currentOrientation = 'landscape';
let currentFormat = 'png';
let currentQuality = 90;
let jpgBgColor = '#ffffff';

// Coordenadas de recorte relativo aos pixels reais da imagem original
let cropRect = { x: 0, y: 0, width: 0, height: 0 };
let isDraggingCrop = false;
let isResizingCrop = false;
let activeHandle = null;
let dragStartX = 0, dragStartY = 0;

document.addEventListener('DOMContentLoaded', async () => {
  canvas = document.getElementById('main-canvas');
  ctx = canvas.getContext('2d');

  await loadCapturedSession();
  setupUIEventListeners();
  setupCropInteractions();
});

async function loadCapturedSession() {
  try {
    currentCaptureData = await getTemporaryCaptureData();
    if (!currentCaptureData) {
      showToast('Nenhuma imagem capturada recente encontrada.');
      return;
    }

    // Define informações de origem
    const sourceEl = document.getElementById('source-domain');
    if (currentCaptureData.sourceDomain) {
      sourceEl.textContent = currentCaptureData.sourceDomain;
    }

    // Aplica configurações padrão da sessão
    if (currentCaptureData.settings) {
      currentFormat = currentCaptureData.settings.defaultFormat || 'png';
      currentQuality = currentFormat === 'webp' ? currentCaptureData.settings.webpQuality : currentCaptureData.settings.jpgQuality;
      jpgBgColor = currentCaptureData.settings.jpgBgColor || '#ffffff';
    }

    updateFormatButtons();

    // Processa a imagem de acordo com o tipo
    if (currentCaptureData.type === 'full_page') {
      rawImage = await stitchFullPageSegments(currentCaptureData.segments, currentCaptureData.totalWidth, currentCaptureData.totalHeight, currentCaptureData.devicePixelRatio);
    } else if (currentCaptureData.type === 'selection' && currentCaptureData.selection) {
      // Carrega a imagem da tela inteira e recorta a seleção inicial
      const baseImg = await loadImage(currentCaptureData.rawImageDataUrl);
      const sel = currentCaptureData.selection;
      const dpr = sel.devicePixelRatio || 1;
      
      // Recorte preciso considerando escala de dispositivo
      const croppedCanvas = cropImageToCanvas(baseImg, {
        x: sel.x * dpr,
        y: sel.y * dpr,
        width: sel.width * dpr,
        height: sel.height * dpr
      });
      rawImage = croppedCanvas;
    } else {
      // Captura visível simples
      rawImage = await loadImage(currentCaptureData.rawImageDataUrl);
    }

    // Inicializa o recorte com as dimensões totais da imagem original
    cropRect = {
      x: 0,
      y: 0,
      width: rawImage.width,
      height: rawImage.height
    };

    // Se o tipo for seleção direta feita na página, a imagem rawImage JÁ É o recorte exato com a proporção escolhida.
    // Apenas marcamos o chip da proporção na interface sem forçar um novo sub-recorte.
    if (currentCaptureData.options && currentCaptureData.options.ratio && currentCaptureData.options.ratio !== 'free') {
      currentRatio = currentCaptureData.options.ratio;
      currentOrientation = currentCaptureData.options.orientation || 'landscape';
      
      document.querySelectorAll('.ratio-chip').forEach(b => {
        b.classList.toggle('active', b.dataset.ratio === currentRatio);
      });

      const landBtn = document.getElementById('editor-orient-land');
      const portBtn = document.getElementById('editor-orient-port');
      if (landBtn && portBtn) {
        landBtn.classList.toggle('active', currentOrientation === 'landscape');
        portBtn.classList.toggle('active', currentOrientation === 'portrait');
      }

      if (currentCaptureData.type !== 'selection') {
        setRatio(currentCaptureData.options.ratio, currentOrientation);
      }
    }

    renderCanvas();
    autoFitZoom();
    updateFilenameInput();
    updateDimensionStats();
  } catch (err) {
    console.error('Erro ao carregar sessão no editor:', err);
    showToast(`Erro ao carregar imagem: ${err.message}`);
  }
}

/**
 * Costura os múltiplos segmentos da página inteira em um Canvas unificado
 */
async function stitchFullPageSegments(segments, totalWidth, totalHeight, dpr = 1) {
  if (!segments || segments.length === 0) {
    throw new Error('Nenhum segmento de imagem capturado.');
  }

  // Carrega todas as imagens
  const images = [];
  for (let i = 0; i < segments.length; i++) {
    const img = await loadImage(segments[i].dataUrl);
    images.push(img);
  }

  const canvasWidth = images[0].width;
  const viewportImgHeight = images[0].height;

  // Se houver apenas 1 segmento, retorna a imagem diretamente
  if (segments.length === 1) {
    const stitchCanvas = document.createElement('canvas');
    stitchCanvas.width = canvasWidth;
    stitchCanvas.height = viewportImgHeight;
    const stitchCtx = stitchCanvas.getContext('2d');
    stitchCtx.drawImage(images[0], 0, 0);
    return stitchCanvas;
  }

  // Calcula a distância de rolagem entre cada passo
  // scaleCSSToImage calcula a relação entre pixels CSS e pixels reais da imagem capturada
  const scale = canvasWidth / totalWidth;

  // Monta os cortes ordenados por avanço
  const slices = [];
  let totalCalculatedHeight = 0;

  // O primeiro segmento desenha a tela inteira (do topo 0 até viewportImgHeight)
  slices.push({
    img: images[0],
    srcY: 0,
    srcHeight: viewportImgHeight,
    destY: 0,
    destHeight: viewportImgHeight
  });
  totalCalculatedHeight = viewportImgHeight;

  for (let i = 1; i < segments.length; i++) {
    const prevSeg = segments[i - 1];
    const currSeg = segments[i];
    const currImg = images[i];

    // Distância percorrida em pixels CSS desde o último segmento
    const deltaY_css = currSeg.scrollY - prevSeg.scrollY;
    
    // Se o frame tiver exatamente a mesma posição do anterior (duplicata), ignora
    if (deltaY_css <= 0) {
      continue;
    }

    const deltaY_img = Math.round(deltaY_css * scale);

    // Se o avanço for menor que a altura da tela, pegamos apenas a parte nova (fundo da imagem)
    if (deltaY_img < viewportImgHeight) {
      const newContentHeight = Math.min(viewportImgHeight, deltaY_img);
      const srcY = viewportImgHeight - newContentHeight;
      slices.push({
        img: currImg,
        srcY: srcY,
        srcHeight: newContentHeight,
        destY: totalCalculatedHeight,
        destHeight: newContentHeight
      });
      totalCalculatedHeight += newContentHeight;
    } else {
      // Se avançou uma tela cheia ou mais
      slices.push({
        img: currImg,
        srcY: 0,
        srcHeight: viewportImgHeight,
        destY: totalCalculatedHeight,
        destHeight: viewportImgHeight
      });
      totalCalculatedHeight += viewportImgHeight;
    }
  }

  const stitchCanvas = document.createElement('canvas');
  stitchCanvas.width = canvasWidth;
  stitchCanvas.height = Math.max(viewportImgHeight, totalCalculatedHeight);

  const stitchCtx = stitchCanvas.getContext('2d');
  stitchCtx.imageSmoothingEnabled = true;

  for (let i = 0; i < slices.length; i++) {
    const s = slices[i];
    stitchCtx.drawImage(
      s.img,
      0, s.srcY, canvasWidth, s.srcHeight,
      0, s.destY, canvasWidth, s.destHeight
    );
  }

  return stitchCanvas;
}

function renderCanvas() {
  if (!rawImage) return;

  canvas.width = rawImage.width;
  canvas.height = rawImage.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(rawImage, 0, 0);

  updateCropOverlayVisual();
}

function updateCropOverlayVisual() {
  const cropBox = document.getElementById('crop-overlay-box');
  if (!cropBox) return;

  // Escala as coordenadas de acordo com o zoom visual atual
  const scaledX = cropRect.x * zoomLevel;
  const scaledY = cropRect.y * zoomLevel;
  const scaledW = cropRect.width * zoomLevel;
  const scaledH = cropRect.height * zoomLevel;

  cropBox.style.left = `${scaledX}px`;
  cropBox.style.top = `${scaledY}px`;
  cropBox.style.width = `${scaledW}px`;
  cropBox.style.height = `${scaledH}px`;

  // Atualiza visualização do canvas conforme o zoom
  canvas.style.width = `${rawImage.width * zoomLevel}px`;
  canvas.style.height = `${rawImage.height * zoomLevel}px`;

  document.getElementById('zoom-level-badge').textContent = `${Math.round(zoomLevel * 100)}%`;
  updateDimensionStats();
}

function updateDimensionStats() {
  document.getElementById('stat-width').textContent = `${Math.round(cropRect.width)} px`;
  document.getElementById('stat-height').textContent = `${Math.round(cropRect.height)} px`;
  document.getElementById('stat-ratio-display').textContent = `Proporção: ${currentRatio === 'free' ? 'Livre' : currentRatio} (${currentOrientation})`;
}

function setupUIEventListeners() {
  // Zoom Controls
  document.getElementById('btn-zoom-in').addEventListener('click', () => setZoom(zoomLevel + 0.15));
  document.getElementById('btn-zoom-out').addEventListener('click', () => setZoom(zoomLevel - 0.15));
  document.getElementById('btn-zoom-100').addEventListener('click', () => setZoom(1.0));
  document.getElementById('btn-zoom-fit').addEventListener('click', () => autoFitZoom());

  // Proporções
  document.querySelectorAll('.ratio-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ratio-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setRatio(btn.dataset.ratio, currentOrientation);
    });
  });

  // Orientação
  const landBtn = document.getElementById('editor-orient-land');
  const portBtn = document.getElementById('editor-orient-port');

  landBtn.addEventListener('click', () => {
    landBtn.classList.add('active');
    portBtn.classList.remove('active');
    currentOrientation = 'landscape';
    if (currentRatio !== 'free') setRatio(currentRatio, 'landscape');
  });

  portBtn.addEventListener('click', () => {
    portBtn.classList.add('active');
    landBtn.classList.remove('active');
    currentOrientation = 'portrait';
    if (currentRatio !== 'free') setRatio(currentRatio, 'portrait');
  });

  // Formatos
  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFormat = btn.dataset.format;
      updateFormatButtons();
      updateFilenameInput();
    });
  });

  // Slider de Qualidade
  const slider = document.getElementById('quality-slider');
  const qualityDisplay = document.getElementById('quality-val-display');
  slider.addEventListener('input', (e) => {
    currentQuality = parseInt(e.target.value, 10);
    qualityDisplay.textContent = `${currentQuality}%`;
  });

  // Cor de Fundo JPG
  const colorInput = document.getElementById('jpg-bg-color');
  const hexDisplay = document.getElementById('jpg-bg-hex');
  colorInput.addEventListener('input', (e) => {
    jpgBgColor = e.target.value;
    hexDisplay.textContent = jpgBgColor.toUpperCase();
  });

  // Restaurar Imagem Completa
  document.getElementById('btn-reset-crop').addEventListener('click', () => {
    cropRect = {
      x: 0,
      y: 0,
      width: rawImage.width,
      height: rawImage.height
    };
    currentRatio = 'free';
    document.querySelectorAll('.ratio-chip').forEach(b => {
      b.classList.toggle('active', b.dataset.ratio === 'free');
    });
    updateCropOverlayVisual();
    showToast('Recorte restaurado para a imagem original.');
  });

  // Copiar para Área de Transferência
  document.getElementById('btn-copy-clipboard').addEventListener('click', async () => {
    try {
      const cropped = cropImageToCanvas(rawImage, cropRect);
      const blob = await canvasToBlob(cropped, 'png');
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      showToast('Imagem copiada para a área de transferência!');
    } catch (err) {
      showToast(`Erro ao copiar imagem: ${err.message}`);
    }
  });

  // Salvar Imagem
  document.getElementById('btn-save-image').addEventListener('click', async () => {
    await executeSaveImage();
  });
}

function updateFormatButtons() {
  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.format === currentFormat);
  });

  const qualityCtrl = document.getElementById('quality-control-wrapper');
  const bgCtrl = document.getElementById('bg-color-wrapper');

  qualityCtrl.style.display = (currentFormat === 'jpg' || currentFormat === 'webp') ? 'flex' : 'none';
  bgCtrl.style.display = currentFormat === 'jpg' ? 'flex' : 'none';
}

function setZoom(val) {
  zoomLevel = Math.max(0.1, Math.min(3.0, val));
  updateCropOverlayVisual();
}

function autoFitZoom() {
  if (!rawImage) return;
  const container = document.getElementById('canvas-container');
  const availW = container.clientWidth - 80;
  const availH = container.clientHeight - 80;

  const scaleW = availW / rawImage.width;
  const scaleH = availH / rawImage.height;
  zoomLevel = Math.min(1.0, Math.min(scaleW, scaleH));
  updateCropOverlayVisual();
}

function setRatio(ratio, orientation) {
  currentRatio = ratio;
  currentOrientation = orientation;

  if (ratio === 'free' || !RATIO_VALUES[ratio]) {
    updateCropOverlayVisual();
    return;
  }

  let { w, h } = RATIO_VALUES[ratio];
  if (orientation === 'portrait' && ratio !== '1:1') {
    const temp = w;
    w = h;
    h = temp;
  }

  const targetRatio = w / h;
  let newW = cropRect.width;
  let newH = newW / targetRatio;

  if (newH > rawImage.height) {
    newH = rawImage.height;
    newW = newH * targetRatio;
  }

  // Centraliza na imagem se ultrapassar limites
  let newX = cropRect.x;
  let newY = cropRect.y;

  if (newX + newW > rawImage.width) {
    newX = Math.max(0, (rawImage.width - newW) / 2);
  }
  if (newY + newH > rawImage.height) {
    newY = Math.max(0, (rawImage.height - newH) / 2);
  }

  cropRect = {
    x: Math.round(newX),
    y: Math.round(newY),
    width: Math.round(newW),
    height: Math.round(newH)
  };

  updateCropOverlayVisual();
}

let initialCropRect = { x: 0, y: 0, width: 0, height: 0 };
let isCreatingNewCrop = false;

function setupCropInteractions() {
  const cropBox = document.getElementById('crop-overlay-box');
  const canvasWrapper = document.getElementById('canvas-wrapper');

  // 1. Interação sobre a caixa de recorte existente ou suas alças
  cropBox.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('crop-handle')) {
      isResizingCrop = true;
      activeHandle = e.target.dataset.handle;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialCropRect = { ...cropRect };
    } else {
      isDraggingCrop = true;
      dragStartX = e.clientX - (cropRect.x * zoomLevel);
      dragStartY = e.clientY - (cropRect.y * zoomLevel);
    }
    e.stopPropagation();
    e.preventDefault();
  });

  // 2. Clicar em qualquer ponto da imagem (fora do box) para desenhar um NOVO recorte a partir daquele ponto
  canvasWrapper.addEventListener('mousedown', (e) => {
    if (e.target.closest('#crop-overlay-box')) return;
    if (!rawImage) return;

    const rect = canvasWrapper.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / zoomLevel;
    const clickY = (e.clientY - rect.top) / zoomLevel;

    isCreatingNewCrop = true;
    dragStartX = Math.max(0, Math.min(rawImage.width, clickX));
    dragStartY = Math.max(0, Math.min(rawImage.height, clickY));

    cropRect = {
      x: Math.round(dragStartX),
      y: Math.round(dragStartY),
      width: 0,
      height: 0
    };

    updateCropOverlayVisual();
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!rawImage || (!isDraggingCrop && !isResizingCrop && !isCreatingNewCrop)) return;

    // A) Movendo a seleção inteira
    if (isDraggingCrop) {
      let nextScaledX = e.clientX - dragStartX;
      let nextScaledY = e.clientY - dragStartY;

      let realX = nextScaledX / zoomLevel;
      let realY = nextScaledY / zoomLevel;

      realX = Math.max(0, Math.min(realX, rawImage.width - cropRect.width));
      realY = Math.max(0, Math.min(realY, rawImage.height - cropRect.height));

      cropRect.x = Math.round(realX);
      cropRect.y = Math.round(realY);
      updateCropOverlayVisual();
      return;
    }

    // B) Desenhando um NOVO recorte do zero com clique e arraste
    if (isCreatingNewCrop) {
      const rect = canvasWrapper.getBoundingClientRect();
      const currentMouseX = Math.max(0, Math.min(rawImage.width, (e.clientX - rect.left) / zoomLevel));
      const currentMouseY = Math.max(0, Math.min(rawImage.height, (e.clientY - rect.top) / zoomLevel));

      let dx = currentMouseX - dragStartX;
      let dy = currentMouseY - dragStartY;

      let newW = dx;
      let newH = dy;

      if (currentRatio !== 'free' && RATIO_VALUES[currentRatio]) {
        let { w: rw, h: rh } = RATIO_VALUES[currentRatio];
        if (currentRatio === '1:1') {
          const maxDim = Math.max(Math.abs(newW), Math.abs(newH));
          newW = (newW < 0 ? -1 : 1) * maxDim;
          newH = (newH < 0 ? -1 : 1) * maxDim;
        } else {
          const isPortrait = Math.abs(dy) > Math.abs(dx);
          currentOrientation = isPortrait ? 'portrait' : 'landscape';
          const rTarget = isPortrait ? (rh / rw) : (rw / rh);

          let absW = Math.abs(newW);
          let absH = Math.abs(newH);
          if (absW >= absH) {
            newH = (newH < 0 ? -1 : 1) * (absW / rTarget);
          } else {
            newW = (newW < 0 ? -1 : 1) * (absH * rTarget);
          }
        }
      }

      let finalX = newW < 0 ? dragStartX + newW : dragStartX;
      let finalY = newH < 0 ? dragStartY + newH : dragStartY;
      let finalW = Math.abs(newW);
      let finalH = Math.abs(newH);

      // Limita às dimensões do Canvas
      if (finalX < 0) { finalW += finalX; finalX = 0; }
      if (finalY < 0) { finalH += finalY; finalY = 0; }
      if (finalX + finalW > rawImage.width) { finalW = rawImage.width - finalX; }
      if (finalY + finalH > rawImage.height) { finalH = rawImage.height - finalY; }

      cropRect = {
        x: Math.round(finalX),
        y: Math.round(finalY),
        width: Math.round(finalW),
        height: Math.round(finalH)
      };

      updateCropOverlayVisual();
      return;
    }

    // C) Redimensionando por QUALQUER UMA das 8 alças (nw, n, ne, e, se, s, sw, w)
    if (isResizingCrop && activeHandle) {
      const deltaX = (e.clientX - dragStartX) / zoomLevel;
      const deltaY = (e.clientY - dragStartY) / zoomLevel;

      let newX = initialCropRect.x;
      let newY = initialCropRect.y;
      let newW = initialCropRect.width;
      let newH = initialCropRect.height;

      // Alças que alteram a horizontal
      if (activeHandle.includes('e')) {
        newW = initialCropRect.width + deltaX;
      } else if (activeHandle.includes('w')) {
        newW = initialCropRect.width - deltaX;
        newX = initialCropRect.x + deltaX;
      }

      // Alças que alteram a vertical
      if (activeHandle.includes('s')) {
        newH = initialCropRect.height + deltaY;
      } else if (activeHandle.includes('n')) {
        newH = initialCropRect.height - deltaY;
        newY = initialCropRect.y + deltaY;
      }

      // Aplica proporção se não for livre
      if (currentRatio !== 'free' && RATIO_VALUES[currentRatio]) {
        let { w: rw, h: rh } = RATIO_VALUES[currentRatio];
        if (currentOrientation === 'portrait' && currentRatio !== '1:1') {
          const temp = rw; rw = rh; rh = temp;
        }
        const targetRatio = rw / rh;

        if (activeHandle === 'n' || activeHandle === 's') {
          newW = newH * targetRatio;
        } else {
          newH = newW / targetRatio;
        }
      }

      // Previne dimensões negativas
      if (newW < 20) { newW = 20; }
      if (newH < 20) { newH = 20; }

      // Limita aos limites reais da imagem
      if (newX < 0) { newX = 0; }
      if (newY < 0) { newY = 0; }
      if (newX + newW > rawImage.width) { newW = rawImage.width - newX; }
      if (newY + newH > rawImage.height) { newH = rawImage.height - newY; }

      cropRect = {
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH)
      };

      updateCropOverlayVisual();
    }
  });

  window.addEventListener('mouseup', () => {
    // Se desenhou um novo recorte muito pequeno, restaura para a imagem toda
    if (isCreatingNewCrop && (cropRect.width < 10 || cropRect.height < 10)) {
      cropRect = {
        x: 0,
        y: 0,
        width: rawImage.width,
        height: rawImage.height
      };
      updateCropOverlayVisual();
    }

    isDraggingCrop = false;
    isResizingCrop = false;
    isCreatingNewCrop = false;
    activeHandle = null;
  });
}

function updateFilenameInput() {
  const domain = (currentCaptureData && currentCaptureData.sourceDomain) || '';
  const fname = generateFilename({
    pattern: (currentCaptureData && currentCaptureData.settings && currentCaptureData.settings.filenamePattern) || 'captura_{date}_{time}',
    domain: domain,
    includeDomain: currentCaptureData && currentCaptureData.settings ? currentCaptureData.settings.includeDomain : true,
    format: currentFormat
  });
  document.getElementById('filename-preview').value = fname;
}

async function executeSaveImage() {
  try {
    const cropped = cropImageToCanvas(rawImage, cropRect);
    const blob = await canvasToBlob(cropped, currentFormat, currentQuality, jpgBgColor);
    const filename = document.getElementById('filename-preview').value || `captura.${currentFormat}`;
    const blobUrl = URL.createObjectURL(blob);

    // Solicita o download via service-worker (chrome.downloads)
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_IMAGE',
      blobUrl: blobUrl,
      filename: filename
    }, (response) => {
      if (response && response.success) {
        showToast('Imagem salva com sucesso!');
      } else {
        // Fallback nativo caso o chrome.downloads falhe ou exija diálogo direto
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.click();
        showToast('Download iniciado!');
      }
    });
  } catch (err) {
    showToast(`Erro ao salvar: ${err.message}`);
  }
}

function showToast(msg) {
  const toast = document.getElementById('editor-toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3500);
}
