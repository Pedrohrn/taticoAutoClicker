let revolverIntervalo = null;
let abaAtualIndex = 0;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateBadge") {
    chrome.action.setBadgeText({
      text: request.text,
      tabId: sender.tab.id
    });

    chrome.action.setBadgeBackgroundColor({
      color: "#d11c1c",
      tabId: sender.tab.id
    });
  }

  if (request.action === "obterStatusRevolver") {
    sendResponse({ rodando: revolverIntervalo !== null });
  }

  return true;
});

function pararRotacaoAbas() {
  if (revolverIntervalo) {
    clearTimeout(revolverIntervalo);
    revolverIntervalo = null;
  }
  chrome.action.setBadgeText({ text: "OFF" });
  chrome.action.setBadgeBackgroundColor({ color: "#6c757d" });
}

function iniciarRotacaoAbas() {
  pararRotacaoAbas();

  chrome.storage.local.get(['revolverAtivo', 'playlistIdAtiva', 'playlists'], (data) => {
    // verifico se o revolver esta globalmente ativo e se ha uma playlist amarrada a ele
    if (!data.revolverAtivo || !data.playlistIdAtiva) {
      pararRotacaoAbas();
      return;
    }

    const playlists = data.playlists || [];
    const playlistAtual = playlists.find(p => p.id === data.playlistIdAtiva);

    // previno falhas caso a playlist selecionada nao exista ou nao possua a chave itens
    if (!playlistAtual || !playlistAtual.itens) {
      pararRotacaoAbas();
      return;
    }

    const itensAtivos = playlistAtual.itens.filter(item => item.ativo);

    if (itensAtivos.length === 0) {
      pararRotacaoAbas();
      return;
    }

    if (abaAtualIndex >= itensAtivos.length) {
      abaAtualIndex = 0;
    }

    const itemAtual = itensAtivos[abaAtualIndex];
    const tempoMs = ((itemAtual.minutos || 0) * 60 + (itemAtual.segundos || 10)) * 1000;

    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#28a745" });

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

// associo o listener do storage para reagir a play/stop via options.js ou popup
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // verifico se houve alteracao no status global, no id ativo ou no array de dados
    if (changes.revolverAtivo || changes.playlistIdAtiva || changes.playlists) {
      chrome.storage.local.get(['revolverAtivo'], (data) => {
        if (data.revolverAtivo) {
          // zero o indice para evitar saltos inconsistentes de troca ao vivo
          abaAtualIndex = 0;
          iniciarRotacaoAbas();
        } else {
          pararRotacaoAbas();
        }
      });
    }
  }
});

// forco inicializacao no boot caso tenha sido persistido estado anterior rodando
chrome.storage.local.get(['revolverAtivo'], (data) => {
  if (data.revolverAtivo) {
    iniciarRotacaoAbas();
  }
});
