import { MIME_TYPES } from './constants.js';

/**
 * Utilitários para exportação e conversão de imagens usando HTML Canvas
 */

/**
 * Converte um Canvas em Blob com formato e qualidade especificados
 * @param {HTMLCanvasElement} canvas 
 * @param {string} format 'png' | 'jpg' | 'webp'
 * @param {number} quality 1 a 100
 * @param {string} bgColor Cor de fundo (ex: '#ffffff') para formatos sem suporte à transparência como JPEG
 * @returns {Promise<Blob>}
 */
export async function canvasToBlob(canvas, format = 'png', quality = 90, bgColor = '#ffffff') {
  const normFormat = format.toLowerCase() === 'jpeg' ? 'jpg' : format.toLowerCase();
  const mimeType = MIME_TYPES[normFormat] || 'image/png';
  const qualityFactor = quality / 100;

  // Se for JPG, cria um canvas com fundo preenchido para evitar artefatos pretos em áreas transparentes
  let targetCanvas = canvas;
  if (normFormat === 'jpg') {
    targetCanvas = document.createElement('canvas');
    targetCanvas.width = canvas.width;
    targetCanvas.height = canvas.height;
    const ctx = targetCanvas.getContext('2d');
    ctx.fillStyle = bgColor || '#ffffff';
    ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.drawImage(canvas, 0, 0);
  }

  return new Promise((resolve, reject) => {
    targetCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`Falha ao exportar imagem no formato ${format}.`));
          return;
        }
        resolve(blob);
      },
      mimeType,
      qualityFactor
    );
  });
}

/**
 * Converte DataURL ou Blob para HTMLImageElement
 * @param {string|Blob} src 
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://'))) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Erro ao carregar a imagem na memória.'));
    if (typeof src === 'string') {
      img.src = src;
    } else if (src instanceof Blob) {
      img.src = URL.createObjectURL(src);
    }
  });
}

/**
 * Realiza recorte de imagem em Canvas
 * @param {HTMLImageElement|HTMLCanvasElement} source 
 * @param {Object} cropRect { x, y, width, height }
 * @returns {HTMLCanvasElement}
 */
export function cropImageToCanvas(source, cropRect) {
  const { x, y, width, height } = cropRect;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    source,
    Math.round(x),
    Math.round(y),
    Math.round(width),
    Math.round(height),
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas;
}

/**
 * Gera o nome de arquivo formatado
 * @param {Object} options 
 * @returns {string}
 */
export function generateFilename({
  pattern = 'captura_{date}_{time}',
  domain = '',
  includeDomain = true,
  format = 'png'
}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hours}-${minutes}-${seconds}`;

  let name = pattern
    .replace('{date}', dateStr)
    .replace('{time}', timeStr);

  if (includeDomain && domain) {
    // Limpa caracteres especiais do domínio
    const cleanDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_');
    name = `${cleanDomain}_${name}`;
  }

  // Limpa caracteres ilegais para nomes de arquivo
  name = name.replace(/[<>:"/\\|?*]/g, '_');

  const ext = format.toLowerCase() === 'jpeg' ? 'jpg' : format.toLowerCase();
  return `${name}.${ext}`;
}
