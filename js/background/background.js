let revolverIntervalo = null;
let abaAtualIndex = 0;
let autoRefreshTimerAtivo = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateBadge") {
    const textBadge = request.text || "";
    chrome.action.setBadgeText({
      text: textBadge,
      tabId: sender.tab ? sender.tab.id : undefined
    });

    if (textBadge) {
      chrome.action.setBadgeBackgroundColor({
        color: request.color || "#17a2b8",
        tabId: sender.tab ? sender.tab.id : undefined
      });
    }

    // marco se o timer assumiu o controle nesta sessao
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
  if (autoRefreshTimerAtivo) return; // delego prioridade ao timer

  if (status) {
    chrome.action.setBadgeText({ text: "\u27F3" });
    chrome.action.setBadgeBackgroundColor({ color: "#28a745" });
  } else {
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#6c757d" });
  }
}

function verificarReverterBadgeRevolver() {
  chrome.storage.local.get(['revolverAtivo'], (data) => {
    atualizarBadgeRevolver(!!data.revolverAtivo);
  });
}

function pararRotacaoAbas() {
  if (revolverIntervalo) {
    clearTimeout(revolverIntervalo);
    revolverIntervalo = null;
  }
  atualizarBadgeRevolver(false);
}

// checo se a url possui o curinga para regex ou sigo com match normal
function validarMatchUrl(urlAba, urlCadastrada) {
  if (!urlCadastrada) return false;
  if (urlCadastrada.includes('*')) {
    const stringRegex = '^' + urlCadastrada.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    const regex = new RegExp(stringRegex);
    return regex.test(urlAba);
  }
  return urlAba.includes(urlCadastrada);
}

function iniciarRotacaoAbas() {
  pararRotacaoAbas();

  chrome.storage.local.get(['revolverAtivo', 'playlistIdAtiva', 'playlists'], (data) => {
    if (!data.revolverAtivo || !data.playlistIdAtiva) {
      pararRotacaoAbas();
      return;
    }

    const playlists = data.playlists || [];
    const playlistAtual = playlists.find(p => p.id === data.playlistIdAtiva);

    if (!playlistAtual || !playlistAtual.itens) {
      pararRotacaoAbas();
      return;
    }

    const itensAtivos = playlistAtual.itens.filter(item => item.ativo);

    if (itensAtivos.length === 0) {
      pararRotacaoAbas();
      return;
    }

    if (abaAtualIndex >= itensAtivos.length) abaAtualIndex = 0;

    const itemAtual = itensAtivos[abaAtualIndex];
    const tempoMs = ((itemAtual.minutos || 0) * 60 + (itemAtual.segundos || 10)) * 1000;
    const targetTime = Date.now() + tempoMs;

    chrome.storage.local.set({
      revolverTargetTime: targetTime,
      revolverCurrentIdx: abaAtualIndex + 1,
      revolverTotalItems: itensAtivos.length
    });

    atualizarBadgeRevolver(true);

    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const abaAlvo = tabs.find(t => t.url && validarMatchUrl(t.url, itemAtual.url));
      let ocorreuAlteracaoNoEstado = false;

      if (abaAlvo) {
        chrome.tabs.update(abaAlvo.id, { active: true });

        // atualizo o item como aberto caso a extensao o tenha encontrado ativo
        if (!itemAtual.aberto) {
          itemAtual.aberto = true;
          ocorreuAlteracaoNoEstado = true;
        }
      } else if (itemAtual.url) {
        // se nao achou a aba mas ela ja foi aberta antes, ignoro a criacao novamente para continuar a rotina
        if (!itemAtual.aberto) {
          // limpo o asterisco para tentar abrir ao menos o fallback da base url
          const urlLimpaParaAbertura = itemAtual.url.replace(/\*/g, '');
          chrome.tabs.create({ url: urlLimpaParaAbertura, active: true });
          itemAtual.aberto = true;
          ocorreuAlteracaoNoEstado = true;
        }
      }

      // salvo o status do objeto atualizado de volta no storage pra refletir em todas as interfaces
      if (ocorreuAlteracaoNoEstado) {
        chrome.storage.local.set({ playlists: playlists });
      }

      abaAtualIndex = (abaAtualIndex + 1) % itensAtivos.length;
      revolverIntervalo = setTimeout(iniciarRotacaoAbas, tempoMs);
    });
  });
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.revolverAtivo || changes.playlistIdAtiva || changes.playlists) {
      chrome.storage.local.get(['revolverAtivo'], (data) => {
        if (data.revolverAtivo) {
          abaAtualIndex = 0;
          iniciarRotacaoAbas();
        } else {
          pararRotacaoAbas();
        }
      });
    }
  }
});

// logica de inicializacao de sessao para evitar auto-start fantasma
chrome.storage.session.get(['sessaoIniciada'], (sessionData) => {
  if (!sessionData.sessaoIniciada) {
    chrome.storage.session.set({ sessaoIniciada: true });

    chrome.storage.local.get(['autoStartEnabled', 'autoStartResume', 'autoStartModules'], (config) => {
      const autoStart = config.autoStartEnabled || false;
      const resume = config.autoStartResume || false;
      const modulos = config.autoStartModules || { clicker: false, refresh: false, revolver: false };

      if (!autoStart) {
        chrome.storage.local.set({
          revolverAtivo: false,
          autoClickerPaused: true,
          autoRefreshPaused: true
        });
      } else {
        if (!resume) {
          chrome.storage.local.set({
            revolverAtivo: modulos.revolver,
            autoClickerPaused: !modulos.clicker,
            autoRefreshPaused: !modulos.refresh
          }, () => retomarLoopsAdormecidos());
        } else {
          retomarLoopsAdormecidos();
        }
      }
    });
  } else {
    retomarLoopsAdormecidos();
  }
});

function retomarLoopsAdormecidos() {
  chrome.storage.local.get(['revolverAtivo'], (data) => {
    if (data.revolverAtivo) iniciarRotacaoAbas();
  });
}
