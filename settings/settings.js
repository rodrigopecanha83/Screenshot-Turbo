import { getSettings, saveSettings } from '../shared/storage.js';
import { generateFilename } from '../shared/image-export.js';

document.addEventListener('DOMContentLoaded', async () => {
  const currentSettings = await getSettings();

  // Elementos do Formulário
  const defaultCapture = document.getElementById('Default-Capture');
  const defaultOrient = document.getElementById('default-orient');
  const defaultFormat = document.getElementById('default-format');
  const jpgQuality = document.getElementById('jpg-quality');
  const jpgQualityVal = document.getElementById('jpg-quality-val');
  const webpQuality = document.getElementById('webp-quality');
  const webpQualityVal = document.getElementById('webp-quality-val');
  const jpgBgColor = document.getElementById('jpg-bg-color');
  const jpgBgHex = document.getElementById('jpg-bg-hex');
  const includePrefix = document.getElementById('Include-Prefix');
  const includeDomain = document.getElementById('include-domain');
  const filenamePreview = document.getElementById('Filename-Preview');
  const btnSave = document.getElementById('btn-save-settings');
  const toast = document.getElementById('save-toast');

  // Popula com dados atuais
  // Menu unificado: "modo" ou "ratio_selection|proporção"
  const savedMode = currentSettings.defaultMode || 'visible';
  defaultCapture.value = savedMode === 'ratio_selection'
    ? `ratio_selection|${currentSettings.defaultRatio && currentSettings.defaultRatio !== 'free' ? currentSettings.defaultRatio : '1:1'}`
    : savedMode;
  if (!defaultCapture.value) defaultCapture.value = 'visible';
  defaultOrient.value = currentSettings.defaultOrientation || 'landscape';
  defaultFormat.value = currentSettings.defaultFormat || 'png';
  
  jpgQuality.value = currentSettings.jpgQuality || 90;
  jpgQualityVal.textContent = `${jpgQuality.value}%`;

  webpQuality.value = currentSettings.webpQuality || 90;
  webpQualityVal.textContent = `${webpQuality.value}%`;

  jpgBgColor.value = currentSettings.jpgBgColor || '#ffffff';
  jpgBgHex.textContent = jpgBgColor.value;

  includePrefix.checked = currentSettings.includePrefix !== false;
  includeDomain.checked = currentSettings.includeDomain !== false;

  function updatePreview() {
    filenamePreview.textContent = generateFilename({
      includePrefix: includePrefix.checked,
      includeDomain: includeDomain.checked,
      domain: 'exemplo.com.br',
      format: defaultFormat.value
    });
  }
  updatePreview();
  setInterval(updatePreview, 1000);
  [includePrefix, includeDomain, defaultFormat].forEach(el => el.addEventListener('change', updatePreview));

  // Listeners de UI
  jpgQuality.addEventListener('input', (e) => {
    jpgQualityVal.textContent = `${e.target.value}%`;
  });

  webpQuality.addEventListener('input', (e) => {
    webpQualityVal.textContent = `${e.target.value}%`;
  });

  jpgBgColor.addEventListener('input', (e) => {
    jpgBgHex.textContent = e.target.value;
  });

  // Salva no storage
  btnSave.addEventListener('click', async () => {
    const [mode, ratio] = defaultCapture.value.split('|');
    const updated = {
      ...currentSettings,
      defaultMode: mode,
      defaultRatio: ratio || 'free',
      defaultOrientation: defaultOrient.value,
      defaultFormat: defaultFormat.value,
      jpgQuality: parseInt(jpgQuality.value, 10),
      webpQuality: parseInt(webpQuality.value, 10),
      jpgBgColor: jpgBgColor.value,
      includePrefix: includePrefix.checked,
      includeDomain: includeDomain.checked
    };
    delete updated.filenamePattern; // Removido na v1.1

    await saveSettings(updated);
    showToast();
  });

  function showToast() {
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }
});
