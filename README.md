# ScreenShot Turbo 🚀

> Extensão profissional e moderna de captura, recorte, edição e exportação de tela para **Google Chrome** e **Microsoft Edge** (Manifest V3).

---

## ✨ Principais Recursos

- 📸 **Modos de Captura Flexíveis**:
  - **Janela Visível**: Captura instantânea do viewport atual.
  - **Página Inteira**: Rolagem automática inteligente com costura sem emendas e ocultação de menus fixos repetidos.
  - **Seleção Livre**: Camada interativa diretamente sobre a página com redimensionamento pelas 8 alças, confirmação, cópia direta e salvamento rápido.
  - **Proporções Predefinidas**: Fixação matemática de proporções (1:1, 3:2, 4:3, 5:4, 16:9) com alternância entre paisagem e retrato.
- 🎨 **Editor de Pré-visualização Integrado**:
  - Abertura automática após cada captura.
  - **Ferramentas de Anotação e Desenho**: Formas geométricas (retângulos, círculos), texto, setas, linhas retas, polilinhas (linhas contínuas ponto a ponto) e pincel livre.
  - Modos de desenho contínuo sem necessidade de reativação da ferramenta.
  - Recorte não destrutivo em Canvas.
  - Controles de zoom (Zoom In, Zoom Out, Ajustar à Tela, 100%).
  - Cópia direta para a área de transferência (`Clipboard API`).
  - Restauração rápida da imagem original.
- 💾 **Exportação Profissional**:
  - **PNG**: Qualidade máxima sem perdas com suporte a transparência.
  - **JPG**: Ajuste fino de compressão (10% a 100%) e personalização de cor de fundo.
  - **WebP**: Formato moderno com excelente taxa de compressão e qualidade visual.
  - **Memória da última pasta**: A janela "Salvar como" do editor reabre na última pasta utilizada.
- ⚙️ **Configurações & Predefinições**:
  - Alternância entre modo manual e modo automático com predefinições.
  - Menu único de modo de captura padrão (incluindo as seleções por proporção).
  - Nome de arquivo padronizado `ScreenShot-Turbo-aaaa.mm.dd-hh.mm.ss-site.ext`, com prefixo e site opcionais e pré-visualização ao vivo.
  - Persistência contínua com `chrome.storage.local`.
- ⌨️ **Atalhos de Teclado Personalizáveis**:
  - `Alt + Shift + V`: Capturar janela visível.
  - `Alt + Shift + F`: Capturar página inteira.
  - `Alt + Shift + S`: Iniciar seleção livre.
  - `Alt + Shift + 1` a `4`: Iniciar seleções com proporções fixas (1:1, 3:2, 4:3, 5:4).
  - Seleção 16:9: atalho configurável em `chrome://extensions/shortcuts`.
  - `ESC`: Cancelar seleção ou fechar sobreposição.

---

## 📝 Histórico de Versões

### v1.1.0 - 2026-10-21
- Menu único para "Modo de Captura Padrão" e "Proporção Padrão" nas configurações.
- Nova proporção **16:9** (popup, editor, overlay, configurações e atalho).
- Novo padrão de nome: `ScreenShot-Turbo-aaaa.mm.dd-hh.mm.ss-site.ext`, com opções para remover o prefixo e o site.
- Salvamento direto do overlay passa a usar o mesmo padrão de nome do editor.
- Editor lembra a última pasta usada no "Salvar como" (File System Access API).
- Ícones renomeados para Train-Case e novos tamanhos (64, 256, 512).

### v1.0.0
- Lançamento inicial.

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
└── icons/                     # Ícones oficiais (Icon16, Icon32, Icon48, Icon64, Icon128, Icon256, Icon512)
```
