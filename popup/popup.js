import { MESSAGE_TYPES } from '../shared/constants.js';
import { getSettings } from '../shared/storage.js';

const MODE_LABELS = {
  visible: 'Janela Visível',
  free_selection: 'Seleção Livre',
  ratio_selection: 'Seleção com Proporção',
  full_page: 'Página Inteira'
};

document.addEventListener('DOMContentLoaded', async () => {
  let settings = await getSettings();
  let currentOrientation = settings.defaultOrientation || 'landscape';
  const statusEl = document.getElementById('status-message');

  const userMode = settings.defaultMode || 'visible';
  const modeLabel = userMode === 'ratio_selection'
    ? `Seleção ${settings.defaultRatio || '1:1'}`
    : (MODE_LABELS[userMode] || userMode);
  document.getElementById('preset-desc').textContent = `Modo padrão: ${modeLabel}`;

  // Abertura das configurações
  document.getElementById('btn-open-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Predefinição do usuário (modo padrão das configurações)
  document.getElementById('btn-cap-preset').addEventListener('click', () => {
    triggerCapture(
      userMode,
      userMode === 'ratio_selection' ? (settings.defaultRatio || '1:1') : 'free',
      settings.defaultOrientation || currentOrientation
    );
  });

  // Ações de Captura
  document.getElementById('btn-cap-visible').addEventListener('click', () => {
    triggerCapture('visible');
  });

  document.getElementById('btn-cap-selection').addEventListener('click', () => {
    triggerCapture('free_selection');
  });

  document.getElementById('btn-cap-full').addEventListener('click', () => {
    triggerCapture('full_page');
  });

  // Botões de Proporção
  document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ratio = btn.dataset.ratio;
      triggerCapture('ratio_selection', ratio);
    });
  });

  async function triggerCapture(mode, ratio = 'free', orientation = currentOrientation) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.START_CAPTURE,
        mode: mode,
        ratio: ratio,
        orientation: orientation
      });

      if (response && response.error) {
        showError(response.error);
      } else {
        window.close(); // Fecha o popup para liberar a tela
      }
    } catch (err) {
      showError(err.message);
    }
  }

  function showError(msg) {
    statusEl.textContent = msg;
    statusEl.style.display = 'block';
  }
});
