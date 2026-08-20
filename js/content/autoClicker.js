function matchComCoringa(urlAba, padrao) {
  if (!padrao) return false;
  if (padrao.includes('*')) {
    const regexStr = '^' + padrao.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(regexStr).test(urlAba);
  }

  const normalize = (u) => {
    try {
      const obj = new URL(u.includes('http') ? u : 'https://' + u);
      return obj.hostname.replace(/^www\./, '') + obj.pathname.replace(/\/$/, '') + obj.search;
    } catch (e) {
      return u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    }
  };
  return normalize(urlAba) === normalize(padrao);
}

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

function iniciarAutoRefreshGlobally(min, seg) {
  const timeMs = (min * 60 + seg) * 1000;
  if (timeMs <= 0) return;

  console.log(`A página será automaticamente recarregada em ${min}:${seg.toString().padStart(2, '0')}`);
  let counterMs = timeMs;

  setInterval(() => {
    if (counterMs > 0 && window.taticoUI && !window.taticoUI.estado.autoRefreshPaused) {
      counterMs -= 5000;

      if (counterMs <= 0) {
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

async function executarRotinaAvancada(rotina) {
  console.log(`Iniciando Fila Avancada: ${rotina.nome}`);

  let abortar = false;
  let qtdeExecutado = 0;

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

          if (!sobreporLimitePorParada && limiteClicks > 0 && cliquesFeitos >= limiteClicks) break;
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
  chrome.storage.local.get(['perfis', 'rotinas', 'playlists', 'revolverAtivo', 'playlistIdAtiva'], (data) => {
    const perfis = data.perfis || [];
    const rotinas = data.rotinas || [];
    const playlists = data.playlists || [];

    const urlAtual = location.href;
    const hojeDate = new Date();
    const diaAtual = hojeDate.getDay();
    const horaAtualStr = hojeDate.getHours().toString().padStart(2, '0') + ':' + hojeDate.getMinutes().toString().padStart(2, '0');

    let perfilAtivo = perfis.find(p => {
      const matchDia = !p.dias_semana || p.dias_semana.length === 0 || p.dias_semana.includes(diaAtual);

      let matchHora = true;
      if (p.horario && p.horario.inicio && p.horario.fim) {
        matchHora = (horaAtualStr >= p.horario.inicio && horaAtualStr <= p.horario.fim);
      }

      const urlsAlvo = p.urls_alvo || [];
      const matchUrl = urlsAlvo.length === 0 || urlsAlvo.some(url => matchComCoringa(urlAtual, url));

      const urlsExclusao = p.urls_exclusao || [];
      const isExcluido = urlsExclusao.length > 0 && urlsExclusao.some(url => matchComCoringa(urlAtual, url));

      return matchDia && matchHora && matchUrl && !isExcluido;
    });

    let revolverItem = null;
    if (data.revolverAtivo && data.playlistIdAtiva) {
      const pl = playlists.find(x => x.id === data.playlistIdAtiva);
      if (pl) {
        revolverItem = pl.itens.find(i => matchComCoringa(urlAtual, i.url));
        if (revolverItem && !perfilAtivo) {
          perfilAtivo = perfis.find(p => p.id === pl.perfil_id);
        }
      }
    }

    if (!perfilAtivo) {
      console.log('Tatico AutoClicker: Contexto atual nao atende a nenhum perfil.');
      return;
    }

    const rotinasDoPerfil = rotinas.filter(r => r.perfil_id === perfilAtivo.id && r.ativa);

    const exibirSb = perfilAtivo.exibir_statusbar !== false;
    const rotinaNome = rotinasDoPerfil.length > 0 ? rotinasDoPerfil[0].nome : (revolverItem ? 'Revolver' : 'Perfil Ativo');

    if (window.taticoUI) window.taticoUI.inicializar(rotinaNome, exibirSb);

    let refMin = 0;
    let refSeg = 0;

    // respeitando a arvore hierarquica de heranca de refresh exigida nos requisitos (Item -> Rotina -> Perfil)
    if (revolverItem && (revolverItem.refresh_min > 0 || revolverItem.refresh_seg > 0)) {
      refMin = revolverItem.refresh_min;
      refSeg = revolverItem.refresh_seg;
    } else if (rotinasDoPerfil.length > 0 && rotinasDoPerfil[0].autorefresh) {
      refMin = rotinasDoPerfil[0].autorefresh_min || 0;
      refSeg = rotinasDoPerfil[0].autorefresh_seg || 0;
    } else if (perfilAtivo.autorefresh_min > 0 || perfilAtivo.autorefresh_seg > 0) {
      refMin = perfilAtivo.autorefresh_min || 0;
      refSeg = perfilAtivo.autorefresh_seg || 0;
    }

    if (refMin > 0 || refSeg > 0) iniciarAutoRefreshGlobally(refMin, refSeg);

    if (rotinasDoPerfil.length > 0) {
      rotinasDoPerfil.forEach(rotina => {
        if (rotina.tipo === 'simples') iniciarFilaRotinasSimples(rotina);
        else executarRotinaAvancada(rotina);
      });
    }
  });
});
