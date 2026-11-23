/* RIFA ONLINE — front-end (GitHub Pages) */
'use strict';

/* ========= CONFIGURAÇÃO ========= */
const CONFIG = {
  // URL do Web App do Google Apps Script (termina em /exec)
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzUtJa-_Maj2TkTY8ein5hdz_Va35ViwNYKTECA4FXmaSu4DVaV5FSGMNi6bSbY3Wim/exec',
  ATUALIZAR_RIFA_MS: 15000,   // atualização da grade enquanto a rifa está aberta
  ATUALIZAR_HOME_MS: 30000,   // atualização dos cartões na página inicial
  TIMEOUT_MS: 25000,
  // Opcional: WhatsApp do organizador com DDI+DDD (ex.: '5511912345678'). Vazio = botão oculto.
  WHATSAPP_ORGANIZADOR: ''
};

/* ========= ESTADO ========= */
const estado = { rifas: [], atual: null, selecionado: null, enviando: false, timer: null };

/* ========= UTILITÁRIOS ========= */
const $ = (id) => document.getElementById(id);
const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function el(tag, props = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  filhos.flat().forEach((f) => f != null && n.append(f));
  return n;
}

function svgTrofeu() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '24'); s.setAttribute('height', '24');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<path d="M7 3h10v4a5 5 0 0 1-10 0zM5 4H2v2a4 4 0 0 0 4 4M19 4h3v2a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  return s;
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
}

/* ========= COMUNICAÇÃO COM O APPS SCRIPT ========= */
async function chamar(url, opcoes) {
  const ctrl = new AbortController();
  const tempo = setTimeout(() => ctrl.abort(), CONFIG.TIMEOUT_MS);
  try {
    const resp = await fetch(url, { ...opcoes, signal: ctrl.signal, redirect: 'follow' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const texto = await resp.text();
    try { return JSON.parse(texto); }
    catch { throw new Error('Resposta inválida do servidor (verifique se a implantação do Apps Script está como "Qualquer pessoa").'); }
  } catch (e) {
    const err = new Error(e.name === 'AbortError' ? 'O servidor demorou para responder.' : (e.message || 'Falha de conexão.'));
    err.rede = true;
    throw err;
  } finally {
    clearTimeout(tempo);
  }
}

function apiGet(params) {
  const q = new URLSearchParams({ ...params, _: Date.now() });
  return chamar(CONFIG.APPS_SCRIPT_URL + '?' + q.toString(), { method: 'GET' });
}

// text/plain evita o preflight CORS (o Apps Script não responde a OPTIONS)
function apiPost(corpo) {
  return chamar(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(corpo)
  });
}

/* ========= ROTAS (hash) ========= */
function rotaAtual() {
  const m = location.hash.match(/^#\/rifa\/([A-Za-z0-9]+)$/);
  return m ? m[1].toUpperCase() : null;
}

function rotear() {
  pararAtualizacao();
  const id = rotaAtual();
  if (id) abrirRifa(id); else mostrarHome();
}

/* ========= HOME ========= */
async function mostrarHome() {
  estado.atual = null; estado.selecionado = null;
  $('view-rifa').hidden = true;
  $('view-home').hidden = false;
  document.title = 'Rifa Online — escolha sua rifa e garanta seu número';
  await carregarHome(true);
  estado.timer = setInterval(() => carregarHome(false), CONFIG.ATUALIZAR_HOME_MS);
}

async function carregarHome(primeira) {
  const status = $('home-status'), cards = $('cards');
  if (primeira && !estado.rifas.length) {
    cards.replaceChildren(...[1, 2, 3, 4].map(() => el('div', { class: 'skel' })));
    status.hidden = true;
  }
  try {
    const r = await apiGet({ action: 'rifas' });
    if (!r.ok) throw new Error(r.mensagem || 'Não foi possível carregar as rifas.');
    estado.rifas = r.rifas || [];
    status.hidden = true;
    if (!estado.rifas.length) {
      cards.replaceChildren();
      mostrarStatus(status, 'Nenhuma rifa ativa no momento. Volte em breve!');
      return;
    }
    renderCards();
  } catch (e) {
    if (primeira || !estado.rifas.length) {
      cards.replaceChildren();
      mostrarStatus(status, 'Não foi possível carregar as rifas. ' + e.message, () => carregarHome(true));
    }
  }
}

function mostrarStatus(box, msg, retentar) {
  box.replaceChildren(el('p', { text: msg }));
  if (retentar) box.append(el('button', { type: 'button', text: 'Tentar de novo', onclick: retentar }));
  box.hidden = false;
}

function renderCards() {
  const nos = estado.rifas.map((r) => {
    const esgotada = r.disponiveis <= 0;
    const foto = el('div', { class: 'card-foto' });
    montarImagem(foto, r.foto, r.nome);
    const pct = r.total ? Math.round(((r.total - r.disponiveis) / r.total) * 100) : 0;
    return el('article', { class: 'card' },
      el('div', { class: 'card-top' }, svgTrofeu(), el('span', { text: r.nome })),
      foto,
      el('div', { class: 'card-body' },
        r.descricao ? el('p', { class: 'card-desc', text: r.descricao }) : null,
        el('div', { class: 'chips' },
          el('span', {}, el('b', { text: brl(r.valor) }), ' por número'),
          el('span', {}, el('b', { text: String(r.total) }), ' números')),
        el('div', { class: 'barra', 'aria-hidden': 'true' }, el('i', { style: `width:${pct}%` })),
        el('div', { class: 'disp' + (esgotada ? ' zero' : '') },
          esgotada ? null : el('span', { class: 'ok', 'aria-hidden': 'true' }, '✓'),
          el('span', { text: esgotada ? 'Esgotada' : `${r.disponiveis} disponíveis` })),
        el('button', {
          type: 'button', class: 'btn-main', ...(esgotada ? { disabled: '' } : {}),
          onclick: () => { location.hash = '#/rifa/' + r.id; }
        }, esgotada ? 'Esgotada' : '▶ Participar')
      ));
  });
  $('cards').replaceChildren(...nos);
}

function montarImagem(container, url, alt) {
  container.replaceChildren();
  if (!url) { container.append(el('span', { class: 'sem-foto', text: '🎁', 'aria-hidden': 'true' })); return; }
  const img = el('img', { src: url, alt: alt || '', loading: 'lazy', referrerpolicy: 'no-referrer' });
  img.addEventListener('error', () => container.replaceChildren(el('span', { class: 'sem-foto', text: '🎁', 'aria-hidden': 'true' })));
  container.append(img);
}

/* ========= PÁGINA DA RIFA ========= */
async function abrirRifa(id) {
  $('view-home').hidden = true;
  $('view-rifa').hidden = false;
  $('rifa-layout').hidden = true;
  estado.selecionado = null;
  atualizarFormulario();
  const status = $('rifa-status');
  mostrarStatus(status, 'Carregando rifa…');
  window.scrollTo({ top: 0 });
  try {
    const r = await apiGet({ action: 'rifa', id });
    if (!r.ok) throw new Error(r.mensagem || 'Rifa não encontrada.');
    estado.atual = r.rifa;
    status.hidden = true;
    $('rifa-layout').hidden = false;
    renderRifa();
    estado.timer = setInterval(atualizarRifa, CONFIG.ATUALIZAR_RIFA_MS);
  } catch (e) {
    mostrarStatus(status, e.message, () => abrirRifa(id));
  }
}

function renderRifa() {
  const r = estado.atual;
  document.title = r.nome + ' — Rifa Online';
  $('r-nome').textContent = r.nome;
  $('r-desc').textContent = r.descricao || '';
  $('r-desc').hidden = !r.descricao;
  $('r-valor').textContent = brl(r.valor);
  $('r-total').textContent = r.total;
  montarImagem(document.querySelector('.rifa-photo'), r.foto, r.nome);
  renderGrade();
}

function renderGrade() {
  const r = estado.atual;
  const ocupados = new Set(r.ocupados || []);
  const disp = Math.max(0, r.total - ocupados.size);
  $('r-disp').textContent = disp;

  const botoes = [];
  for (let n = 1; n <= r.total; n++) {
    const ocupado = ocupados.has(n);
    const sel = estado.selecionado === n;
    botoes.push(el('button', {
      type: 'button', class: 'num', 'aria-pressed': String(sel),
      'aria-label': `Número ${n}${ocupado ? ', indisponível' : sel ? ', selecionado' : ''}`,
      ...(ocupado ? { disabled: '' } : {}),
      onclick: () => selecionar(n)
    }, String(n)));
  }
  $('grid').replaceChildren(...botoes);
}

function selecionar(n) {
  if (estado.enviando) return;
  estado.selecionado = estado.selecionado === n ? null : n; // um número por vez
  renderGrade();
  atualizarFormulario();
  if (estado.selecionado && window.matchMedia('(max-width:899px)').matches) {
    setTimeout(() => $('f-nome').focus({ preventScroll: false }), 50);
  }
}

async function atualizarRifa() {
  if (!estado.atual || estado.enviando) return;
  try {
    const r = await apiGet({ action: 'rifa', id: estado.atual.id });
    if (!r.ok) return;
    aplicarAtualizacao(r.rifa);
  } catch { /* falha silenciosa: tenta novamente no próximo ciclo */ }
}

function aplicarAtualizacao(nova) {
  estado.atual = nova;
  if (estado.selecionado && (nova.ocupados || []).includes(estado.selecionado)) {
    toast(`O número ${estado.selecionado} acabou de ser escolhido por outra pessoa.`);
    estado.selecionado = null;
  }
  renderGrade();
  atualizarFormulario();
}

/* ========= FORMULÁRIO ========= */
function atualizarFormulario() {
  const r = estado.atual, n = estado.selecionado;
  $('form').hidden = !n;
  $('form-vazio').hidden = !!n;
  if (!n || !r) return;
  $('s-rifa').textContent = r.nome;
  $('s-num').textContent = n;
  $('s-valor').textContent = brl(r.valor);
  $('s-nome').textContent = $('f-nome').value.trim() || '—';
}

function mascaraTelefone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function validar() {
  const nome = $('f-nome').value.replace(/\s+/g, ' ').trim();
  const tel = $('f-tel').value.replace(/\D/g, '');
  const email = $('f-email').value.trim();
  const erros = { nome: '', tel: '', email: '' };
  if (nome.length < 3 || !nome.includes(' ') || !/^[A-Za-zÀ-ÿ'’.\- ]+$/.test(nome)) erros.nome = 'Informe nome e sobrenome (somente letras).';
  if (tel.length < 10 || tel.length > 11) erros.tel = 'Informe o telefone com DDD.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) erros.email = 'E-mail inválido.';
  for (const [k, id] of [['nome', 'f-nome'], ['tel', 'f-tel'], ['email', 'f-email']]) {
    $('e-' + k).textContent = erros[k];
    $(id).classList.toggle('invalid', !!erros[k]);
  }
  const ok = !erros.nome && !erros.tel && !erros.email;
  return { ok, nome, tel, email };
}

async function confirmar(ev) {
  ev.preventDefault();
  if (estado.enviando || !estado.atual || !estado.selecionado) return;
  const v = validar();
  if (!v.ok) { const p = document.querySelector('#form .invalid'); if (p) p.focus(); return; }

  const erroBox = $('form-erro'); erroBox.hidden = true;
  setEnviando(true);
  const numero = estado.selecionado;
  try {
    const r = await apiPost({
      action: 'reservar', id: estado.atual.id, numero,
      nome: v.nome, telefone: v.tel, email: v.email, website: $('f-site').value
    });
    if (r.ok) {
      // Só aqui a reserva é considerada confirmada (servidor gravou na planilha)
      estado.atual.ocupados = r.ocupados || [];
      estado.selecionado = null;
      renderGrade();
      atualizarFormulario();
      mostrarSucesso(r.participacao);
      $('form').reset();
    } else {
      if (Array.isArray(r.ocupados)) { estado.atual.ocupados = r.ocupados; }
      if (r.erro === 'NUMERO_INDISPONIVEL') estado.selecionado = null;
      renderGrade(); atualizarFormulario();
      erroBox.textContent = r.mensagem || 'Não foi possível confirmar sua participação.';
      erroBox.hidden = false;
      if (!estado.selecionado) $('form-vazio').hidden = false;
      erroBox.hidden = false;
      if (r.erro === 'NUMERO_INDISPONIVEL') toast(r.mensagem);
    }
  } catch (e) {
    erroBox.textContent = 'Falha de comunicação: ' + e.message + ' Sua participação NÃO foi confirmada. Verifique a conexão e tente novamente.';
    erroBox.hidden = false;
    atualizarRifa(); // reconsulta para refletir o estado real da planilha
  } finally {
    setEnviando(false);
  }
}

function setEnviando(sim) {
  estado.enviando = sim;
  const b = $('btn-confirmar');
  b.disabled = sim;
  b.querySelector('span').textContent = sim ? 'Confirmando…' : 'Confirmar participação';
  if (sim) b.prepend(el('i', { class: 'spin', id: 'spin' }));
  else { const s = $('spin'); if (s) s.remove(); }
}

/* ========= SUCESSO ========= */
function mostrarSucesso(p) {
  const linhas = [
    ['Rifa', p.rifa], ['Número', String(p.numero)], ['Valor', brl(p.valor)],
    ['Participante', p.nome], ['Status', 'Reservado'],
    ['Código', p.id.slice(0, 8).toUpperCase()]
  ];
  $('m-dados').replaceChildren(...linhas.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));
  $('m-aviso').textContent = `Sua reserva fica garantida por ${p.expiraMinutos} minutos. Combine o pagamento com o organizador; sem pagamento nesse prazo, o número volta a ficar disponível.`;
  const wa = $('m-wa');
  if (CONFIG.WHATSAPP_ORGANIZADOR) {
    const msg = `Olá! Reservei o número ${p.numero} da ${p.rifa} (${brl(p.valor)}). Nome: ${p.nome}. Código: ${p.id.slice(0, 8).toUpperCase()}.`;
    wa.href = `https://wa.me/${CONFIG.WHATSAPP_ORGANIZADOR}?text=${encodeURIComponent(msg)}`;
    wa.hidden = false;
  } else wa.hidden = true;
  $('modal').hidden = false;
  $('m-fechar').focus();
}

function fecharModal() {
  $('modal').hidden = true;
  location.hash = '';
}

/* ========= INICIALIZAÇÃO ========= */
function pararAtualizacao() { clearInterval(estado.timer); estado.timer = null; }

document.addEventListener('DOMContentLoaded', () => {
  $('btn-voltar').addEventListener('click', () => { location.hash = ''; });
  $('form').addEventListener('submit', confirmar);
  $('btn-limpar').addEventListener('click', () => { estado.selecionado = null; renderGrade(); atualizarFormulario(); });
  $('f-nome').addEventListener('input', () => { $('s-nome').textContent = $('f-nome').value.trim() || '—'; });
  $('f-tel').addEventListener('input', (e) => { e.target.value = mascaraTelefone(e.target.value); });
  $('m-fechar').addEventListener('click', fecharModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('modal').hidden) fecharModal(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && estado.atual) atualizarRifa(); });
  window.addEventListener('hashchange', rotear);
  rotear();
});
