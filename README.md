# Rifa Online

Site de rifas (HTML + CSS + JS) hospedado no GitHub Pages, com backend em Google Apps Script e dados no Google Planilhas.

## Arquivos
- `index.html`, `style.css`, `script.js` — site (vão para o GitHub)
- `Code.gs` — backend (cole no Apps Script, **não** precisa ir ao GitHub)

## 1. Planilha (exatamente 5 abas)
`RIFA 01`, `RIFA 02`, `RIFA 03`, `RIFA 04` e `CONFIGURAÇÃO`.

Colunas das 4 primeiras: `Número | Nome | Telefone | E-mail | Data da reserva | Status`.
Colunas de `CONFIGURAÇÃO`: `ID | Nome da rifa | Descrição | Link da foto | Valor por número | Quantidade | Ativa | Ordem`
(IDs: `RIFA01` a `RIFA04`; `Ativa` = `SIM` ou `NÃO`).

No Apps Script, execute `setupPlanilha` (preenche os números conforme a coluna Quantidade) e `instalarGatilho` (libera reservas vencidas).

## 2. Fotos no Google Drive
1. Envie a imagem ao Drive → botão direito → **Compartilhar** → *Qualquer pessoa com o link* (Leitor).
2. **Copiar link** e cole em `Link da foto` na aba CONFIGURAÇÃO. A conversão é automática.

## 3. Apps Script
1. Planilha → **Extensões → Apps Script**, cole `Code.gs`.
2. **Implantar → Nova implantação → App da Web**: *Executar como: Eu*; *Acesso: Qualquer pessoa*.
3. Copie a URL `/exec` e coloque em `CONFIG.APPS_SCRIPT_URL` no `script.js`.
4. **Ao alterar o Code.gs**, use *Implantar → Gerenciar implantações → Editar → Nova versão* (a URL continua a mesma).

Prazo da reserva: `RESERVA_EXPIRA_MINUTOS` no topo do `Code.gs`.

## 4. GitHub Pages
1. Crie um repositório e envie `index.html`, `style.css`, `script.js`, `README.md`.
2. **Settings → Pages → Branch: main / (root) → Save**.
3. O site abre em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

## 5. Status na planilha
`RESERVADO` (vale pelo prazo), `PAGO` (permanente), `CANCELADO` e `EXPIRADO` (número volta a ficar livre). Para confirmar um pagamento, mude o Status para `PAGO`.

## Segurança
- A URL do Apps Script é pública por natureza; nenhuma senha/token fica no GitHub.
- O site só recebe dados da rifa e a lista de números ocupados. Nome, telefone e e-mail nunca saem da planilha.
- A disponibilidade é conferida no servidor com `LockService`.

## Opcional
Preencha `WHATSAPP_ORGANIZADOR` no `script.js` (ex.: `5511912345678`) para exibir o botão de enviar comprovante.
