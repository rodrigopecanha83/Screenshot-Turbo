import { DEFAULT_SETTINGS } from './constants.js';

/**
 * Utilitário de persistência com chrome.storage.local
 */
export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get('settings', (result) => {
      if (chrome.runtime.lastError || !result.settings) {
        resolve({ ...DEFAULT_SETTINGS });
      } else {
        resolve({ ...DEFAULT_SETTINGS, ...result.settings });
      }
    });
  });
}

export async function saveSettings(newSettings) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ settings: newSettings }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(newSettings);
      }
    });
  });
}

/**
 * Armazenamento temporário robusto da captura recente para o editor
 */
export function setTemporaryCaptureData(data) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ currentCapture: data }, () => {
        resolve();
      });
    } catch (err) {
      console.warn('Erro ao salvar captura no storage local:', err);
      resolve();
    }
  });
}

export async function getTemporaryCaptureData() {
  // 1. Tenta buscar primeiro da memória do Service Worker com timeout estrito de 300ms
  try {
    const memResponse = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 300);
      try {
        chrome.runtime.sendMessage({ type: 'GET_CAPTURED_IMAGE' }, (res) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError || !res || !res.captureData) {
            resolve(null);
          } else {
            resolve(res.captureData);
          }
        });
      } catch (e) {
        clearTimeout(timer);
        resolve(null);
      }
    });
    if (memResponse) return memResponse;
  } catch (e) {}

  // 2. Fallback para chrome.storage.local
  return new Promise((resolve) => {
    chrome.storage.local.get('currentCapture', (result) => {
      resolve(result.currentCapture || null);
    });
  });
}

export function clearTemporaryCaptureData() {
  return new Promise((resolve) => {
    chrome.storage.local.remove('currentCapture', () => {
      resolve();
    });
  });
}

