import { getSettings, saveSettings } from '../shared/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  const currentSettings = await getSettings();

  // Elementos do Formulário
  const defaultMode = document.getElementById('default-mode');
  const defaultRatio = document.getElementById('default-ratio');
  const defaultOrient = document.getElementById('default-orient');
  const defaultFormat = document.getElementById('default-format');
  const jpgQuality = document.getElementById('jpg-quality');
  const jpgQualityVal = document.getElementById('jpg-quality-val');
  const webpQuality = document.getElementById('webp-quality');
  const webpQualityVal = document.getElementById('webp-quality-val');
  const jpgBgColor = document.getElementById('jpg-bg-color');
  const jpgBgHex = document.getElementById('jpg-bg-hex');
  const filenamePattern = document.getElementById('filename-pattern');
  const includeDomain = document.getElementById('include-domain');
  const btnSave = document.getElementById('btn-save-settings');
  const toast = document.getElementById('save-toast');

  // Popula com dados atuais
  defaultMode.value = currentSettings.defaultMode || 'visible';
  defaultRatio.value = currentSettings.defaultRatio || 'free';
  defaultOrient.value = currentSettings.defaultOrientation || 'landscape';
  defaultFormat.value = currentSettings.defaultFormat || 'png';
  
  jpgQuality.value = currentSettings.jpgQuality || 90;
  jpgQualityVal.textContent = `${jpgQuality.value}%`;

  webpQuality.value = currentSettings.webpQuality || 90;
  webpQualityVal.textContent = `${webpQuality.value}%`;

  jpgBgColor.value = currentSettings.jpgBgColor || '#ffffff';
  jpgBgHex.textContent = jpgBgColor.value;

  filenamePattern.value = currentSettings.filenamePattern || 'captura_{date}_{time}';
  includeDomain.checked = currentSettings.includeDomain !== false;

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
    const updated = {
      ...currentSettings,
      defaultMode: defaultMode.value,
      defaultRatio: defaultRatio.value,
      defaultOrientation: defaultOrient.value,
      defaultFormat: defaultFormat.value,
      jpgQuality: parseInt(jpgQuality.value, 10),
      webpQuality: parseInt(webpQuality.value, 10),
      jpgBgColor: jpgBgColor.value,
      filenamePattern: filenamePattern.value.trim() || 'captura_{date}_{time}',
      includeDomain: includeDomain.checked
    };

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
