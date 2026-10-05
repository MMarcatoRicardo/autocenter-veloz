/* Dados de exemplo (fictícios) usados na primeira abertura do protótipo. */
(function () {
  'use strict';

  var STEPS = [
    { key: 'recebido', label: 'Recebido', desc: 'Veículo cadastrado na recepção' },
    { key: 'diagnostico', label: 'Diagnóstico', desc: 'Mecânico avaliando o veículo' },
    { key: 'aprovacao', label: 'Aguardando aprovação', desc: 'Orçamento enviado ao cliente' },
    { key: 'servico', label: 'Em serviço', desc: 'Peças e serviços em execução' },
    { key: 'testes', label: 'Testes finais', desc: 'Teste de rodagem e conferência' },
    { key: 'pronto', label: 'Pronto para retirada', desc: 'Pode buscar o carro' },
    { key: 'entregue', label: 'Entregue', desc: 'Serviço concluído' }
  ];

  var MECANICOS = ['Carlos', 'Diego', 'Fábio', 'Jonas', 'Marcos', 'Rafael'];
  var ELEVADORES = 5;

  function minutesAgo(m) { return Date.now() - m * 60000; }

  function photo(label, tone) {
    var c = tone === 'bad' ? '#dc2626' : tone === 'warn' ? '#f59e0b' : '#16a34a';
    var svg =
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200'>" +
      "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
      "<stop offset='0' stop-color='#334155'/><stop offset='1' stop-color='#0f172a'/></linearGradient></defs>" +
      "<rect width='320' height='200' fill='url(#g)'/>" +
      "<circle cx='160' cy='92' r='52' fill='none' stroke='#94a3b8' stroke-width='14'/>" +
      "<circle cx='160' cy='92' r='18' fill='#64748b'/>" +
      "<path d='M118 60 L150 92' stroke='" + c + "' stroke-width='6' stroke-linecap='round'/>" +
      "<rect x='0' y='150' width='320' height='50' fill='rgba(0,0,0,.55)'/>" +
      "<text x='14' y='183' font-family='Arial' font-weight='bold' font-size='21' fill='#fff'>" + label + "</text>" +
      "<circle cx='300' cy='175' r='8' fill='" + c + "'/></svg>";
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function seed() {
    return {
      version: 1,
      orders: [
        {
          id: 'OS-1042', placa: 'BRA2E19', modelo: 'VW Gol 1.0 2019', cliente: 'Mariana Souza',
          telefone: '41999990001', elevador: 1, mecanico: 'Carlos', step: 2,
          entrada: minutesAgo(210), stepSince: minutesAgo(95), previsao: 'Hoje, 17h30',
          itens: [
            { id: 'i1', desc: 'Troca de óleo e filtro', valor: 189.9, status: 'aprovado', obs: 'Revisão preventiva solicitada na entrada.', foto: null },
            { id: 'i2', desc: 'Pastilhas de freio dianteiras', valor: 260, status: 'pendente', obs: 'Pastilhas com 2 mm, abaixo do limite de segurança (3 mm).', foto: photo('Pastilha dianteira: 2 mm', 'bad') },
            { id: 'i3', desc: 'Palheta do limpador', valor: 79.9, status: 'pendente', obs: 'Borracha ressecada, deixa marcas no vidro. Opcional.', foto: photo('Palheta ressecada', 'warn') }
          ],
          timeline: [
            { t: minutesAgo(210), msg: 'Veículo recebido pela recepção' },
            { t: minutesAgo(180), msg: 'Carlos iniciou o diagnóstico no elevador 1' },
            { t: minutesAgo(95), msg: 'Orçamento enviado para aprovação (2 itens novos)' }
          ]
        },
        {
          id: 'OS-1043', placa: 'QTX4B21', modelo: 'Fiat Argo 1.3 2021', cliente: 'Paulo Henrique Lima',
          telefone: '41999990002', elevador: 2, mecanico: 'Diego', step: 3,
          entrada: minutesAgo(300), stepSince: minutesAgo(60), previsao: 'Hoje, 16h00',
          itens: [
            { id: 'i1', desc: 'Alinhamento e balanceamento', valor: 150, status: 'aprovado', obs: '', foto: null },
            { id: 'i2', desc: 'Amortecedores traseiros (par)', valor: 890, status: 'aprovado', obs: 'Vazamento de óleo no amortecedor esquerdo.', foto: photo('Amortecedor com vazamento', 'bad') }
          ],
          timeline: [
            { t: minutesAgo(300), msg: 'Veículo recebido pela recepção' },
            { t: minutesAgo(240), msg: 'Diego iniciou o diagnóstico no elevador 2' },
            { t: minutesAgo(150), msg: 'Orçamento enviado para aprovação' },
            { t: minutesAgo(62), msg: 'Cliente aprovou 2 itens pelo app' },
            { t: minutesAgo(60), msg: 'Serviço iniciado' }
          ]
        },
        {
          id: 'OS-1044', placa: 'RHN7C33', modelo: 'Toyota Corolla 2.0 2020', cliente: 'Ana Beatriz Costa',
          telefone: '41999990003', elevador: 3, mecanico: 'Fábio', step: 5,
          entrada: minutesAgo(420), stepSince: minutesAgo(25), previsao: 'Pronto',
          itens: [
            { id: 'i1', desc: 'Revisão 40.000 km', valor: 980, status: 'aprovado', obs: '', foto: null },
            { id: 'i2', desc: 'Filtro de ar-condicionado', valor: 95, status: 'aprovado', obs: 'Filtro saturado.', foto: photo('Filtro de cabine saturado', 'warn') },
            { id: 'i3', desc: 'Higienização do ar-condicionado', valor: 120, status: 'recusado', obs: 'Opcional.', foto: null }
          ],
          timeline: [
            { t: minutesAgo(420), msg: 'Veículo recebido pela recepção' },
            { t: minutesAgo(380), msg: 'Fábio iniciou o diagnóstico no elevador 3' },
            { t: minutesAgo(330), msg: 'Orçamento enviado para aprovação' },
            { t: minutesAgo(318), msg: 'Cliente aprovou 2 itens e recusou 1 pelo app' },
            { t: minutesAgo(70), msg: 'Testes finais concluídos' },
            { t: minutesAgo(25), msg: 'Veículo pronto para retirada' }
          ]
        },
        {
          id: 'OS-1045', placa: 'MXZ0D45', modelo: 'Honda HR-V 1.8 2018', cliente: 'Roberto Alves',
          telefone: '41999990004', elevador: 4, mecanico: 'Jonas', step: 1,
          entrada: minutesAgo(40), stepSince: minutesAgo(30), previsao: 'Amanhã, 12h00',
          itens: [
            { id: 'i1', desc: 'Diagnóstico de ruído na suspensão', valor: 0, status: 'aprovado', obs: 'Sem custo.', foto: null }
          ],
          timeline: [
            { t: minutesAgo(40), msg: 'Veículo recebido pela recepção' },
            { t: minutesAgo(30), msg: 'Jonas iniciou o diagnóstico no elevador 4' }
          ]
        },
        {
          id: 'OS-1046', placa: 'KLB3F88', modelo: 'Chevrolet Onix 1.0 2022', cliente: 'Juliana Martins',
          telefone: '41999990005', elevador: null, mecanico: 'Marcos', step: 2,
          entrada: minutesAgo(260), stepSince: minutesAgo(185), previsao: 'A definir',
          itens: [
            { id: 'i1', desc: 'Bateria 60 Ah', valor: 520, status: 'pendente', obs: 'Teste de carga reprovado (9,8 V na partida).', foto: photo('Teste de bateria: 9,8 V', 'bad') }
          ],
          timeline: [
            { t: minutesAgo(260), msg: 'Veículo recebido pela recepção' },
            { t: minutesAgo(230), msg: 'Marcos iniciou o diagnóstico' },
            { t: minutesAgo(185), msg: 'Orçamento enviado para aprovação. Veículo liberou o elevador e aguarda no pátio' }
          ]
        }
      ]
    };
  }

  window.VELOZ_DATA = { STEPS: STEPS, MECANICOS: MECANICOS, ELEVADORES: ELEVADORES, seed: seed };
})();
