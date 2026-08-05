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

    atualizarBadgeRevolver(true);

    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const abaAlvo = tabs.find(t => t.url && t.url.includes(itemAtual.url));

      if (abaAlvo) {
        chrome.tabs.update(abaAlvo.id, { active: true });
      } else if (itemAtual.url) {
        chrome.tabs.create({ url: itemAtual.url, active: true });
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

chrome.storage.local.get(['revolverAtivo'], (data) => {
  if (data.revolverAtivo) iniciarRotacaoAbas();
});