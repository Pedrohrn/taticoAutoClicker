function encontrarElemento(tipo, seletor) {
  if (!seletor) return null;
  try {
    if (tipo === 'css' || tipo === 'id' || tipo === 'class') {
      return document.querySelector(seletor);
    }
    if (tipo === 'xpath') {
      return document.evaluate(seletor, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
    if (tipo === 'text') {
      const todos = document.querySelectorAll('*');
      for (let el of todos) {
        if (el.textContent.trim() === seletor) return el;
      }
    }
  } catch (e) {
    console.warn('Tatico AutoClicker: Erro ao buscar elemento (Seletor Invalido)', e);
  }
  return null;
}

function verificarParada(condicao) {
  if (!condicao || !condicao.valor_seletor) return false;
  return encontrarElemento(condicao.tipo || 'css', condicao.valor_seletor) !== null;
}

async function executarRotinaAvancada(rotina) {
  console.log(`Iniciando Fila Avancada: ${rotina.nome}`);

  let abortar = false;
  let qtdeExecutado = 0;
  let refreshTimer = null;

  if (rotina.autorefresh_ativo && (rotina.autorefresh_min > 0 || rotina.autorefresh_seg > 0)) {
    const timeMs = ((rotina.autorefresh_min || 0) * 60 + (rotina.autorefresh_seg || 0)) * 1000;
    refreshTimer = setTimeout(() => { location.reload(); }, timeMs);
  }

  while (!abortar && (rotina.loop || qtdeExecutado < (rotina.qtde_execucoes || 1))) {
    if (rotina.usa_parada && verificarParada(rotina.condicao_parada)) {
      console.log(`Fila abortada via Condicao de Parada Global: ${rotina.nome}`);
      abortar = true;
      break;
    }

    for (let passo of rotina.passos_avancados) {
      if (abortar) break;

      if (passo.delay_ms > 0) {
        await new Promise(res => setTimeout(res, passo.delay_ms));
      }

      if (passo.acao === 'click') {
        const limiteClicks = passo.click_qtde || 1;
        let cliquesFeitos = 0;

        // se a qtde for exatamente 1 e houver condicao de parada configurada, a intencao logica e
        // manter um comportamento persistente de tentativa ate a condicao ser satisfeita.
        const sobreporLimitePorParada = (limiteClicks === 1 && passo.parada_seletor !== '');

        while (true) {
          if (abortar) break;

          // prioritario: avalio se alcancou a condicao de parada definida no passo
          if (passo.parada_seletor && encontrarElemento(passo.parada_tipo || 'css', passo.parada_seletor)) {
            console.log(`Parada de passo atingida. Pulando para o proximo.`);
            break;
          }

          const alvo = encontrarElemento(passo.tipo_seletor, passo.valor_seletor);

          if (!alvo) {
            // alvo sumiu do DOM durante uma execucao continuada (ja clicou pelo menos uma vez)
            if (cliquesFeitos > 0) {
              break;
            }
            // o primeiro click e garantido pela regra; se ainda nao apareceu, aguardo ate surgir
            await new Promise(res => setTimeout(res, 1000));
            continue;
          }

          // click estrito garantido
          alvo.click();
          cliquesFeitos++;

          // finalizo o laco condicional caso o limite logico tenha se concretizado
          if (!sobreporLimitePorParada && limiteClicks > 0 && cliquesFeitos >= limiteClicks) {
            break;
          }

          // aguardo o delay especificado entre os clicks iterativos
          await new Promise(res => setTimeout(res, passo.click_intervalo_ms || 1000));
        }
      }
      else if (passo.acao === 'wait') {
        // block_wait removido; acao "aguardar" agora significa inerentemente segurar ate encontrar.
        while (true) {
          if (abortar) break;
          if (encontrarElemento(passo.tipo_seletor, passo.valor_seletor)) {
            break;
          }
          await new Promise(res => setTimeout(res, 1000));
        }
      }
    }
    qtdeExecutado++;
  }

  if (refreshTimer) clearTimeout(refreshTimer);

  if (rotina.acionar_revolver && rotina.revolver_playlist_id && !abortar) {
    console.log('Rotina concluida. Acionando Auto Tab Revolver...');
    setTimeout(() => {
      chrome.storage.local.set({
        revolverAtivo: true,
        playlistIdAtiva: rotina.revolver_playlist_id
      });
    }, rotina.revolver_timeout_ms || 0);
  }
}

function iniciarFilaRotinasSimples(rotina) {
  const cfg = rotina.config_simples;
  const intervalo = setInterval(() => {
    if (rotina.usa_parada && verificarParada(rotina.condicao_parada)) {
      console.log(`Fila simples abortada via Condicao de Parada: ${rotina.nome}`);
      clearInterval(intervalo);
      return;
    }

    const elemento = encontrarElemento('css', cfg.seletor_alvo);
    if (elemento) {
      elemento.click();
      if (!cfg.clique_continuo) clearInterval(intervalo);
    }
  }, cfg.intermitencia_ms);
}

window.addEventListener('load', () => {
  chrome.storage.local.get(['perfis', 'rotinas'], (data) => {
    const perfis = data.perfis || [];
    const rotinas = data.rotinas || [];

    const urlAtual = location.href;
    const hojeDate = new Date();
    const diaAtual = hojeDate.getDay();
    const hh = hojeDate.getHours().toString().padStart(2, '0');
    const mm = hojeDate.getMinutes().toString().padStart(2, '0');
    const horaAtualStr = `${hh}:${mm}`;

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
      console.log('Tatico AutoClicker: Contexto atual nao atende a nenhum perfil.');
      return;
    }

    const rotinasDoPerfil = rotinas.filter(r => r.perfil_id === perfilAtivo.id && r.ativa);
    rotinasDoPerfil.forEach(rotina => {
      if (rotina.tipo === 'simples') iniciarFilaRotinasSimples(rotina);
      else executarRotinaAvancada(rotina);
    });
  });
});
