# ScreenShot Turbo

Extensão profissional e rápida de captura, recorte, edição e exportação de tela para Google Chrome e Microsoft Edge (Manifest V3). Permite capturar janelas visíveis, páginas inteiras com rolagem contínua ou seleções personalizadas com anotações e exportação local de alta fidelidade.

## Funcionalidades Principais

* **Modos de Captura Flexíveis:** Captura rápida de janela visível, varredura inteligente de página inteira sem repetição de cabeçalhos e seleção livre interativa sobre a página com 8 alças de redimensionamento.
* **Proporções Predefinidas com Orientação Automática:** Enquadramentos fixos matemáticos (1:1, 3:2, 4:3, 5:4 e 16:9) com alternância entre os modos horizontal (paisagem) e vertical (retrato).
* **Editor de Pré-visualização com Ferramentas de Desenho:** Abertura automática após cada captura com suporte a anotações em tela (texto, retângulos, círculos, setas, linhas retas, polilinhas contínuas e pincel livre via Fabric.js).
* **Exportação Multiformato e Ajuste Fino:** Salvamento em PNG (com transparência), JPG (com controle de qualidade de 10% a 100% e cor de fundo personalizada) e WebP ultra-compacto.
* **Memória de Pasta Compartilhada:** Janela integrada do navegador que memoriza o último diretório de salvamento utilizado entre as sessões.
* **Internacionalização Completa (i18n):** Suporte nativo a 4 idiomas (Inglês como padrão global, Português do Brasil, Espanhol e Francês).

## Pré-requisitos

* Navegador baseado em Chromium (Google Chrome, Microsoft Edge, Brave, Opera) com suporte a Manifest V3.

## Instalação e Configuração

1. Clone ou baixe este repositório em seu computador.
2. Abra o navegador e acesse a página de extensões:
   * No Chrome: `chrome://extensions/`
   * No Edge: `edge://extensions/`
3. Ative o **Modo do desenvolvedor** no canto da interface.
4. Clique em **Carregar sem compactação** (ou *Load unpacked*).
5. Selecione a pasta raiz deste projeto (`ScreenShot-Turbo`).

## Como Usar

A extensão pode ser operada pelo menu de ação rápida na barra de ferramentas ou diretamente por atalhos globais de teclado:

```text
Alt + Shift + V    -> Capturar Janela Visível
Alt + Shift + F    -> Capturar Página Inteira (com rolagem automática)
Alt + Shift + S    -> Iniciar Seleção Livre na página
Alt + Shift + 1    -> Seleção na proporção 1:1 (Quadrado)
Alt + Shift + 2    -> Seleção na proporção 3:2 (Fotografia)
Alt + Shift + 3    -> Seleção na proporção 4:3 (Monitor padrão)
Alt + Shift + 4    -> Seleção na proporção 5:4 (Quadro)
Esc                -> Cancelar seleção ou fechar interface de recorte
```

Após capturar, use o **Editor de Pré-visualização** para desenhar anotações, recortar e clicar em **Copiar** (Ctrl+V em qualquer aplicativo) ou **Salvar Imagem**.

## Capturas de Tela

Imagens e materiais visuais demonstrativos do produto estão disponíveis na pasta [`arte_original/`](file:///c:/Projetos/Extensoes-Chrome/ScreenShot-Turbo/arte_original).

## Histórico de Versões

### v1.2.1 - 2026-10-29
- Correção de bugs: a janela de Salvamento Rápido (Quick-Save) não abria na versão publicada (ERR_FILE_NOT_FOUND) porque a pasta não era incluída no pacote.

### v1.2.0 - 2026-10-28
- Implementação de internacionalização nativa (i18n) completa em 4 idiomas: Inglês (`en` como idioma padrão global), Português do Brasil (`pt_BR`), Espanhol (`es`) e Francês (`fr`).
- Adaptação dinâmica de todas as interfaces (Popup, Editor, Configurações, Overlay interativo e Salvamento Rápido).
- Limpeza e organização estrutural do projeto para empacotamento da Web Store.

### v1.1.0 - 2026-10-21
- Menu unificado para modo de captura padrão e seleção por proporção nas configurações.
- Suporte à proporção widescreen **16:9** em todas as interfaces.
- Padronização de nomes de arquivos com prefixo e domínio opcionais.
- Memória de última pasta de salvamento via File System Access API.

### v1.0.0
- Lançamento inicial da extensão.

## Contribuindo

Sugestões e correções são bem-vindas. Abra uma Issue ou envie um Pull Request.

## Licença

Este projeto é distribuído sob os termos da licença **GNU General Public License v3.0 (GNU GPLv3)**. Consulte o arquivo [LICENSE](LICENSE) para obter o texto completo da licença.

## Autor

Rodrigo Peçanha
