/**
 * Módulo de Internacionalização (i18n) para ScreenShot Turbo
 * Suporta substituição declarativa via atributos data-i18n e chamadas diretas.
 */

/**
 * Obtém mensagem traduzida pelo chrome.i18n
 * @param {string} key - Chave da mensagem
 * @param {string|Array<string>} [substitutions] - Valores para placeholders
 * @returns {string} Mensagem traduzida ou chave caso não encontre
 */
export function getI18nMessage(key, substitutions = []) {
  if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
    const msg = chrome.i18n.getMessage(key, substitutions);
    if (msg) return msg;
  }
  return key;
}

/**
 * Varre o documento ou container aplicando traduções declarativas:
 * - data-i18n="chave" -> textContent
 * - data-i18n-html="chave" -> innerHTML
 * - data-i18n-title="chave" -> title
 * - data-i18n-placeholder="chave" -> placeholder
 */
export function applyI18n(container = document) {
  // textContent
  container.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = getI18nMessage(key);
    }
  });

  // innerHTML
  container.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    if (key) {
      el.innerHTML = getI18nMessage(key);
    }
  });

  // title
  container.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.setAttribute('title', getI18nMessage(key));
    }
  });

  // placeholder
  container.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.setAttribute('placeholder', getI18nMessage(key));
    }
  });
}
