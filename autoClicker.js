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

  if (rotina.autorefresh_min > 0 || rotina.autorefresh_seg > 0) {
    const timeMs = ((rotina.autorefresh_min || 0) * 60 + (rotina.autorefresh_seg || 0)) * 1000;
    refreshTimer = setTimeout(() => { location.reload(); }, timeMs);
  }

  // analiso e respeito a qtde executada vs as regras de loop
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
        // 0 indica loop infinito no passo até que a condição de parada o interrompa
        const isInfinito = passo.click_qtde === 0;
        const maxClicks = isInfinito ? 1 : (passo.click_qtde || 1);
        let c = 0;

        // uso while para contemplar o loop iterativo sem limites quando isInfinito for true
        while (isInfinito || c < maxClicks) {
          if (abortar) break;

          // busco a condicao de parada a cada iteracao
          if (passo.parada_seletor && encontrarElemento(passo.parada_tipo || 'css', passo.parada_seletor)) {
            console.log(`Parada de passo atingida. Pulando para proximo passo.`);
            break;
          }

          const alvo = encontrarElemento(passo.tipo_seletor, passo.valor_seletor);
          if (alvo) alvo.click();

          // aguardo o intervalo se for infinito ou se nao for o ultimo clique da grade finita
          if (isInfinito || c < maxClicks - 1) {
            await new Promise(res => setTimeout(res, passo.click_intervalo_ms || 1000));
          }

          c++;
        }
      }
      else if (passo.acao === 'wait') {
        if (passo.wait_block !== false) {
          let achou = false;
          while (!achou && !abortar) {
            if (encontrarElemento(passo.tipo_seletor, passo.valor_seletor)) {
              achou = true;
            } else {
              await new Promise(res => setTimeout(res, 1000));
            }
          }
        }
      }
    }
    qtdeExecutado++;
  }

  if (refreshTimer) clearTimeout(refreshTimer);

  // rotina abortada ou iterada por completo; ativo trigger do autotab se setado
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

    const elemento = encontrarElemento('css', cfg.seletor_alvo); // fallback legad
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
