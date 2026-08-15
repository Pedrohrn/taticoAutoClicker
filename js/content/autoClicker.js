// mantenho apenas a logica de interacao com o dom e execucao de rotinas

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

async function resolverPausaAc() {
  while (window.taticoUI && window.taticoUI.estado.autoClickerPaused) {
    await new Promise(r => setTimeout(r, 1000));
  }
}

async function executarRotinaAvancada(rotina) {
  console.log(`Iniciando Fila Avancada: ${rotina.nome}`);

  let abortar = false;
  let qtdeExecutado = 0;
  let refreshTimer = null;

  if (rotina.autorefresh && (rotina.autorefresh_min > 0 || rotina.autorefresh_seg > 0)) {
    const timeMs = ((rotina.autorefresh_min || 0) * 60 + (rotina.autorefresh_seg || 0)) * 1000;
    console.log(`A página será automáticamente recarregada em ${rotina.autorefresh_min}:${rotina.autorefresh_seg}`);

    let counterMs = timeMs;

    // isolo a rotina em intervalo para que ele consiga ser evitado pelo estado unificado autoRefreshPaused
    refreshTimer = setInterval(() => {
      if (counterMs > 0 && !window.taticoUI.estado.autoRefreshPaused) {
        counterMs -= 5000;

        if (counterMs <= 0) {
          clearInterval(refreshTimer);
          location.reload();
          return;
        }

        const mm = Math.floor(counterMs / 60000);
        const ss = Math.floor((counterMs % 60000) / 1000);
        const txt = `${mm}:${ss.toString().padStart(2, '0')}`;

        if (window.taticoUI) window.taticoUI.atualizarTimerUI(txt);
        chrome.runtime.sendMessage({ action: "updateBadge", text: txt });
      }
    }, 5000);
  }

  while (!abortar && (rotina.loop || qtdeExecutado < (rotina.qtde_execucoes || 1))) {
    if (rotina.usa_parada && verificarParada(rotina.condicao_parada)) {
      console.log(`Fila abortada via Condicao de Parada Global: ${rotina.nome}`);
      abortar = true;
      break;
    }

    for (let index = 0; index < rotina.passos_avancados.length; index++) {
      const passo = rotina.passos_avancados[index];
      if (abortar) break;

      await resolverPausaAc();
      if (window.taticoUI) window.taticoUI.atualizarProgresso(index + 1, rotina.passos_avancados.length, 'loading');

      if (passo.delay_ms > 0) {
        await new Promise(res => setTimeout(res, passo.delay_ms));
      }

      let alvoEncontrado = false;

      if (passo.acao === 'click') {
        const limiteClicks = passo.click_qtde || 1;
        let cliquesFeitos = 0;

        const sobreporLimitePorParada = (limiteClicks === 1 && passo.parada_seletor !== '');

        while (true) {
          await resolverPausaAc();
          if (abortar) break;

          if (passo.parada_seletor && encontrarElemento(passo.parada_tipo || 'css', passo.parada_seletor)) {
            console.log(`Parada de passo atingida. Pulando para o proximo.`);
            alvoEncontrado = true;
            break;
          }

          const alvo = encontrarElemento(passo.tipo_seletor, passo.valor_seletor);

          if (!alvo) {
            if (cliquesFeitos > 0) {
              alvoEncontrado = true;
              break;
            }
            await new Promise(res => setTimeout(res, 1000));
            continue;
          }

          alvo.click();
          cliquesFeitos++;
          alvoEncontrado = true;

          if (!sobreporLimitePorParada && limiteClicks > 0 && cliquesFeitos >= limiteClicks) {
            break;
          }

          await new Promise(res => setTimeout(res, passo.click_intervalo_ms || 1000));
        }
      }
      else if (passo.acao === 'wait') {
        while (true) {
          await resolverPausaAc();
          if (abortar) break;
          if (encontrarElemento(passo.tipo_seletor, passo.valor_seletor)) {
            alvoEncontrado = true;
            break;
          }
          await new Promise(res => setTimeout(res, 1000));
        }
      }

      if (alvoEncontrado) {
        if (window.taticoUI) window.taticoUI.atualizarProgresso(index + 1, rotina.passos_avancados.length, 'done');
      } else {
        if (window.taticoUI) window.taticoUI.atualizarProgresso(index + 1, rotina.passos_avancados.length, 'error');
      }
    }
    qtdeExecutado++;
  }

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

async function iniciarFilaRotinasSimples(rotina) {
  const cfg = rotina.config_simples;

  if (window.taticoUI) window.taticoUI.atualizarProgresso(1, 1, 'loading');

  const intervalo = setInterval(async () => {
    await resolverPausaAc();

    if (rotina.usa_parada && verificarParada(rotina.condicao_parada)) {
      console.log(`Fila simples abortada via Condicao de Parada: ${rotina.nome}`);
      clearInterval(intervalo);
      if (window.taticoUI) window.taticoUI.atualizarProgresso(1, 1, 'done');
      return;
    }

    const elemento = encontrarElemento('css', cfg.seletor_alvo);
    if (elemento) {
      elemento.click();
      if (window.taticoUI) window.taticoUI.atualizarProgresso(1, 1, 'done');
      if (!cfg.clique_continuo) clearInterval(intervalo);
    } else {
      if (window.taticoUI) window.taticoUI.atualizarProgresso(1, 1, 'loading');
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

    if (rotinasDoPerfil.length > 0) {
      if (window.taticoUI) window.taticoUI.inicializar(rotinasDoPerfil[0].nome);

      rotinasDoPerfil.forEach(rotina => {
        if (rotina.tipo === 'simples') iniciarFilaRotinasSimples(rotina);
        else executarRotinaAvancada(rotina);
      });
    }
  });
});
