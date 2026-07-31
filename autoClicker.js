// inicializo o motor avaliador assim que a pagina e totalmente montada pelo dom
window.addEventListener('load', () => {
  chrome.storage.local.get(['perfis', 'rotinas'], (data) => {
    const perfis = data.perfis || [];
    const rotinas = data.rotinas || [];

    const urlAtual = location.href;
    const hojeDate = new Date();
    const diaAtual = hojeDate.getDay(); // 0(dom) a 6(sab)
    const hh = hojeDate.getHours().toString().padStart(2, '0');
    const mm = hojeDate.getMinutes().toString().padStart(2, '0');
    const horaAtualStr = `${hh}:${mm}`;

    // encontro qual perfil o contexto atual (pagina e relogio) se encaixa
    const perfilAtivo = perfis.find(p => {
      const matchDia = p.dias_semana.includes(diaAtual);
      const matchUrl = p.urls_alvo.some(url => urlAtual.includes(url));

      let matchHora = true;
      if (p.horario && p.horario.inicio && p.horario.fim) {
        matchHora = (horaAtualStr >= p.horario.inicio && horaAtualStr <= p.horario.fim);
      }

      return matchDia && matchUrl && matchHora;
    });

    if (!perfilAtivo) {
      console.log('Tatico AutoClicker: Contexto atual nao atende a nenhum perfil de automacao.');
      return;
    }

    console.log(`Tatico AutoClicker: Contexto ativado pelo perfil [${perfilAtivo.nome}]`);

    // busco as rotinas amarradas ao perfil ativo
    const rotinasAtivas = rotinas.filter(r => r.perfil_id === perfilAtivo.id && r.ativa);

    rotinasAtivas.forEach(r => {
      if (r.tipo === 'simples') {
        executarRotinaSimples(r);
      } else {
        executarRotinaAvancada(r);
      }
    });
  });
});

// localizador universal que lida com prioridades de busca no DOM
function encontrarElemento(tipo, seletor) {
  try {
    if (tipo === 'xpath') {
      return document.evaluate(seletor, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
    if (tipo === 'css') {
      return document.querySelector(seletor);
    }
    if (tipo === 'text') {
      // fallback frágil: procura a exata string dentro do body
      const elementos = Array.from(document.querySelectorAll('*'));
      return elementos.find(el => el.innerText && el.innerText.trim() === seletor && el.children.length === 0);
    }
  } catch (err) {
    console.error(`Erro ao localizar ${tipo}: ${seletor}`, err);
  }
  return null;
}

// monitora e orquestra condicoes de parada da rotina injetada
function verificarParada(condicao) {
  if (condicao.tipo === 'loop_infinito') return false;

  const el = document.querySelector(condicao.valor_seletor);
  if (condicao.tipo === 'elemento_presente' && el) return true;
  if (condicao.tipo === 'elemento_ausente' && !el) return true;

  return false;
}

function executarRotinaSimples(rotina) {
  const cfg = rotina.config_simples;
  console.log(`Iniciando Rotina Simples: ${rotina.nome}`);

  const intervalo = setInterval(() => {
    if (verificarParada(rotina.condicao_parada)) {
      console.log(`Rotina Simples abortada via Condicao de Parada: ${rotina.nome}`);
      clearInterval(intervalo);
      return;
    }

    const elemento = document.querySelector(cfg.seletor_alvo);
    if (elemento) {
      elemento.click();
      if (!cfg.clique_continuo) clearInterval(intervalo);
    }
  }, cfg.intermitencia_ms);
}

// executo a fila de funcoes promises usando async await isoladamente do thread principal
async function executarRotinaAvancada(rotina) {
  console.log(`Iniciando Fila Avancada: ${rotina.nome}`);

  let abortar = false;

  while (!abortar) {
    if (verificarParada(rotina.condicao_parada)) {
      console.log(`Fila abortada via Condicao de Parada: ${rotina.nome}`);
      break;
    }

    for (let passo of rotina.passos_avancados) {
      if (passo.delay_ms > 0) {
        await new Promise(res => setTimeout(res, passo.delay_ms));
      }

      if (passo.acao === 'click') {
        const alvo = encontrarElemento(passo.tipo_seletor, passo.valor_seletor);
        if (alvo) alvo.click();
      }

      // se for apenas tipo 'wait', o loop for avança iterando o proximo apenas apos aguardar o delay da promise acima
    }

    // condicoes para refazer o loop
    if (rotina.condicao_parada.tipo === 'loop_infinito') {
      // pequeno folego padrao para evitar congelamento da tab no loop
      await new Promise(res => setTimeout(res, 500));
    } else {
      abortar = true; // se nao tem config pra fazer loop, eu zero a engine aqui.
    }
  }
}
