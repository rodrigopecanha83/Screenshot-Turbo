import { SAVE_PICKER_ID } from '../shared/constants.js';
import { getQuickSaveData, clearQuickSaveData } from '../shared/storage.js';

let DadosCaptura = null;
let EstaSalvando = false;

const ImagemPrevia = document.getElementById('Imagem-Previa');
const CampoNomeArquivo = document.getElementById('Campo-Nome-Arquivo');
const DominioOrigem = document.getElementById('Dominio-Origem');
const BotaoSalvar = document.getElementById('Botao-Salvar');
const BotaoCancelar = document.getElementById('Botao-Cancelar');
const MensagemStatus = document.getElementById('Mensagem-Status');

function MostrarFeedback(mensagem, tipo = 'Info') {
  MensagemStatus.textContent = mensagem;
  MensagemStatus.className = `Mensagem-Status ${tipo}`;
  MensagemStatus.style.display = 'block';
}

async function InicializarJanela() {
  try {
    DadosCaptura = await getQuickSaveData();

    if (!DadosCaptura || !DadosCaptura.imageDataUrl) {
      MostrarFeedback('Nenhuma imagem pendente para salvar.', 'Erro');
      setTimeout(() => window.close(), 1800);
      return;
    }

    ImagemPrevia.src = DadosCaptura.imageDataUrl;
    CampoNomeArquivo.value = DadosCaptura.filename || 'captura.png';

    if (DadosCaptura.domain) {
      DominioOrigem.textContent = DadosCaptura.domain;
    }

    // Foco automático no botão de Salvar para permitir confirmar com Enter imediatamente
    BotaoSalvar.focus();
  } catch (erro) {
    MostrarFeedback(`Erro ao carregar captura: ${erro.message}`, 'Erro');
  }
}

async function ExecutarSalvar() {
  if (EstaSalvando || !DadosCaptura) return;
  EstaSalvando = true;

  const nomeArquivo = CampoNomeArquivo.value.trim() || DadosCaptura.filename || 'captura.png';
  const formatoBruto = (DadosCaptura.format || 'png').toLowerCase();
  const extensao = formatoBruto === 'jpeg' ? 'jpg' : formatoBruto;
  const mimeType = extensao === 'jpg' ? 'image/jpeg' : `image/${extensao}`;

  // 1. Tenta Seletor Nativo com memória de pasta compartilhada com o Editor
  if (typeof window.showSaveFilePicker === 'function') {
    let manipuladorArquivo = null;
    try {
      manipuladorArquivo = await window.showSaveFilePicker({
        id: SAVE_PICKER_ID,
        suggestedName: nomeArquivo,
        types: [{
          description: `Imagem ${extensao.toUpperCase()}`,
          accept: { [mimeType]: [`.${extensao}`] }
        }]
      });
    } catch (erro) {
      EstaSalvando = false;
      if (erro && erro.name === 'AbortError') {
        // Usuário cancelou a janela de salvar nativa do sistema
        return;
      }
      console.warn('showSaveFilePicker falhou no salvamento rápido, usando fallback:', erro);
    }

    if (manipuladorArquivo) {
      try {
        MostrarFeedback('Salvando imagem...', 'Info');
        const resposta = await fetch(DadosCaptura.imageDataUrl);
        const blobImagem = await resposta.blob();

        const escritor = await manipuladorArquivo.createWritable();
        await escritor.write(blobImagem);
        await escritor.close();

        await clearQuickSaveData();
        MostrarFeedback('Imagem salva com sucesso!', 'Sucesso');
        setTimeout(() => window.close(), 250);
      } catch (erroGravacao) {
        EstaSalvando = false;
        MostrarFeedback(`Erro ao gravar arquivo: ${erroGravacao.message}`, 'Erro');
      }
      return;
    }
  }

  // 2. Fallback caso showSaveFilePicker não esteja disponível
  try {
    MostrarFeedback('Iniciando download...', 'Info');
    chrome.downloads.download({
      url: DadosCaptura.imageDataUrl,
      filename: nomeArquivo,
      saveAs: true
    }, async () => {
      await clearQuickSaveData();
      window.close();
    });
  } catch (erroDownload) {
    EstaSalvando = false;
    MostrarFeedback(`Erro no download: ${erroDownload.message}`, 'Erro');
  }
}

// Eventos de Interface
BotaoSalvar.addEventListener('click', ExecutarSalvar);

BotaoCancelar.addEventListener('click', () => {
  window.close();
});

CampoNomeArquivo.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    ExecutarSalvar();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.close();
  } else if (e.key === 'Enter' && document.activeElement !== BotaoCancelar && document.activeElement !== CampoNomeArquivo) {
    e.preventDefault();
    ExecutarSalvar();
  }
});

// Inicialização após carregamento do DOM
document.addEventListener('DOMContentLoaded', InicializarJanela);
