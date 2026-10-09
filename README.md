# ScreenShot Turbo 🚀

> Extensão profissional e moderna de captura, recorte, edição e exportação de tela para **Google Chrome** e **Microsoft Edge** (Manifest V3).

---

## ✨ Principais Recursos

- 📸 **Modos de Captura Flexíveis**:
  - **Janela Visível**: Captura instantânea do viewport atual.
  - **Página Inteira**: Rolagem automática inteligente com costura sem emendas e ocultação de menus fixos repetidos.
  - **Seleção Livre**: Camada interativa diretamente sobre a página com redimensionamento pelas 8 alças.
  - **Proporções Predefinidas**: Fixação matemática de proporções (1:1, 3:2, 4:3, 5:4) com alternância entre paisagem e retrato.
- 🎨 **Editor de Pré-visualização Integrado**:
  - Abertura automática após cada captura.
  - Recorte não destrutivo em Canvas.
  - Controles de zoom (Zoom In, Zoom Out, Ajustar à Tela, 100%).
  - Cópia direta para a área de transferência (`Clipboard API`).
  - Restauração rápida da imagem original.
- 💾 **Exportação Profissional**:
  - **PNG**: Qualidade máxima sem perdas com suporte a transparência.
  - **JPG**: Ajuste fino de compressão (10% a 100%) e personalização de cor de fundo.
  - **WebP**: Formato moderno com excelente taxa de compressão e qualidade visual.
- ⚙️ **Configurações & Predefinições**:
  - Alternância entre modo manual e modo automático com predefinições.
  - Configuração customizável de nomes de arquivo com tags dinâmicas (`{date}`, `{time}`) e inclusão de domínio.
  - Persistência contínua com `chrome.storage.local`.
- ⌨️ **Atalhos de Teclado Personalizáveis**:
  - `Alt + Shift + V`: Capturar janela visível.
  - `Alt + Shift + F`: Capturar página inteira.
  - `Alt + Shift + S`: Iniciar seleção livre.
  - `Alt + Shift + 1` a `4`: Iniciar seleções com proporções fixas (1:1, 3:2, 4:3, 5:4).
  - `ESC`: Cancelar seleção ou fechar sobreposição.

---

## 🔒 Segurança e Privacidade

- **Processamento 100% Local**: Nenhuma imagem é transmitida para servidores externos.
- **Manifest V3**: Construído seguindo as diretrizes oficiais de segurança dos navegadores Chromium.
- **Permissões Mínimas**:
  - `activeTab` e `scripting`: Para injetar a área de seleção e capturar a aba ativa solicitada.
  - `storage`: Para manter as preferências e predefinições salvas localmente.
  - `downloads`: Para salvar os arquivos no diretório de downloads do usuário.

---

## 📦 Como Instalar (Modo Desenvolvedor)

### No Google Chrome:
1. Abra o navegador e acesse `chrome://extensions/`.
2. Ative o botão **Modo do desenvolvedor** no canto superior direito.
3. Clique em **Carregar sem compactação** (ou *Load unpacked*).
4. Selecione a pasta deste projeto (`c:\Projetos\Extensoes-Chrome\ScreenShot-Turbo`).

### No Microsoft Edge:
1. Acesse `edge://extensions/`.
2. Ative o alternador **Modo do desenvolvedor** no painel lateral esquerdo.
3. Clique em **Carregar descompactada** (*Load unpacked*).
4. Selecione a pasta deste projeto.

---

## 📁 Estrutura do Código

```text
ScreenShot-Turbo/
├── manifest.json              # Configuração Manifest V3
├── background/
│   └── service-worker.js      # Gerenciamento de eventos, atalhos e downloads
├── popup/
│   ├── popup.html             # Interface pop-up da extensão
│   ├── popup.css              # Estilos com design system moderno e escuro
│   └── popup.js               # Disparadores de captura e predefinições
├── content/
│   ├── capture-overlay.js     # Script de seleção interativo na página
│   └── capture-overlay.css    # Máscaras e alças de redimensionamento
├── capture/
│   └── full-page-scanner.js   # Script de varredura e cálculo de página inteira
├── editor/
│   ├── editor.html            # Interface completa do editor de pré-visualização
│   ├── editor.css             # Estilos do workspace Canvas e paleta de ferramentas
│   └── editor.js              # Lógica de recorte não-destrutivo, zoom e costura
├── settings/
│   ├── settings.html          # Painel de preferências e atalhos
│   ├── settings.css           # Estilos da página de configurações
│   └── settings.js            # Persistência e binding com chrome.storage
├── shared/
│   ├── constants.js           # Constantes e valores padrão
│   ├── storage.js             # Helpers do chrome.storage
│   └── image-export.js        # Utilitários de Canvas, conversão e nomes
└── icons/                     # Ícones em resoluções 16x16, 32x32, 48x48, 128x128
```
