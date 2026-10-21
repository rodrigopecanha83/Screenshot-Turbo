/**
 * Constantes globais do ScreenShot Turbo
 */
export const CAPTURE_MODES = {
  VISIBLE: 'visible',
  FULL_PAGE: 'full_page',
  FREE_SELECTION: 'free_selection',
  RATIO_SELECTION: 'ratio_selection'
};

export const ASPECT_RATIOS = {
  FREE: 'free',
  RATIO_1_1: '1:1',
  RATIO_3_2: '3:2',
  RATIO_4_3: '4:3',
  RATIO_5_4: '5:4',
  RATIO_16_9: '16:9'
};

export const RATIO_VALUES = {
  '1:1': { w: 1, h: 1 },
  '3:2': { w: 3, h: 2 },
  '4:3': { w: 4, h: 3 },
  '5:4': { w: 5, h: 4 },
  '16:9': { w: 16, h: 9 }
};

export const FILENAME_PREFIX = 'ScreenShot-Turbo';

export const ORIENTATIONS = {
  LANDSCAPE: 'landscape',
  PORTRAIT: 'portrait'
};

export const EXPORT_FORMATS = {
  PNG: 'png',
  JPG: 'jpg',
  WEBP: 'webp'
};

export const MIME_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp'
};

export const DEFAULT_SETTINGS = {
  defaultMode: 'visible',
  operationMode: 'manual', // 'manual' ou 'auto'
  defaultRatio: 'free',
  defaultOrientation: 'landscape',
  defaultFormat: 'png',
  jpgQuality: 90,
  webpQuality: 90,
  jpgBgColor: '#ffffff',
  activePreset: 'default',
  includePrefix: true, // Prefixo "ScreenShot-Turbo" no nome do arquivo
  includeDomain: true, // Domínio do site após a data/hora
  autoOpenEditor: true,
  presets: [
    {
      id: 'default',
      name: 'Padrão (PNG Alta Qualidade)',
      mode: 'visible',
      ratio: 'free',
      orientation: 'landscape',
      format: 'png',
      jpgQuality: 90,
      webpQuality: 90
    },
    {
      id: 'social_square',
      name: 'Social Square (1:1 WebP)',
      mode: 'ratio_selection',
      ratio: '1:1',
      orientation: 'landscape',
      format: 'webp',
      jpgQuality: 90,
      webpQuality: 85
    },
    {
      id: 'full_documentation',
      name: 'Página Completa (PNG)',
      mode: 'full_page',
      ratio: 'free',
      orientation: 'landscape',
      format: 'png',
      jpgQuality: 90,
      webpQuality: 90
    }
  ]
};

export const MESSAGE_TYPES = {
  START_CAPTURE: 'START_CAPTURE',
  CAPTURE_VISIBLE_TAB: 'CAPTURE_VISIBLE_TAB',
  INIT_SELECTION_OVERLAY: 'INIT_SELECTION_OVERLAY',
  SELECTION_CONFIRMED: 'SELECTION_CONFIRMED',
  SELECTION_CANCELLED: 'SELECTION_CANCELLED',
  FULL_PAGE_PROGRESS: 'FULL_PAGE_PROGRESS',
  FULL_PAGE_COMPLETE: 'FULL_PAGE_COMPLETE',
  OPEN_EDITOR: 'OPEN_EDITOR',
  GET_CAPTURED_IMAGE: 'GET_CAPTURED_IMAGE',
  CLEAR_CAPTURED_IMAGE: 'CLEAR_CAPTURED_IMAGE',
  EXECUTE_COMMAND: 'EXECUTE_COMMAND',
  DOWNLOAD_IMAGE: 'DOWNLOAD_IMAGE'
};
