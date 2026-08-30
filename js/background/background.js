// isolando variaveis de execucao por janela (windowId)
let revolverIntervalos = {};
let abasAtuaisIndex = {};
let ignorarProximaAlteracaoPlaylist = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "pararTudo") {
    for (let wId in revolverIntervalos) pararRotacaoAbas(wId);
    chrome.storage.local.set({ windowStates: {} }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  // respondendo dados do contexto atual para os content scripts
  if (request.action === "getTabContext") {
    sendResponse({ windowId: sender.tab?.windowId, tabId: sender.tab?.id });
    return true;
  }

  if (request.action === "updateBadge") {
    const textBadge = request.text || "";
    chrome.action.setBadgeText({ text: textBadge, tabId: sender.tab?.id });
    if (textBadge) {
      chrome.action.setBadgeBackgroundColor({ color: request.color || "#17a2b8", tabId: sender.tab?.id });
    }
  }

  if (request.action === "openOptions") {
    chrome.runtime.openOptionsPage();
  }

  return true;
});

// atualiza visualmente a extensao de acordo com o estado do revolver da janela atual
function atualizarBadgeRevolver(windowId, status) {
  chrome.tabs.query({ windowId, active: true }, (tabs) => {
    if (tabs[0]) {
      chrome.action.setBadgeText({ text: status ? "\u27F3" : "OFF", tabId: tabs[0].id });
      chrome.action.setBadgeBackgroundColor({ color: status ? "#28a745" : "#6c757d", tabId: tabs[0].id });
    }
  });
}

function pararRotacaoAbas(windowId) {
  if (revolverIntervalos[windowId]) {
    clearTimeout(revolverIntervalos[windowId]);
    delete revolverIntervalos[windowId];
  }
  atualizarBadgeRevolver(windowId, false);
}

function validarMatchUrl(urlAba, urlCadastrada) {
  if (!urlCadastrada) return false;
  if (urlCadastrada.includes('*')) {
    const stringRegex = '^' + urlCadastrada.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(stringRegex).test(urlAba);
  }

  const normalize = (u) => {
    try {
      const obj = new URL(u.includes('http') ? u : 'https://' + u);
      return obj.hostname.replace(/^www\./, '') + obj.pathname.replace(/\/$/, '');
    } catch (e) {
      return u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').split('?')[0];
    }
  };
  return normalize(urlAba) === normalize(urlCadastrada);
}

function iniciarRotacaoAbas(windowId) {
  pararRotacaoAbas(windowId);

  chrome.storage.local.get(['windowStates', 'playlists', 'perfis'], (data) => {
    const wState = (data.windowStates || {})[windowId];
    if (!wState || !wState.revolverAtivo || !wState.playlistIdAtiva) return pararRotacaoAbas(windowId);

    const playlistAtual = (data.playlists || []).find(p => p.id === wState.playlistIdAtiva);
    if (!playlistAtual || !playlistAtual.itens) return pararRotacaoAbas(windowId);

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
          console.log(`Tatico Revolver (Win ${windowId}): Standby aguardando janela de horários do perfil vinculado.`);
          revolverIntervalos[windowId] = setTimeout(() => iniciarRotacaoAbas(windowId), 60000);
          atualizarBadgeRevolver(windowId, false);
          return;
        }
      }
    }

    const itensAtivos = playlistAtual.itens.filter(item => item.ativo);
    if (itensAtivos.length === 0) return pararRotacaoAbas(windowId);

    if (abasAtuaisIndex[windowId] === undefined || abasAtuaisIndex[windowId] >= itensAtivos.length) {
      abasAtuaisIndex[windowId] = 0;
    }

    const itemAtual = itensAtivos[abasAtuaisIndex[windowId]];
    const tempoMs = ((itemAtual.minutos || 0) * 60 + (itemAtual.segundos || 10)) * 1000;

    wState.revolverTargetTime = Date.now() + tempoMs;
    wState.revolverCurrentIdx = abasAtuaisIndex[windowId] + 1;
    wState.revolverTotalItems = itensAtivos.length;

    chrome.storage.local.set({ windowStates: { ...data.windowStates, [windowId]: wState } });
    atualizarBadgeRevolver(windowId, true);

    chrome.tabs.query({ windowId: parseInt(windowId) }, (tabs) => {
      // resetando se a janela atrelada deixar de existir/fechar sem querer
      if (!tabs || tabs.length === 0) {
        pararRotacaoAbas(windowId);
        return;
      }

      const abaAlvo = tabs.find(t => t.url && validarMatchUrl(t.url, itemAtual.url));
      let ocorreuAlteracaoNoEstado = false;

      if (abaAlvo) {
        chrome.tabs.update(abaAlvo.id, { active: true });

        // checando saude da tab para forcar o reload em tabs suspensas
        if (abaAlvo.discarded || abaAlvo.status === 'unloaded') {
          console.log(`Tatico Revolver (Win ${windowId}): Guia descartada por limite de memoria. Recarregando.`);
          chrome.tabs.reload(abaAlvo.id, { bypassCache: true });
        }

        if (!itemAtual.aberto) {
          itemAtual.aberto = true;
          ocorreuAlteracaoNoEstado = true;
        }
      } else if (itemAtual.url) {
        chrome.tabs.create({ url: itemAtual.url.replace(/\*/g, ''), active: true, windowId: parseInt(windowId) });
        itemAtual.aberto = true;
        ocorreuAlteracaoNoEstado = true;
      }

      if (ocorreuAlteracaoNoEstado) {
        ignorarProximaAlteracaoPlaylist = true;
        chrome.storage.local.set({ playlists: data.playlists });
      }

      abasAtuaisIndex[windowId] = (abasAtuaisIndex[windowId] + 1) % itensAtivos.length;
      revolverIntervalos[windowId] = setTimeout(() => iniciarRotacaoAbas(windowId), tempoMs);
    });
  });
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.windowStates) {
      const oldStates = changes.windowStates.oldValue || {};
      const newStates = changes.windowStates.newValue || {};

      // iterando os estados de cada janela pra detectar ativacoes do revolver
      for (const winId in newStates) {
        const isNowActive = newStates[winId]?.revolverAtivo;
        const wasActive = oldStates[winId]?.revolverAtivo;
        const newPlaylistId = newStates[winId]?.playlistIdAtiva;
        const oldPlaylistId = oldStates[winId]?.playlistIdAtiva;

        if (isNowActive && (!wasActive || newPlaylistId !== oldPlaylistId)) {
          if (!wasActive) abasAtuaisIndex[winId] = 0;
          iniciarRotacaoAbas(parseInt(winId));
        } else if (!isNowActive && wasActive) {
          pararRotacaoAbas(parseInt(winId));
        }
      }
    } else if (changes.playlists) {
      if (ignorarProximaAlteracaoPlaylist) {
        ignorarProximaAlteracaoPlaylist = false;
        return;
      }
      chrome.storage.local.get(['windowStates'], (data) => {
        const wStates = data.windowStates || {};
        for (const winId in wStates) {
          if (wStates[winId].revolverAtivo) iniciarRotacaoAbas(parseInt(winId));
        }
      });
    }
  }
});

chrome.storage.session.get(['sessaoIniciada'], (sessionData) => {
  if (sessionData.sessaoIniciada) return retomarLoopsAdormecidos();

  chrome.storage.session.set({ sessaoIniciada: true });

  chrome.storage.local.get(['autoStartEnabled', 'autoStartResume', 'autoStartModules', 'windowStates'], (config) => {
    let wStates = config.windowStates || {};

    chrome.windows.getAll({}, (windows) => {
      windows.forEach(win => {
        if (!wStates[win.id]) wStates[win.id] = {};

        if (!config.autoStartEnabled) {
          wStates[win.id].revolverAtivo = false;
          wStates[win.id].autoClickerPaused = true;
          wStates[win.id].autoRefreshPaused = true;
          wStates[win.id].autoScrollPaused = true;
        } else if (!config.autoStartResume) {
          const modulos = config.autoStartModules || { clicker: false, refresh: false, revolver: false, scroll: false };
          wStates[win.id].revolverAtivo = modulos.revolver;
          wStates[win.id].autoClickerPaused = !modulos.clicker;
          wStates[win.id].autoRefreshPaused = !modulos.refresh;
          wStates[win.id].autoScrollPaused = !modulos.scroll;
        }
      });
      chrome.storage.local.set({ windowStates: wStates }, retomarLoopsAdormecidos);
    });
  });
});

function retomarLoopsAdormecidos() {
  chrome.storage.local.get(['windowStates'], (data) => {
    const wStates = data.windowStates || {};
    for (const winId in wStates) {
      if (wStates[winId].revolverAtivo) iniciarRotacaoAbas(parseInt(winId));
    }
  });
}

let creatingOffscreen = null;

async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('js/offscreen/recorder-core.html');
  const existingContexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existingContexts.length > 0) return;

  if (creatingOffscreen) await creatingOffscreen;
  else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: ['USER_MEDIA'],
      justification: 'Gravação de tela requisitada pelo usuário'
    });
    await creatingOffscreen;
    creatingOffscreen = null;
  }
}

let isRecordingGlobal = false;
let globalRecordingConfig = null;
let recordingTabId = null;
let dedicatedRecorderTabId = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'prepare_recording') {
    (async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      recordingTabId = activeTab?.id;

      if (recordingTabId && activeTab.url && !activeTab.url.startsWith('chrome://') && !activeTab.url.startsWith('edge://') && !activeTab.url.startsWith('about:')) {
        try {
          await chrome.scripting.executeScript({ target: { tabId: recordingTabId }, files: ['js/content/recorderToolbar.js'] });
          await chrome.scripting.executeScript({ target: { tabId: recordingTabId }, files: ['js/content/recorderOverlay.js'] });
          chrome.tabs.sendMessage(recordingTabId, { action: 'init_overlay', config: msg.config });
        } catch (err) {
          console.warn("Não foi possível injetar a UI na aba atual:", err);
        }
      }
      sendResponse({ status: 'prepared' });
    })();
    return true;
  }

  // Abre a página dedicada, fixa ela no navegador, e passa o foco temporariamente para extrair o popup nativo
  if (msg.action === 'open_dedicated_recorder') {
    isRecordingGlobal = true;
    globalRecordingConfig = msg.config;
    chrome.storage.session.set({ recordingConfig: msg.config }, () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('js/offscreen/recorder-core.html'), pinned: true, active: true }, (tab) => {
        dedicatedRecorderTabId = tab.id;
        sendResponse({ status: 'opening' });
      });
    });
    return true;
  }

  // Roteia os comandos de controle para a página dedicada
  if (['stop_recording', 'pause_recording', 'resume_recording', 'toggle_mic', 'start_recording_now'].includes(msg.action)) {
    if (msg.action === 'stop_recording') isRecordingGlobal = false;

    if (dedicatedRecorderTabId) {
      chrome.tabs.sendMessage(dedicatedRecorderTabId, msg).catch(() => { });
    }

    if (msg.action === 'stop_recording' && recordingTabId) {
      chrome.tabs.sendMessage(recordingTabId, { action: 'remove_overlays' }).catch(() => { });
    }
    sendResponse({ status: 'forwarded' });
    return true;
  }

  // Quando as permissões são aceitas, devolve o foco para a aba do usuário imediatamente e inicia o overlay UI 3-2-1
  if (msg.action === 'recording_ready') {
    if (recordingTabId) {
      chrome.tabs.update(recordingTabId, { active: true }, () => {
        chrome.tabs.sendMessage(recordingTabId, { action: 'recording_ready_ui' }).catch(() => { });
      });
    }
  }

  if (msg.action === 'recording_cancelled') {
    isRecordingGlobal = false;
    if (recordingTabId) {
      chrome.tabs.update(recordingTabId, { active: true }, () => {
        chrome.tabs.sendMessage(recordingTabId, { action: 'recording_cancelled_ui' }).catch(() => { });
      });
    }
  }

  if (msg.action === 'finalize_recording') {
    isRecordingGlobal = false;
    if (recordingTabId) {
      chrome.tabs.sendMessage(recordingTabId, { action: 'remove_overlays' }).catch(() => { });
    }
    chrome.tabs.create({ url: chrome.runtime.getURL('js/content/recorder/editor.html') });
  }
});

function injetarUiGravacaoGlobal(tabId, tabUrl) {
  if (!isRecordingGlobal || !tabUrl || tabUrl.startsWith('chrome://') || tabUrl.startsWith('edge://') || tabUrl.startsWith('about:')) return;

  chrome.scripting.executeScript({ target: { tabId }, files: ['js/content/recorderToolbar.js', 'js/content/recorderOverlay.js'] })
    .then(() => {
      chrome.tabs.sendMessage(tabId, { action: 'init_overlay', config: globalRecordingConfig, state: 'recording' });
    }).catch(err => console.warn("Injeção de gravação ignorada na aba alvo.", err));
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') injetarUiGravacaoGlobal(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    injetarUiGravacaoGlobal(tab.id, tab.url);
  } catch (e) { }
});
