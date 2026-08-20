let revolverIntervalo = null;
let abaAtualIndex = 0;
let autoRefreshTimerAtivo = false;
let janelaRevolverId = null; // crio isso pra amarrar o revolver a janela onde ele for ativado
let ignorarProximaAlteracaoPlaylist = false; // impesso o loop de storage gerado pelas minhas proprias gravacoes

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateBadge") {
    const textBadge = request.text || "";
    chrome.action.setBadgeText({ text: textBadge, tabId: sender.tab?.id });

    if (textBadge) {
      chrome.action.setBadgeBackgroundColor({ color: request.color || "#17a2b8", tabId: sender.tab?.id });
    }

    autoRefreshTimerAtivo = !!textBadge;
    if (!autoRefreshTimerAtivo) verificarReverterBadgeRevolver();
  }

  if (request.action === "obterStatusRevolver") {
    sendResponse({ rodando: revolverIntervalo !== null });
  }

  if (request.action === "openOptions") {
    chrome.runtime.openOptionsPage();
  }

  return true;
});

function atualizarBadgeRevolver(status) {
  if (autoRefreshTimerAtivo) return;

  chrome.action.setBadgeText({ text: status ? "\u27F3" : "OFF" });
  chrome.action.setBadgeBackgroundColor({ color: status ? "#28a745" : "#6c757d" });
}

function verificarReverterBadgeRevolver() {
  chrome.storage.local.get(['revolverAtivo'], (data) => atualizarBadgeRevolver(!!data.revolverAtivo));
}

function pararRotacaoAbas() {
  if (revolverIntervalo) {
    clearTimeout(revolverIntervalo);
    revolverIntervalo = null;
  }
  atualizarBadgeRevolver(false);
}

function validarMatchUrl(urlAba, urlCadastrada) {
  if (!urlCadastrada) return false;
  if (urlCadastrada.includes('*')) {
    const stringRegex = '^' + urlCadastrada.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(stringRegex).test(urlAba);
  }

  // mesma normalizacao do autoclicker para bater com exatidao URLs estritas
  const normalize = (u) => {
    try {
      const obj = new URL(u.includes('http') ? u : 'https://' + u);
      return obj.hostname.replace(/^www\./, '') + obj.pathname.replace(/\/$/, '') + obj.search;
    } catch (e) {
      return u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    }
  };
  return normalize(urlAba) === normalize(urlCadastrada);
}

function iniciarRotacaoAbas() {
  pararRotacaoAbas();

  chrome.storage.local.get(['revolverAtivo', 'playlistIdAtiva', 'playlists', 'perfis'], (data) => {
    if (!data.revolverAtivo || !data.playlistIdAtiva) return pararRotacaoAbas();

    const playlistAtual = (data.playlists || []).find(p => p.id === data.playlistIdAtiva);
    if (!playlistAtual || !playlistAtual.itens) return pararRotacaoAbas();

    // travando processamento caso a validacao de dias e horas do perfil ativo falhe
    if (playlistAtual.perfil_id) {
      const perfil = (data.perfis || []).find(p => p.id === playlistAtual.perfil_id);
      if (perfil) {
        const hoje = new Date();
        const diaAtual = hoje.getDay();
        const horaStr = hoje.getHours().toString().padStart(2, '0') + ':' + hoje.getMinutes().toString().padStart(2, '0');

        const diaValido = !perfil.dias_semana || perfil.dias_semana.length === 0 || perfil.dias_semana.includes(diaAtual);
        const horaValida = !perfil.horario?.inicio || !perfil.horario?.fim || (horaStr >= perfil.horario.inicio && horaStr <= perfil.horario.fim);

        if (!diaValido || !horaValida) {
          console.log('Tatico Revolver: Standby aguardando janela de horários do perfil vinculado.');
          revolverIntervalo = setTimeout(iniciarRotacaoAbas, 60000);
          atualizarBadgeRevolver(false);
          return;
        }
      }
    }

    const itensAtivos = playlistAtual.itens.filter(item => item.ativo);
    if (itensAtivos.length === 0) return pararRotacaoAbas();

    if (abaAtualIndex >= itensAtivos.length) abaAtualIndex = 0;

    const itemAtual = itensAtivos[abaAtualIndex];
    const tempoMs = ((itemAtual.minutos || 0) * 60 + (itemAtual.segundos || 10)) * 1000;

    chrome.storage.local.set({
      revolverTargetTime: Date.now() + tempoMs,
      revolverCurrentIdx: abaAtualIndex + 1,
      revolverTotalItems: itensAtivos.length
    });

    atualizarBadgeRevolver(true);

    const opcoesBusca = janelaRevolverId ? { windowId: janelaRevolverId } : { currentWindow: true };

    chrome.tabs.query(opcoesBusca, (tabs) => {
      // reseto e tento global se a janela atrelada deixar de existir/fechar sem querer
      if (!tabs || tabs.length === 0) {
        janelaRevolverId = null;
        iniciarRotacaoAbas();
        return;
      }

      if (!janelaRevolverId && tabs.length > 0) {
        janelaRevolverId = tabs[0].windowId;
      }

      const abaAlvo = tabs.find(t => t.url && validarMatchUrl(t.url, itemAtual.url));
      let ocorreuAlteracaoNoEstado = false;

      if (abaAlvo) {
        chrome.tabs.update(abaAlvo.id, { active: true });

        // checo tabs crashadas ou no limite de memoria pra forcar o reload
        if (abaAlvo.discarded || abaAlvo.status === 'unloaded') {
          console.log('Tatico Revolver: Guia descartada por limite de memoria. Recarregando.');
          chrome.tabs.reload(abaAlvo.id, { bypassCache: true });
        }

        if (!itemAtual.aberto) {
          itemAtual.aberto = true;
          ocorreuAlteracaoNoEstado = true;
        }
      } else if (itemAtual.url) {
        chrome.tabs.create({ url: itemAtual.url.replace(/\*/g, ''), active: true, windowId: janelaRevolverId });
        itemAtual.aberto = true;
        ocorreuAlteracaoNoEstado = true;
      }

      if (ocorreuAlteracaoNoEstado) {
        ignorarProximaAlteracaoPlaylist = true;
        chrome.storage.local.set({ playlists: data.playlists });
      }

      abaAtualIndex = (abaAtualIndex + 1) % itensAtivos.length;
      revolverIntervalo = setTimeout(iniciarRotacaoAbas, tempoMs);
    });
  });
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.revolverAtivo) {
      chrome.storage.local.get(['revolverAtivo'], (data) => {
        if (data.revolverAtivo) {
          abaAtualIndex = 0;
          // amarrando a janela atual quando ativado
          chrome.windows.getLastFocused({ populate: false }, (win) => {
            janelaRevolverId = win ? win.id : null;
            iniciarRotacaoAbas();
          });
        } else {
          janelaRevolverId = null;
          pararRotacaoAbas();
        }
      });
    } else if (changes.playlistIdAtiva) {
      abaAtualIndex = 0;
      iniciarRotacaoAbas();
    } else if (changes.playlists) {
      // ignoro meu proprio update do estado 'aberta' pra nao resetar a roleta atoa
      if (ignorarProximaAlteracaoPlaylist) {
        ignorarProximaAlteracaoPlaylist = false;
        return;
      }
      chrome.storage.local.get(['revolverAtivo'], (data) => {
        if (data.revolverAtivo) iniciarRotacaoAbas();
      });
    }
  }
});

chrome.storage.session.get(['sessaoIniciada'], (sessionData) => {
  if (sessionData.sessaoIniciada) return retomarLoopsAdormecidos();

  chrome.storage.session.set({ sessaoIniciada: true });

  chrome.storage.local.get(['autoStartEnabled', 'autoStartResume', 'autoStartModules'], (config) => {
    if (!config.autoStartEnabled) {
      return chrome.storage.local.set({ revolverAtivo: false, autoClickerPaused: true, autoRefreshPaused: true });
    }

    if (!config.autoStartResume) {
      const modulos = config.autoStartModules || { clicker: false, refresh: false, revolver: false };
      chrome.storage.local.set({
        revolverAtivo: modulos.revolver,
        autoClickerPaused: !modulos.clicker,
        autoRefreshPaused: !modulos.refresh
      }, retomarLoopsAdormecidos);
    } else {
      retomarLoopsAdormecidos();
    }
  });
});

function retomarLoopsAdormecidos() {
  chrome.storage.local.get(['revolverAtivo'], (data) => {
    if (data.revolverAtivo) iniciarRotacaoAbas();
  });
}
