/* Veloz Acompanha: SPA sem dependências. Estado salvo em localStorage. */
(function () {
  'use strict';

  var D = window.VELOZ_DATA;
  var DEV = window.VELOZ_DEV;
  var STORE_KEY = 'veloz:data:v2';
  var PREF_KEY = 'veloz:mecanico';
  var THEME_KEY = 'veloz:tema';
  var ALERTA_APROVACAO_MIN = 60;
  var app = document.getElementById('app');
  var state = load();
  var filtro = { q: '', etapa: 'todas' };
  var notaSel = {};

  /* ---------- Estado ---------- */

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* sem storage: usa dados de exemplo em memória */ }
    var fresh = D.seed();
    persist(fresh);
    return fresh;
  }

  function persist(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* ignora */ }
  }

  function save() { persist(state); }

  function getPref(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function setPref(key, v) { try { localStorage.setItem(key, v); } catch (e) { /* ignora */ } }

  function findOrder(q) {
    if (!q) return null;
    var k = String(q).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return state.orders.filter(function (o) {
      return o.id.replace('-', '') === k || o.placa === k;
    })[0] || null;
  }

  function log(o, msg) { o.timeline.push({ t: Date.now(), msg: msg }); }

  function setStep(o, step, msg) {
    o.step = step;
    o.stepSince = Date.now();
    if (step >= 5 && o.elevador) o.elevador = null;
    log(o, msg || ('Etapa: ' + D.STEPS[step].label));
  }

  function pendentes(o) { return o.itens.filter(function (i) { return i.status === 'pendente'; }); }

  function total(o, status) {
    return o.itens.reduce(function (s, i) { return s + ((!status || i.status === status) ? i.valor : 0); }, 0);
  }

  /* ---------- Utilitários ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function brl(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  function dur(ms) {
    var m = Math.max(0, Math.round(ms / 60000));
    if (m < 1) return 'agora';
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '');
  }

  function ago(t) { var d = dur(Date.now() - t); return d === 'agora' ? 'agora' : 'há ' + d; }

  function hora(t) { return new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }

  function dataHora(t) {
    return new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function placaFmt(p) { return p.slice(0, 3) + '-' + p.slice(3); }

  function clientLink(o) {
    return location.href.split('#')[0] + '#/cliente/' + o.id;
  }

  function whatsLink(o) {
    var txt = 'Olá, ' + o.cliente.split(' ')[0] + '! Aqui é a Auto Center Veloz. ' +
      'Acompanhe o seu ' + o.modelo + ' (' + placaFmt(o.placa) + ') e aprove o orçamento por este link: ' + clientLink(o);
    return 'https://wa.me/55' + o.telefone + '?text=' + encodeURIComponent(txt);
  }

  function oficinaWhats(o) {
    var txt = 'Olá! Tenho uma dúvida sobre a ' + o.id + ' (' + placaFmt(o.placa) + ').';
    return 'https://wa.me/' + D.OFICINA.whatsapp + '?text=' + encodeURIComponent(txt);
  }

  var toastTimer;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }

  function badge(o) {
    var s = D.STEPS[o.step];
    return '<span class="badge badge-' + s.key + '">' + esc(s.label) + '</span>';
  }

  function waitingAlert(o) {
    return o.step === 2 && (Date.now() - o.stepSince) / 60000 > ALERTA_APROVACAO_MIN;
  }

  function stars(n) { return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }

  function resizeImage(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 640, w = img.width, h = img.height, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.72));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /* ---------- Notificações ---------- */

  function canNotify() { return 'Notification' in window; }

  function notifyButton() {
    if (!canNotify() || Notification.permission !== 'default') return '';
    return '<button class="btn btn-ghost btn-sm" data-act="notificar">🔔 Avisar quando mudar</button>';
  }

  /* Compara o estado anterior com o novo (vindo de outra aba) e descreve o que mudou. */
  function diffs(oldS, newS) {
    var msgs = [];
    newS.orders.forEach(function (n) {
      var o = oldS.orders.filter(function (x) { return x.id === n.id; })[0];
      if (!o) { msgs.push(n.id + ': nova OS cadastrada (' + placaFmt(n.placa) + ')'); return; }
      var pendO = o.itens.filter(function (i) { return i.status === 'pendente'; }).length;
      var pendN = n.itens.filter(function (i) { return i.status === 'pendente'; }).length;
      if (pendN > pendO) msgs.push(n.id + ': novo item aguardando aprovação');
      else if (pendN < pendO) msgs.push(n.id + ': cliente respondeu o orçamento');
      if (n.step !== o.step) msgs.push(n.id + ': ' + D.STEPS[n.step].label);
      if (n.avaliacao && !o.avaliacao) msgs.push(n.id + ': nova avaliação ' + stars(n.avaliacao.nota));
    });
    return msgs;
  }

  function notify(msgs) {
    if (!msgs.length) return;
    toast(msgs[0] + (msgs.length > 1 ? ' (+' + (msgs.length - 1) + ')' : ''));
    if (canNotify() && Notification.permission === 'granted' && document.hidden) {
      try { new Notification('Auto Center Veloz', { body: msgs.join('\n'), icon: 'assets/icon-192.png' }); } catch (e) { /* ignora */ }
    }
  }

  /* ---------- Componentes ---------- */

  function stepper(o) {
    var visiveis = D.STEPS.slice(0, 6);
    return '<ol class="stepper" aria-label="Etapas do serviço">' + visiveis.map(function (s, i) {
      var cls = i < o.step ? 'done' : i === o.step ? 'current' : '';
      return '<li class="' + cls + '"' + (i === o.step ? ' aria-current="step"' : '') + '>' +
        '<span class="dot">' + (i < o.step ? '✓' : i + 1) + '</span>' +
        '<span class="label">' + esc(s.label) + '</span></li>';
    }).join('') + '</ol>';
  }

  function timeline(o) {
    return '<ul class="timeline">' + o.timeline.slice().reverse().map(function (e) {
      return '<li><time>' + hora(e.t) + '</time><span>' + esc(e.msg) + '</span></li>';
    }).join('') + '</ul>';
  }

  function itemCard(o, it, mode) {
    var st = { pendente: 'Aguardando sua decisão', aprovado: 'Aprovado', recusado: 'Recusado' }[it.status];
    if (mode !== 'cliente' && it.status === 'pendente') st = 'Aguardando cliente';
    var actions = '';
    if (mode === 'cliente' && it.status === 'pendente') {
      actions = '<div class="item-actions">' +
        '<button class="btn btn-ghost" data-act="recusar" data-os="' + o.id + '" data-item="' + it.id + '">Recusar</button>' +
        '<button class="btn btn-primary" data-act="aprovar" data-os="' + o.id + '" data-item="' + it.id + '">Aprovar</button></div>';
    }
    return '<article class="item item-' + it.status + '">' +
      (it.foto ? '<img class="item-photo" src="' + esc(it.foto) + '" alt="Foto da peça: ' + esc(it.desc) + '" loading="lazy">' : '') +
      '<div class="item-body">' +
        '<div class="item-head"><h4>' + esc(it.desc) + '</h4><strong>' + (it.valor ? brl(it.valor) : 'Sem custo') + '</strong></div>' +
        (it.obs ? '<p class="muted">' + esc(it.obs) + '</p>' : '') +
        '<span class="pill pill-' + it.status + '">' + st + '</span>' +
        actions +
      '</div></article>';
  }

  function ratingBlock(o) {
    if (o.step < 5) return '';
    if (o.avaliacao) {
      var boa = o.avaliacao.nota >= 4;
      return '<div class="card rating"><div class="rating-done">' +
        '<h3>Obrigado pela avaliação!</h3>' +
        '<span class="stars-static" aria-label="' + o.avaliacao.nota + ' de 5 estrelas">' + stars(o.avaliacao.nota) + '</span>' +
        (o.avaliacao.comentario ? '<p class="muted">“' + esc(o.avaliacao.comentario) + '”</p>' : '') +
        (boa ? '<a class="btn btn-primary" target="_blank" rel="noopener" href="' + D.OFICINA.google + '">Compartilhar no Google</a>'
             : '<p class="small">Sentimos muito. O Eduardo, gerente da oficina, vai entrar em contato para resolver.</p>') +
        '</div></div>';
    }
    var sel = notaSel[o.id] || 0;
    var btns = '';
    for (var i = 1; i <= 5; i++) {
      btns += '<button type="button" class="star' + (i <= sel ? ' on' : '') + '" data-act="nota" data-os="' + o.id + '" data-n="' + i + '" aria-label="' + i + ' estrela(s)" aria-pressed="' + (i <= sel) + '">★</button>';
    }
    return '<form class="card rating form" data-form="avaliar" data-os="' + o.id + '">' +
      '<h3>Como foi o atendimento?</h3><p class="muted small">Sua opinião leva 10 segundos e ajuda a oficina a melhorar.</p>' +
      '<div class="stars" role="group" aria-label="Nota de 1 a 5">' + btns + '</div>' +
      '<textarea name="comentario" rows="2" placeholder="Quer deixar um comentário? (opcional)"></textarea>' +
      '<button class="btn btn-primary" type="submit"' + (sel ? '' : ' disabled') + '>Enviar avaliação</button>' +
      '</form>';
  }

  /* ---------- Telas ---------- */

  function viewHome() {
    var aguardando = state.orders.filter(function (o) { return o.step === 2; }).length;
    return '<section class="hero">' +
      '<p class="eyebrow">Oficina conectada</p>' +
      '<h1>O cliente acompanha o carro e aprova o orçamento pelo celular.</h1>' +
      '<p class="lead">Menos ligações na recepção, mecânicos focados no elevador e carros que saem do pátio mais cedo.</p>' +
      '<div class="hero-actions"><a class="btn btn-primary" href="#/cliente/OS-1042">Ver demo do cliente</a>' +
      '<a class="btn btn-ghost" href="#/recepcao">Abrir painel da recepção</a></div>' +
      '</section>' +
      '<section class="grid-3">' +
        roleCard('cliente', 'Sou cliente', 'Status em tempo real, fotos das peças com defeito, aprovação item a item e relatório digital.', 'Acompanhar meu carro') +
        roleCard('mecanico', 'Sou mecânico', 'Atualizo a etapa e mando foto do defeito sem sair do elevador.', 'Abrir minhas OS') +
        roleCard('recepcao', 'Sou da recepção', aguardando + ' carro(s) aguardando aprovação agora. Veja o pátio e os gargalos.', 'Abrir painel') +
      '</section>' +
      '<section class="card tip"><strong>Dica para testar:</strong> abra o painel do mecânico e a tela do cliente em duas abas. ' +
      'O que um faz aparece na hora para o outro. No celular, use “Adicionar à tela inicial” para instalar o app.</section>';
  }

  function roleCard(route, title, text, cta) {
    return '<a class="card role-card" href="#/' + route + '"><h2>' + title + '</h2><p>' + text + '</p><span class="cta">' + cta + ' →</span></a>';
  }

  function viewClienteBusca(erro) {
    return '<section class="narrow">' +
      '<h1>Acompanhe seu veículo</h1>' +
      '<p class="lead">Digite a placa ou o número da ordem de serviço, ou escaneie o QR code do seu comprovante.</p>' +
      '<form class="card form" data-form="busca">' +
        '<label for="q">Placa ou nº da OS</label>' +
        '<input id="q" name="q" placeholder="Ex.: BRA2E19 ou OS-1042" autocomplete="off" required>' +
        (erro ? '<p class="error">' + esc(erro) + '</p>' : '') +
        '<button class="btn btn-primary btn-block" type="submit">Ver status</button>' +
      '</form>' +
      '<p class="muted small">Placas de exemplo: ' + state.orders.filter(function (o) { return o.step < 6; }).map(function (o) {
        return '<a href="#/cliente/' + o.id + '">' + placaFmt(o.placa) + '</a>';
      }).join(' · ') + '</p></section>';
  }

  function viewCliente(o) {
    var pend = pendentes(o);
    var s = D.STEPS[o.step];
    var banner = '';
    if (pend.length) {
      banner = '<div class="banner banner-warn"><strong>' + pend.length + ' item(ns) precisam da sua aprovação.</strong>' +
        '<span>O mecânico aguarda sua resposta para continuar.</span>' +
        (pend.length > 1 ? '<button class="btn btn-primary" data-act="aprovar-todos" data-os="' + o.id + '">Aprovar todos (' + brl(total({ itens: pend })) + ')</button>' : '') +
        '</div>';
    } else if (o.step === 5) {
      banner = '<div class="banner banner-ok"><strong>Seu carro está pronto!</strong><span>Pode retirar na recepção. Total: ' + brl(total(o, 'aprovado')) + '</span></div>';
    } else if (o.step === 6) {
      banner = '<div class="banner banner-ok"><strong>Serviço entregue.</strong><span>Obrigado pela confiança!</span></div>';
    }
    return '<section class="narrow">' +
      '<a class="back" href="#/cliente">← Buscar outro veículo</a>' +
      '<div class="card vehicle">' +
        '<div><p class="eyebrow">' + esc(o.id) + '</p><h1>' + esc(o.modelo) + '</h1>' +
        '<p class="plate">' + placaFmt(o.placa) + '</p></div>' +
        '<div class="vehicle-meta">' + badge(o) +
        '<span class="muted small">' + esc(s.desc) + ' · ' + ago(o.stepSince) + '</span>' +
        '<span class="small">Previsão: <strong>' + esc(o.previsao) + '</strong></span>' +
        '<span class="small">Mecânico responsável: ' + esc(o.mecanico) + '</span>' +
        notifyButton() + '</div>' +
      '</div>' +
      stepper(o) + banner +
      ratingBlock(o) +
      '<h2 class="section-title">Orçamento</h2>' +
      '<div class="items">' + o.itens.map(function (it) { return itemCard(o, it, 'cliente'); }).join('') + '</div>' +
      '<div class="totals card"><span>Aprovado</span><strong>' + brl(total(o, 'aprovado')) + '</strong>' +
      (pend.length ? '<span>Aguardando decisão</span><strong>' + brl(total(o, 'pendente')) + '</strong>' : '') + '</div>' +
      '<div class="client-actions">' +
        '<a class="btn btn-ghost" href="#/relatorio/' + o.id + '">📄 Relatório digital</a>' +
        '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + oficinaWhats(o) + '">💬 Falar com a oficina</a>' +
      '</div>' +
      '<h2 class="section-title">Histórico</h2>' + timeline(o) +
      '</section>';
  }

  function viewRelatorio(o) {
    var fotos = o.itens.filter(function (i) { return i.foto; });
    return '<section class="report">' +
      '<div class="report-toolbar"><a class="back" href="#/cliente/' + o.id + '">← Voltar ao acompanhamento</a>' +
      '<button class="btn btn-primary" data-act="imprimir">⬇ Salvar PDF / Imprimir</button></div>' +
      '<article class="report-doc">' +
        '<header class="report-head">' +
          '<div class="report-brand"><span class="brand-mark" aria-hidden="true">V</span>' +
          '<div><strong>Auto Center Veloz</strong><div class="muted small">Relatório digital de serviço</div></div></div>' +
          '<div><p class="eyebrow">' + o.id + '</p>' + badge(o) + '</div>' +
        '</header>' +
        '<div class="report-meta">' +
          '<div><span>Cliente</span>' + esc(o.cliente) + '</div>' +
          '<div><span>Veículo</span>' + esc(o.modelo) + '</div>' +
          '<div><span>Placa</span>' + placaFmt(o.placa) + '</div>' +
          '<div><span>Entrada</span>' + dataHora(o.entrada) + '</div>' +
          '<div><span>Mecânico</span>' + esc(o.mecanico) + '</div>' +
          '<div><span>Previsão</span>' + esc(o.previsao) + '</div>' +
        '</div>' +
        '<h2>Itens do orçamento</h2>' +
        '<table class="table"><thead><tr><th>Peça / serviço</th><th>Diagnóstico</th><th>Situação</th><th class="num">Valor</th></tr></thead><tbody>' +
          o.itens.map(function (i) {
            return '<tr><td data-th="Item"><strong>' + esc(i.desc) + '</strong></td><td data-th="Diagnóstico">' + esc(i.obs || '—') + '</td>' +
              '<td data-th="Situação"><span class="pill pill-' + i.status + '">' + { pendente: 'Pendente', aprovado: 'Aprovado', recusado: 'Recusado' }[i.status] + '</span></td>' +
              '<td data-th="Valor" class="num">' + brl(i.valor) + '</td></tr>';
          }).join('') +
          '<tr class="report-total"><td data-th="Total" colspan="3">Total aprovado</td><td class="num">' + brl(total(o, 'aprovado')) + '</td></tr>' +
        '</tbody></table>' +
        (fotos.length ? '<h2>Evidências fotográficas</h2><div class="report-photos">' + fotos.map(function (i) {
          return '<figure><img src="' + esc(i.foto) + '" alt="' + esc(i.desc) + '"><figcaption>' + esc(i.desc) + '</figcaption></figure>';
        }).join('') + '</div>' : '') +
        '<h2>Histórico do serviço</h2>' +
        '<ul class="timeline">' + o.timeline.map(function (e) {
          return '<li><time>' + dataHora(e.t) + '</time><span>' + esc(e.msg) + '</span></li>';
        }).join('') + '</ul>' +
        '<footer class="report-foot">Documento gerado em ' + dataHora(Date.now()) + ' pelo Veloz Acompanha. ' +
          'Auto Center Veloz · ' + esc(D.OFICINA.endereco) + '</footer>' +
      '</article></section>';
  }

  function viewMecanico() {
    var nome = getPref(PREF_KEY) || D.MECANICOS[0];
    var minhas = state.orders.filter(function (o) { return o.mecanico === nome && o.step < 6; });
    return '<section>' +
      '<div class="page-head"><div><p class="eyebrow">Painel do mecânico</p><h1>Minhas ordens de serviço</h1></div>' +
      '<div class="filters">' + notifyButton() +
      '<label class="select-inline">Mecânico <select data-pref="mecanico">' + D.MECANICOS.map(function (m) {
        return '<option' + (m === nome ? ' selected' : '') + '>' + m + '</option>';
      }).join('') + '</select></label></div></div>' +
      (minhas.length ? '<div class="grid-2">' + minhas.map(mecCard).join('') + '</div>'
        : '<div class="card empty">Nenhuma OS ativa para ' + esc(nome) + '.</div>') +
      '</section>';
  }

  function mecCard(o) {
    var pend = pendentes(o);
    var next = D.STEPS[o.step + 1];
    var bloqueado = o.step === 2 && pend.length > 0;
    var avancar = o.step < 5
      ? '<button class="btn btn-primary" data-act="avancar" data-os="' + o.id + '"' + (bloqueado ? ' disabled' : '') + '>' +
        (bloqueado ? 'Aguardando cliente aprovar' : 'Avançar para: ' + esc(next.label)) + '</button>'
      : '<span class="muted small">Aguardando retirada pelo cliente</span>';
    return '<article class="card os-card">' +
      '<header><div><p class="eyebrow">' + o.id + (o.elevador ? ' · Elevador ' + o.elevador : ' · Pátio') + '</p>' +
      '<h3>' + esc(o.modelo) + '</h3><p class="plate small">' + placaFmt(o.placa) + '</p></div>' + badge(o) + '</header>' +
      stepper(o) +
      '<div class="items compact">' + o.itens.map(function (it) { return itemCard(o, it, 'mecanico'); }).join('') + '</div>' +
      '<div class="os-actions">' + avancar + '</div>' +
      (o.step <= 3 ? '<details class="add-item"><summary>+ Encontrei um problema (adicionar ao orçamento)</summary>' +
        '<form class="form" data-form="item" data-os="' + o.id + '">' +
          '<label>Peça ou serviço<input name="desc" required placeholder="Ex.: Disco de freio dianteiro"></label>' +
          '<label>Valor (R$)<input name="valor" type="number" min="0" step="0.01" required placeholder="0,00"></label>' +
          '<label>Explique para o cliente<textarea name="obs" rows="2" placeholder="O que foi encontrado e por que trocar"></textarea></label>' +
          '<label>Foto da peça<input name="foto" type="file" accept="image/*" capture="environment"></label>' +
          '<button class="btn btn-primary" type="submit">Enviar para aprovação</button>' +
        '</form></details>' : '') +
      '</article>';
  }

  function filtrar(o) {
    if (filtro.etapa !== 'todas' && D.STEPS[o.step].key !== filtro.etapa) return false;
    var q = filtro.q.trim().toLowerCase();
    if (!q) return true;
    var hay = (o.id + ' ' + placaFmt(o.placa) + ' ' + o.cliente + ' ' + o.modelo + ' ' + o.mecanico).toLowerCase();
    var compact = function (x) { return x.replace(/[^a-z0-9]/g, ''); };
    return hay.indexOf(q) >= 0 || (compact(q) !== '' && compact(hay).indexOf(compact(q)) >= 0);
  }

  function linhasRecepcao() {
    var ativas = state.orders.filter(function (o) { return o.step < 6 && filtrar(o); });
    if (!ativas.length) return '<tr><td colspan="6" class="muted">Nenhuma OS encontrada.</td></tr>';
    return ativas.sort(function (a, b) {
      return (b.step === 2) - (a.step === 2) || a.stepSince - b.stepSince;
    }).map(function (o) {
      return '<tr class="' + (waitingAlert(o) ? 'row-alert' : '') + '">' +
        '<td data-th="OS"><a href="#/cliente/' + o.id + '">' + o.id + '</a></td>' +
        '<td data-th="Veículo"><strong>' + placaFmt(o.placa) + '</strong><br><span class="muted small">' + esc(o.modelo) + '</span></td>' +
        '<td data-th="Cliente">' + esc(o.cliente) + '</td>' +
        '<td data-th="Etapa">' + badge(o) + '</td>' +
        '<td data-th="Na etapa">' + dur(Date.now() - o.stepSince) + (waitingAlert(o) ? ' <span class="pill pill-recusado">parado</span>' : '') + '</td>' +
        '<td data-th="Ações" class="actions-cell"><div class="actions">' +
          '<button class="btn btn-sm btn-ghost" data-act="comprovante" data-os="' + o.id + '">QR</button>' +
          '<button class="btn btn-sm btn-ghost" data-act="copiar" data-os="' + o.id + '">Copiar link</button>' +
          '<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="' + whatsLink(o) + '">WhatsApp</a>' +
          (o.step === 5 ? '<button class="btn btn-sm btn-primary" data-act="entregar" data-os="' + o.id + '">Entregar</button>' : '') +
        '</div></td></tr>';
    }).join('');
  }

  function viewRecepcao() {
    var ativas = state.orders.filter(function (o) { return o.step < 6; });
    var aguard = ativas.filter(function (o) { return o.step === 2; });
    var prontos = ativas.filter(function (o) { return o.step === 5; });
    var mediaAguard = aguard.length ? aguard.reduce(function (s, o) { return s + (Date.now() - o.stepSince); }, 0) / aguard.length : 0;
    var avals = state.orders.filter(function (o) { return o.avaliacao; });
    var nota = avals.length ? avals.reduce(function (s, o) { return s + o.avaliacao.nota; }, 0) / avals.length : 0;
    var ocupados = {};
    ativas.forEach(function (o) { if (o.elevador) ocupados[o.elevador] = o; });

    var elevadores = '';
    for (var e = 1; e <= D.ELEVADORES; e++) {
      var o = ocupados[e];
      elevadores += '<div class="lift ' + (o ? 'busy' : 'free') + (o && waitingAlert(o) ? ' alert' : '') + '">' +
        '<span class="lift-n">Elevador ' + e + '</span>' +
        (o ? '<strong>' + placaFmt(o.placa) + '</strong><span class="small">' + esc(o.mecanico) + ' · ' + esc(D.STEPS[o.step].label) + '</span>'
           : '<strong>Livre</strong><span class="small">Disponível</span>') + '</div>';
    }

    var contagem = {};
    ativas.forEach(function (x) { var k = D.STEPS[x.step].key; contagem[k] = (contagem[k] || 0) + 1; });
    var chips = '<button class="chip' + (filtro.etapa === 'todas' ? ' active' : '') + '" data-act="etapa" data-etapa="todas">Todas<small>' + ativas.length + '</small></button>' +
      D.STEPS.slice(0, 6).filter(function (s) { return contagem[s.key]; }).map(function (s) {
        return '<button class="chip' + (filtro.etapa === s.key ? ' active' : '') + '" data-act="etapa" data-etapa="' + s.key + '">' + s.label + '<small>' + contagem[s.key] + '</small></button>';
      }).join('');

    var livres = [];
    for (var l = 1; l <= D.ELEVADORES; l++) if (!ocupados[l]) livres.push(l);

    return '<section>' +
      '<div class="page-head"><div><p class="eyebrow">Recepção e gestão</p><h1>Pátio agora</h1></div>' +
      '<button class="btn btn-primary" data-act="nova-os">+ Nova OS</button></div>' +
      '<div class="kpis">' +
        kpi('Carros na oficina', ativas.length, '') +
        kpi('Aguardando aprovação', aguard.length, aguard.length ? 'warn' : '') +
        kpi('Tempo médio aguardando', aguard.length ? dur(mediaAguard) : '—', mediaAguard / 60000 > ALERTA_APROVACAO_MIN ? 'warn' : '') +
        kpi('Prontos p/ retirada', prontos.length, prontos.length ? 'ok' : '') +
        kpi('Nota dos clientes', avals.length ? nota.toFixed(1).replace('.', ',') + ' ★' : '—', nota >= 4 ? 'ok' : avals.length ? 'warn' : '') +
      '</div>' +
      '<h2 class="section-title">Elevadores</h2><div class="lifts">' + elevadores + '</div>' +
      '<h2 class="section-title">Ordens de serviço ativas</h2>' +
      '<div class="filters"><input type="search" data-filter="q" value="' + esc(filtro.q) + '" placeholder="Buscar por placa, cliente, OS ou mecânico" aria-label="Buscar OS">' + chips + '</div>' +
      '<div class="card table-wrap"><table class="table"><thead><tr><th>OS</th><th>Veículo</th><th>Cliente</th><th>Etapa</th><th>Na etapa</th><th>Ações</th></tr></thead>' +
      '<tbody id="os-rows">' + linhasRecepcao() + '</tbody></table></div>' +
      (avals.length ? '<h2 class="section-title">Últimas avaliações</h2><div class="grid-3">' + avals.slice(-3).reverse().map(function (x) {
        return '<div class="card"><span class="stars-static" style="color:#f59e0b">' + stars(x.avaliacao.nota) + '</span>' +
          '<p class="small">' + esc(x.avaliacao.comentario || 'Sem comentário.') + '</p><span class="muted small">' + esc(x.cliente) + ' · ' + x.id + '</span></div>';
      }).join('') + '</div>' : '') +
      '<dialog id="dlg-os" class="dialog"><form class="form" data-form="nova-os" method="dialog">' +
        '<h2>Nova ordem de serviço</h2>' +
        '<div class="form-grid">' +
          '<label>Placa<input name="placa" required maxlength="8" placeholder="ABC1D23"></label>' +
          '<label>Modelo<input name="modelo" required placeholder="Ex.: Renault Kwid 2020"></label>' +
          '<label>Cliente<input name="cliente" required></label>' +
          '<label>WhatsApp (DDD + número)<input name="telefone" required inputmode="numeric" placeholder="41999990000"></label>' +
          '<label>Mecânico<select name="mecanico">' + D.MECANICOS.map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select></label>' +
          '<label>Elevador<select name="elevador"><option value="">Pátio (sem elevador)</option>' +
            livres.map(function (n) { return '<option value="' + n + '">Elevador ' + n + '</option>'; }).join('') + '</select></label>' +
          '<label>Serviço solicitado<input name="servico" required placeholder="Ex.: Revisão preventiva"></label>' +
          '<label>Valor (R$)<input name="valor" type="number" min="0" step="0.01" value="0"></label>' +
          '<label>Previsão de entrega<input name="previsao" placeholder="Ex.: Hoje, 18h00"></label>' +
        '</div>' +
        '<div class="dialog-actions"><button class="btn btn-ghost" value="cancel" formnovalidate>Cancelar</button>' +
        '<button class="btn btn-primary" value="ok">Criar OS e gerar comprovante</button></div>' +
      '</form></dialog>' +
      '<dialog id="dlg-qr" class="dialog" style="width:min(420px, calc(100vw - 32px))"><div id="qr-body"></div>' +
        '<div class="dialog-actions"><button class="btn btn-ghost" data-act="fechar-qr">Fechar</button></div></dialog>' +
      '</section>';
  }

  function kpi(label, value, tone) {
    return '<div class="kpi ' + tone + '"><span>' + label + '</span><strong>' + value + '</strong></div>';
  }

  function abrirComprovante(o) {
    var dlg = document.getElementById('dlg-qr');
    var body = document.getElementById('qr-body');
    var link = clientLink(o);
    body.innerHTML = '<div class="ticket">' +
      '<p class="eyebrow">Comprovante digital · ' + o.id + '</p>' +
      '<h2>' + esc(o.modelo) + '</h2><p class="plate">' + placaFmt(o.placa) + '</p>' +
      '<div class="qr" id="qr-code" aria-label="QR code do link de acompanhamento"></div>' +
      '<p class="small">Escaneie para acompanhar o serviço e aprovar o orçamento.</p>' +
      '<code>' + esc(link) + '</code>' +
      '<a class="btn btn-primary btn-block" target="_blank" rel="noopener" href="' + whatsLink(o) + '">Enviar link pelo WhatsApp</a>' +
      '</div>';
    var box = document.getElementById('qr-code');
    if (window.QRCode) {
      new window.QRCode(box, { text: link, width: 200, height: 200, colorDark: '#0f172a', colorLight: '#ffffff' });
    } else {
      box.innerHTML = '<span class="small" style="color:#0f172a;line-height:1.4;display:block;padding:20px">QR indisponível offline.<br>Use o link abaixo.</span>';
    }
    dlg.showModal();
  }

  /* ---------- Roteamento ---------- */

  function render() {
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var route = parts[0] || '';
    var html, o;
    if (route === 'cliente') {
      o = parts[1] ? findOrder(decodeURIComponent(parts[1])) : null;
      html = o ? viewCliente(o) : viewClienteBusca(parts[1] ? 'Não encontramos esse veículo. Confira a placa ou o número da OS.' : '');
    } else if (route === 'relatorio') {
      o = findOrder(decodeURIComponent(parts[1] || ''));
      html = o ? viewRelatorio(o) : viewClienteBusca('Relatório não encontrado.');
    } else if (route === 'mecanico') {
      html = viewMecanico();
    } else if (route === 'recepcao') {
      html = viewRecepcao();
    } else if (route === 'desenvolvedor') {
      html = DEV.view();
      DEV.fetchLive(function () { if (location.hash.indexOf('desenvolvedor') >= 0) render(); });
    } else {
      html = viewHome();
    }
    var openDetails = Array.prototype.map.call(app.querySelectorAll('details[open] form'), function (f) { return f.dataset.os; });
    app.innerHTML = html;
    openDetails.forEach(function (id) {
      var f = app.querySelector('form[data-form="item"][data-os="' + id + '"]');
      if (f) f.parentNode.open = true;
    });
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      a.classList.toggle('active', a.dataset.nav === route || (route === 'relatorio' && a.dataset.nav === 'cliente'));
    });
  }

  function go() { render(); window.scrollTo(0, 0); }

  /* ---------- Ações ---------- */

  function decidir(o, ids, status) {
    ids.forEach(function (id) {
      var it = o.itens.filter(function (i) { return i.id === id; })[0];
      if (it && it.status === 'pendente') it.status = status;
    });
    var verbo = status === 'aprovado' ? 'aprovou' : 'recusou';
    log(o, 'Cliente ' + verbo + ' ' + ids.length + ' item(ns) pelo app');
    if (o.step === 2 && !pendentes(o).length) {
      setStep(o, 3, 'Orçamento respondido. Serviço liberado automaticamente para ' + o.mecanico);
    }
    save(); render();
    toast(status === 'aprovado' ? 'Aprovado! O mecânico já foi avisado.' : 'Item recusado. Não será executado.');
  }

  app.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-act]');
    if (!btn) return;
    var o = btn.dataset.os ? findOrder(btn.dataset.os) : null;
    var act = btn.dataset.act;

    if (act === 'aprovar' || act === 'recusar') {
      decidir(o, [btn.dataset.item], act === 'aprovar' ? 'aprovado' : 'recusado');
    } else if (act === 'aprovar-todos') {
      decidir(o, pendentes(o).map(function (i) { return i.id; }), 'aprovado');
    } else if (act === 'avancar') {
      if (o.step === 2 && pendentes(o).length) return;
      setStep(o, o.step + 1);
      save(); render();
      toast(o.id + ': ' + D.STEPS[o.step].label + '. Cliente notificado.');
    } else if (act === 'entregar') {
      setStep(o, 6, 'Veículo entregue ao cliente');
      save(); render();
      toast(o.id + ' entregue. O cliente recebeu o pedido de avaliação.');
    } else if (act === 'copiar') {
      var link = clientLink(o);
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject())
        .then(function () { toast('Link do cliente copiado.'); })
        .catch(function () { window.prompt('Copie o link do cliente:', link); });
    } else if (act === 'nova-os') {
      document.getElementById('dlg-os').showModal();
    } else if (act === 'comprovante') {
      abrirComprovante(o);
    } else if (act === 'fechar-qr') {
      document.getElementById('dlg-qr').close();
    } else if (act === 'etapa') {
      filtro.etapa = btn.dataset.etapa;
      render();
    } else if (act === 'nota') {
      ev.preventDefault();
      notaSel[o.id] = parseInt(btn.dataset.n, 10);
      var form = btn.closest('form');
      form.querySelectorAll('.star').forEach(function (s) {
        var on = parseInt(s.dataset.n, 10) <= notaSel[o.id];
        s.classList.toggle('on', on);
        s.setAttribute('aria-pressed', on);
      });
      form.querySelector('[type="submit"]').disabled = false;
    } else if (act === 'imprimir') {
      window.print();
    } else if (act === 'notificar') {
      Notification.requestPermission().then(function (p) {
        render();
        toast(p === 'granted' ? 'Pronto! Você será avisado a cada mudança.' : 'Avisos não autorizados no navegador.');
      });
    }
  });

  app.addEventListener('change', function (ev) {
    if (ev.target.dataset.pref === 'mecanico') { setPref(PREF_KEY, ev.target.value); render(); }
  });

  app.addEventListener('input', function (ev) {
    if (ev.target.dataset.filter === 'q') {
      filtro.q = ev.target.value;
      document.getElementById('os-rows').innerHTML = linhasRecepcao();
    }
  });

  app.addEventListener('submit', function (ev) {
    var f = ev.target;
    var kind = f.dataset.form;
    if (kind === 'busca') {
      ev.preventDefault();
      var o = findOrder(f.q.value);
      location.hash = '#/cliente/' + (o ? o.id : encodeURIComponent(f.q.value.trim() || '?'));
    } else if (kind === 'avaliar') {
      ev.preventDefault();
      var av = findOrder(f.dataset.os);
      if (!notaSel[av.id]) return;
      av.avaliacao = { nota: notaSel[av.id], comentario: f.comentario.value.trim(), t: Date.now() };
      log(av, 'Cliente avaliou o atendimento: ' + stars(av.avaliacao.nota));
      save(); render();
      toast('Avaliação enviada. Obrigado!');
    } else if (kind === 'item') {
      ev.preventDefault();
      var os = findOrder(f.dataset.os);
      var add = function (foto) {
        os.itens.push({
          id: 'i' + Date.now(), desc: f.desc.value.trim(), valor: parseFloat(f.valor.value) || 0,
          obs: f.obs.value.trim(), status: 'pendente', foto: foto || null
        });
        if (os.step !== 2) setStep(os, 2, os.mecanico + ' enviou novo item para aprovação: ' + f.desc.value.trim());
        else log(os, os.mecanico + ' adicionou ao orçamento: ' + f.desc.value.trim());
        save(); render();
        toast('Enviado ao cliente. Você será avisado quando ele responder.');
      };
      var file = f.foto.files[0];
      if (file) resizeImage(file, add); else add(null);
    } else if (kind === 'nova-os') {
      if (ev.submitter && ev.submitter.value !== 'ok') return;
      var placa = f.placa.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (findOrder(placa) && findOrder(placa).step < 6) {
        ev.preventDefault();
        toast('Já existe uma OS ativa para essa placa.');
        return;
      }
      var max = state.orders.reduce(function (m, x) { return Math.max(m, parseInt(x.id.slice(3), 10)); }, 1000);
      var nova = {
        id: 'OS-' + (max + 1), placa: placa, modelo: f.modelo.value.trim(), cliente: f.cliente.value.trim(),
        telefone: f.telefone.value.replace(/\D/g, ''), mecanico: f.mecanico.value,
        elevador: f.elevador.value ? parseInt(f.elevador.value, 10) : null, step: 0,
        entrada: Date.now(), stepSince: Date.now(), previsao: f.previsao.value.trim() || 'A definir',
        itens: [{ id: 'i1', desc: f.servico.value.trim(), valor: parseFloat(f.valor.value) || 0, status: 'aprovado', obs: 'Solicitado na entrada.', foto: null }],
        timeline: [{ t: Date.now(), msg: 'Veículo recebido pela recepção' }]
      };
      state.orders.push(nova);
      save();
      setTimeout(function () { render(); abrirComprovante(nova); }, 0);
    }
  });

  document.getElementById('reset-demo').addEventListener('click', function () {
    if (!window.confirm('Restaurar os dados de exemplo? As alterações feitas neste navegador serão perdidas.')) return;
    state = D.seed(); notaSel = {}; save(); go(); toast('Dados de exemplo restaurados.');
  });

  /* Tema claro/escuro: segue o sistema até o usuário escolher. */
  document.getElementById('theme-toggle').addEventListener('click', function () {
    var root = document.documentElement;
    var atual = root.dataset.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    root.dataset.theme = atual === 'dark' ? 'light' : 'dark';
    setPref(THEME_KEY, root.dataset.theme);
  });

  /* Sincroniza abas abertas (cliente x mecânico x recepção) em tempo real. */
  window.addEventListener('storage', function (ev) {
    if (ev.key === STORE_KEY && ev.newValue) {
      try {
        var novo = JSON.parse(ev.newValue);
        var msgs = diffs(state, novo);
        state = novo;
        if (!document.querySelector('dialog[open]')) render();
        notify(msgs);
      } catch (e) { /* ignora */ }
    }
  });

  window.addEventListener('hashchange', go);
  setInterval(function () {
    if (!document.querySelector('dialog[open], details[open], input:focus, textarea:focus')) render();
  }, 60000);
  render();
})();
