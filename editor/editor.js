import { getTemporaryCaptureData, getSettings, saveSettings } from '../shared/storage.js';
import { canvasToBlob, loadImage, cropImageToCanvas, generateFilename } from '../shared/image-export.js';
import { RATIO_VALUES, SAVE_PICKER_ID } from '../shared/constants.js';

let rawImage = null; // HTMLImageElement ou Canvas original completo
let canvas = null;
let ctx = null;
let currentCaptureData = null;

// Instância do Fabric.js
let fabricCanvas = null;
let activeTool = 'select'; // 'select', 'text', 'arrow', 'rect', 'circle', 'draw'

// Cores e Propriedades de Anotação
let strokeColor = '#ef4444';
let fillColor = '#ffeb3b';
let isFillTransparent = true;
let strokeWidth = 4;

// Variáveis de desenho de formas/setas
let isDrawingShape = false;
let shapeStartX = 0, shapeStartY = 0;
let activeDrawingObject = null;

// Variáveis de Polilinha (Linhas contínuas ponto a ponto)
let polylinePoints = [];
let polylineActiveLine = null;
let polylineTempLines = [];

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
  setupAnnotationTools();
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

    initFabricCanvas();
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
 * Inicializa o Fabric.js sobre o elemento canvas principal
 */
function initFabricCanvas() {
  if (fabricCanvas) {
    fabricCanvas.dispose();
  }

  fabricCanvas = new fabric.Canvas('main-canvas', {
    selection: true,
    preserveObjectStacking: true
  });

  // Eventos de teclas para apagar objetos (Delete / Backspace) e finalizar polilinha (Enter / Escape)
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === 'Escape') && activeTool === 'polyline') {
      finishPolyline(e.key === 'Escape');
      return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && fabricCanvas) {
      const activeObj = fabricCanvas.getActiveObject();
      // Se não estiver editando texto ativamente no canvas
      if (activeObj && !activeObj.isEditing) {
        if (activeObj.type === 'activeSelection') {
          activeObj.forEachObject(obj => fabricCanvas.remove(obj));
          fabricCanvas.discardActiveObject();
        } else {
          fabricCanvas.remove(activeObj);
        }
        fabricCanvas.requestRenderAll();
      }
    }
  });

  // Lógica para desenhar formas interativamente (Retângulo, Círculo, Seta, Linha, Polilinha)
  fabricCanvas.on('mouse:down', (options) => {
    if (activeTool === 'select' || activeTool === 'draw') return;

    const pointer = fabricCanvas.getPointer(options.e);
    shapeStartX = pointer.x;
    shapeStartY = pointer.y;

    if (activeTool === 'polyline') {
      handlePolylineClick(pointer);
      return;
    }

    if (activeTool === 'text') {
      const text = new fabric.IText('Seu texto aqui', {
        left: pointer.x,
        top: pointer.y,
        fontSize: Math.max(16, strokeWidth * 5),
        fill: strokeColor,
        backgroundColor: isFillTransparent ? 'transparent' : fillColor,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      });
      fabricCanvas.add(text);
      fabricCanvas.setActiveObject(text);
      text.enterEditing();
      text.selectAll();
      setActiveTool('select');
      return;
    }

    isDrawingShape = true;
    const currentFill = isFillTransparent ? 'transparent' : fillColor;

    if (activeTool === 'rect') {
      activeDrawingObject = new fabric.Rect({
        left: shapeStartX,
        top: shapeStartY,
        width: 0,
        height: 0,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: currentFill,
        rx: 4,
        ry: 4
      });
    } else if (activeTool === 'circle') {
      activeDrawingObject = new fabric.Ellipse({
        left: shapeStartX,
        top: shapeStartY,
        rx: 0,
        ry: 0,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: currentFill
      });
    } else if (activeTool === 'line') {
      activeDrawingObject = new fabric.Line([shapeStartX, shapeStartY, shapeStartX, shapeStartY], {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeLineCap: 'round',
        selectable: true,
        hasBorders: true
      });
    } else if (activeTool === 'arrow') {
      const points = [shapeStartX, shapeStartY, shapeStartX, shapeStartY];
      activeDrawingObject = createArrowGroup(points, strokeColor, strokeWidth);
    }

    if (activeDrawingObject) {
      fabricCanvas.add(activeDrawingObject);
    }
  });

  fabricCanvas.on('mouse:move', (options) => {
    const pointer = fabricCanvas.getPointer(options.e);

    if (activeTool === 'polyline') {
      handlePolylineMove(pointer);
      return;
    }

    if (!isDrawingShape || !activeDrawingObject) return;

    if (activeTool === 'rect') {
      const width = Math.abs(pointer.x - shapeStartX);
      const height = Math.abs(pointer.y - shapeStartY);
      activeDrawingObject.set({
        left: Math.min(pointer.x, shapeStartX),
        top: Math.min(pointer.y, shapeStartY),
        width: width,
        height: height
      });
    } else if (activeTool === 'circle') {
      const rx = Math.abs(pointer.x - shapeStartX) / 2;
      const ry = Math.abs(pointer.y - shapeStartY) / 2;
      activeDrawingObject.set({
        left: Math.min(pointer.x, shapeStartX),
        top: Math.min(pointer.y, shapeStartY),
        rx: rx,
        ry: ry
      });
    } else if (activeTool === 'line') {
      activeDrawingObject.set({
        x2: pointer.x,
        y2: pointer.y
      });
    } else if (activeTool === 'arrow') {
      fabricCanvas.remove(activeDrawingObject);
      const points = [shapeStartX, shapeStartY, pointer.x, pointer.y];
      activeDrawingObject = createArrowGroup(points, strokeColor, strokeWidth);
      fabricCanvas.add(activeDrawingObject);
    }

    fabricCanvas.requestRenderAll();
  });

  fabricCanvas.on('mouse:dblclick', () => {
    if (activeTool === 'polyline') {
      finishPolyline();
    }
  });

  fabricCanvas.on('mouse:up', () => {
    if (isDrawingShape) {
      isDrawingShape = false;
      if (activeDrawingObject) {
        activeDrawingObject.setCoords();
      }
      activeDrawingObject = null;
    }
  });
}

/**
 * Funções auxiliares para a ferramenta Polilinha (Linha Contínua ponto a ponto)
 */
function handlePolylineClick(pointer) {
  polylinePoints.push({ x: pointer.x, y: pointer.y });

  if (polylinePoints.length === 1) {
    // Primeiro ponto: cria a linha elástica ativa
    polylineActiveLine = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      strokeDashArray: [4, 4],
      selectable: false,
      evented: false
    });
    fabricCanvas.add(polylineActiveLine);
  } else {
    // Ponto subsequente: fixa o segmento anterior visualmente
    const prev = polylinePoints[polylinePoints.length - 2];
    const segment = new fabric.Line([prev.x, prev.y, pointer.x, pointer.y], {
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      strokeLineCap: 'round',
      selectable: false,
      evented: false
    });
    fabricCanvas.add(segment);
    polylineTempLines.push(segment);

    // Reposiciona a linha ativa para partir deste novo ponto
    if (polylineActiveLine) {
      polylineActiveLine.set({
        x1: pointer.x,
        y1: pointer.y,
        x2: pointer.x,
        y2: pointer.y
      });
    }
  }

  fabricCanvas.requestRenderAll();
}

function handlePolylineMove(pointer) {
  if (polylinePoints.length > 0 && polylineActiveLine) {
    polylineActiveLine.set({
      x2: pointer.x,
      y2: pointer.y
    });
    fabricCanvas.requestRenderAll();
  }
}

function finishPolyline(cancel = false) {
  // Limpa linha elástica e linhas temporárias
  if (polylineActiveLine) {
    fabricCanvas.remove(polylineActiveLine);
    polylineActiveLine = null;
  }

  polylineTempLines.forEach(l => fabricCanvas.remove(l));
  polylineTempLines = [];

  if (!cancel && polylinePoints.length >= 2) {
    // Cria o objeto Polyline oficial no Fabric.js
    const poly = new fabric.Polyline(polylinePoints.map(p => ({ x: p.x, y: p.y })), {
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      fill: 'transparent',
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      selectable: true,
      hasBorders: true
    });
    fabricCanvas.add(poly);
  }

  polylinePoints = [];
  fabricCanvas.requestRenderAll();
}

/**
 * Cria um grupo de Seta (Linha + Triângulo na ponta) no Fabric.js
 */
function createArrowGroup(points, color, width) {
  const x1 = points[0], y1 = points[1], x2 = points[2], y2 = points[3];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  const line = new fabric.Line(points, {
    stroke: color,
    strokeWidth: width,
    originX: 'center',
    originY: 'center'
  });

  const headSize = Math.max(12, width * 3);
  const triangle = new fabric.Triangle({
    left: x2,
    top: y2,
    pointType: 'arrow_head',
    angle: angle + 90,
    width: headSize,
    height: headSize,
    fill: color,
    originX: 'center',
    originY: 'center'
  });

  return new fabric.Group([line, triangle], {
    selectable: true,
    hasBorders: true
  });
}

/**
 * Configura botões de ferramentas de desenho e eventos de propriedade (cor, largura)
 */
function setupAnnotationTools() {
  const toolBtns = {
    select: document.getElementById('tool-select'),
    text: document.getElementById('tool-text'),
    arrow: document.getElementById('tool-arrow'),
    line: document.getElementById('tool-line'),
    polyline: document.getElementById('tool-polyline'),
    rect: document.getElementById('tool-rect'),
    circle: document.getElementById('tool-circle'),
    crop: document.getElementById('tool-crop'),
    draw: document.getElementById('tool-draw')
  };

  Object.keys(toolBtns).forEach(toolName => {
    const btn = toolBtns[toolName];
    if (btn) {
      btn.addEventListener('click', () => setActiveTool(toolName));
    }
  });

  // Seletor de Cor da Linha/Texto
  const strokeColorInput = document.getElementById('draw-stroke-color');
  strokeColorInput.addEventListener('input', (e) => {
    strokeColor = e.target.value;
    updateSelectedObjectProps();
  });

  // Seletor de Cor de Fundo
  const fillColorInput = document.getElementById('draw-fill-color');
  fillColorInput.addEventListener('input', (e) => {
    fillColor = e.target.value;
    updateSelectedObjectProps();
  });

  // Fundo Transparente Checkbox
  const fillTransCheckbox = document.getElementById('draw-fill-transparent');
  fillTransCheckbox.addEventListener('change', (e) => {
    isFillTransparent = e.target.checked;
    updateSelectedObjectProps();
  });

  // Espessura / Tamanho Slider
  const strokeWidthSlider = document.getElementById('draw-stroke-width');
  const strokeWidthVal = document.getElementById('stroke-width-val');
  strokeWidthSlider.addEventListener('input', (e) => {
    strokeWidth = parseInt(e.target.value, 10);
    strokeWidthVal.textContent = `${strokeWidth}px`;
    updateSelectedObjectProps();
  });

  // Botão Apagar Selecionado
  document.getElementById('btn-delete-selected').addEventListener('click', () => {
    if (!fabricCanvas) return;
    const activeObj = fabricCanvas.getActiveObject();
    if (activeObj) {
      if (activeObj.type === 'activeSelection') {
        activeObj.forEachObject(obj => fabricCanvas.remove(obj));
        fabricCanvas.discardActiveObject();
      } else {
        fabricCanvas.remove(activeObj);
      }
      fabricCanvas.requestRenderAll();
    }
  });
}

function setActiveTool(toolName) {
  if (activeTool === 'polyline' && toolName !== 'polyline') {
    finishPolyline();
  }

  activeTool = toolName;

  document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`tool-${toolName}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Modo recorte: a máscara passa a receber o mouse; nos demais, o Fabric recebe
  const wrapper = document.getElementById('canvas-wrapper');
  if (wrapper) wrapper.classList.toggle('crop-mode', toolName === 'crop');

  if (!fabricCanvas) return;

  if (toolName === 'crop') {
    fabricCanvas.isDrawingMode = false;
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
    return;
  }

  if (toolName === 'draw') {
    fabricCanvas.isDrawingMode = true;
    fabricCanvas.freeDrawingBrush.color = strokeColor;
    fabricCanvas.freeDrawingBrush.width = strokeWidth;
  } else {
    fabricCanvas.isDrawingMode = false;
    fabricCanvas.selection = (toolName === 'select');
    fabricCanvas.forEachObject(obj => {
      obj.selectable = (toolName === 'select');
    });
  }
}

function updateSelectedObjectProps() {
  if (!fabricCanvas) return;
  const currentFill = isFillTransparent ? 'transparent' : fillColor;

  // Atualiza pincel se estiver em modo livre
  if (fabricCanvas.isDrawingMode) {
    fabricCanvas.freeDrawingBrush.color = strokeColor;
    fabricCanvas.freeDrawingBrush.width = strokeWidth;
  }

  const activeObj = fabricCanvas.getActiveObject();
  if (!activeObj) return;

  if (activeObj.type === 'i-text' || activeObj.type === 'text') {
    activeObj.set({
      fill: strokeColor,
      backgroundColor: currentFill,
      fontSize: Math.max(16, strokeWidth * 5)
    });
  } else if (activeObj.type === 'rect' || activeObj.type === 'ellipse') {
    activeObj.set({
      stroke: strokeColor,
      fill: currentFill,
      strokeWidth: strokeWidth
    });
  } else if (activeObj.type === 'line' || activeObj.type === 'polyline') {
    activeObj.set({
      stroke: strokeColor,
      strokeWidth: strokeWidth
    });
  } else if (activeObj.type === 'group') {
    // Para grupos como a Seta
    activeObj.forEachObject(child => {
      if (child.type === 'line') {
        child.set({ stroke: strokeColor, strokeWidth: strokeWidth });
      } else if (child.type === 'triangle') {
        child.set({ fill: strokeColor });
      }
    });
  } else if (activeObj.type === 'path') {
    activeObj.set({ stroke: strokeColor, strokeWidth: strokeWidth });
  }

  fabricCanvas.requestRenderAll();
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

  const scale = canvasWidth / totalWidth;
  const slices = [];
  let totalCalculatedHeight = 0;

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

    const deltaY_css = currSeg.scrollY - prevSeg.scrollY;
    if (deltaY_css <= 0) continue;

    const deltaY_img = Math.round(deltaY_css * scale);

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
  if (!rawImage || !fabricCanvas) return;

  fabricCanvas.setWidth(rawImage.width);
  fabricCanvas.setHeight(rawImage.height);

  // Define a imagem capturada como fundo do Fabric.js
  const bgImg = new fabric.Image(rawImage, {
    selectable: false,
    evented: false,
    originX: 'left',
    originY: 'top'
  });

  fabricCanvas.setBackgroundImage(bgImg, fabricCanvas.renderAll.bind(fabricCanvas));
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

  // Atualiza visualização do canvas conforme o zoom usando Fabric.js
  if (fabricCanvas) {
    fabricCanvas.setZoom(zoomLevel);
    fabricCanvas.setWidth(rawImage.width * zoomLevel);
    fabricCanvas.setHeight(rawImage.height * zoomLevel);
  }

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
      setActiveTool('crop');
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
    btn.addEventListener('click', async () => {
      currentFormat = btn.dataset.format;
      updateFormatButtons();
      updateFilenameInput();

      // Atualiza a preferência do usuário para que o salvamento rápido e futuras edições usem o novo formato
      try {
        const currentSettings = await getSettings();
        currentSettings.defaultFormat = currentFormat;
        await saveSettings(currentSettings);
      } catch (e) {
        console.warn('Falha ao sincronizar formato padrão nas configurações:', e);
      }
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
      const fullAnnotatedCanvas = getFullAnnotatedCanvas();
      const cropped = cropImageToCanvas(fullAnnotatedCanvas, cropRect);
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

/**
 * Exporta o Canvas do Fabric.js com zoom 1.0 (resolução real) combinando fundo e anotações
 */
function getFullAnnotatedCanvas() {
  if (!fabricCanvas) return rawImage;
  
  // Desativa temporariamente o zoom do Fabric para renderizar os pixels reais 1:1
  const prevZoom = fabricCanvas.getZoom();
  fabricCanvas.setZoom(1.0);
  fabricCanvas.setWidth(rawImage.width);
  fabricCanvas.setHeight(rawImage.height);
  fabricCanvas.renderAll();

  // Exporta o canvas elemento HTML DOM original do Fabric
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = rawImage.width;
  exportCanvas.height = rawImage.height;
  const eCtx = exportCanvas.getContext('2d');
  
  eCtx.drawImage(fabricCanvas.getElement(), 0, 0);

  // Restaura o zoom visual do Fabric
  fabricCanvas.setZoom(prevZoom);
  fabricCanvas.setWidth(rawImage.width * prevZoom);
  fabricCanvas.setHeight(rawImage.height * prevZoom);
  fabricCanvas.renderAll();

  return exportCanvas;
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

  // Interação sobre a caixa de recorte existente
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

  window.addEventListener('mousemove', (e) => {
    if (!rawImage || (!isDraggingCrop && !isResizingCrop && !isCreatingNewCrop)) return;

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

    if (isResizingCrop && activeHandle) {
      const deltaX = (e.clientX - dragStartX) / zoomLevel;
      const deltaY = (e.clientY - dragStartY) / zoomLevel;

      let newX = initialCropRect.x;
      let newY = initialCropRect.y;
      let newW = initialCropRect.width;
      let newH = initialCropRect.height;

      if (activeHandle.includes('e')) {
        newW = initialCropRect.width + deltaX;
      } else if (activeHandle.includes('w')) {
        newW = initialCropRect.width - deltaX;
        newX = initialCropRect.x + deltaX;
      }

      if (activeHandle.includes('s')) {
        newH = initialCropRect.height + deltaY;
      } else if (activeHandle.includes('n')) {
        newH = initialCropRect.height - deltaY;
        newY = initialCropRect.y + deltaY;
      }

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

      if (newW < 20) { newW = 20; }
      if (newH < 20) { newH = 20; }

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
    isDraggingCrop = false;
    isResizingCrop = false;
    isCreatingNewCrop = false;
    activeHandle = null;
  });
}

function updateFilenameInput() {
  const settings = (currentCaptureData && currentCaptureData.settings) || {};
  const fname = generateFilename({
    includePrefix: settings.includePrefix !== false,
    includeDomain: settings.includeDomain !== false,
    domain: (currentCaptureData && currentCaptureData.sourceDomain) || '',
    format: currentFormat
  });
  document.getElementById('filename-preview').value = fname;
}

// Salva via seletor nativo (showSaveFilePicker) com o ID compartilhado SAVE_PICKER_ID.
// O Salvamento Rápido usa a mesma origem (chrome-extension://) e o mesmo ID, então ambos
// abrem na última pasta usada. Fallback: chrome.downloads (sempre parte da pasta Downloads).
async function executeSaveImage() {
  const filename = document.getElementById('filename-preview').value || `captura.${currentFormat}`;

  if (typeof window.showSaveFilePicker === 'function') {
    let fileHandle = null;
    try {
      const ext = currentFormat === 'jpeg' ? 'jpg' : currentFormat;
      const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      // Abre a janela ANTES de gerar a imagem para não perder a ativação do clique do usuário
      fileHandle = await window.showSaveFilePicker({
        id: SAVE_PICKER_ID,
        suggestedName: filename,
        types: [{ description: `Imagem ${ext.toUpperCase()}`, accept: { [mime]: [`.${ext}`] } }]
      });
    } catch (err) {
      if (err && err.name === 'AbortError') return; // Usuário cancelou
      console.warn('showSaveFilePicker indisponível, usando downloads:', err);
    }

    if (fileHandle) {
      try {
        const blob = await buildExportBlob();
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        showToast(`Imagem salva: ${fileHandle.name}`);
      } catch (err) {
        showToast(`Erro ao salvar: ${err.message}`);
      }
      return;
    }
  }

  try {
    const blob = await buildExportBlob();
    const blobUrl = URL.createObjectURL(blob);

    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_IMAGE',
      blobUrl: blobUrl,
      filename: filename,
      saveAs: true
    }, (response) => {
      if (response && response.success) {
        showToast('Imagem salva com sucesso!');
      } else {
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

async function buildExportBlob() {
  const fullAnnotatedCanvas = getFullAnnotatedCanvas();
  const cropped = cropImageToCanvas(fullAnnotatedCanvas, cropRect);
  return canvasToBlob(cropped, currentFormat, currentQuality, jpgBgColor);
}

function showToast(msg) {
  const toast = document.getElementById('editor-toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3500);
}

