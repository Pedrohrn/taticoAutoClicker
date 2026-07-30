let revolverIntervalo = null;
let abaAtualIndex = 0;

// inicializo ouvintes de mensagens enviadas pelos scripts de conteudo e popup
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

  if (request.action === "iniciarRevolver") {
    iniciarRotacaoAbas();
    sendResponse({ status: "executando" });
  }

  if (request.action === "pararRevolver") {
    pararRotacaoAbas();
    sendResponse({ status: "parado" });
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

  chrome.storage.local.get(['revolverAtivo', 'playlists'], (data) => {
    if (!data.revolverAtivo) return;

    const playlists = data.playlists || [];
    const itensAtivos = playlists.filter(item => item.ativo);

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

    // busco todas as abas da janela atual para navegar
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

// monitoro alteracao do storage para ligar ou desligar dinamicamente o revolver
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.revolverAtivo) {
    if (changes.revolverAtivo.newValue) {
      iniciarRotacaoAbas();
    } else {
      pararRotacaoAbas();
    }
  }
});
