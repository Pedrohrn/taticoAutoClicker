export function initRevolver() {
  let playlistsSalvas = [];
  let perfisLocais = [];
  let playlistEmEdicaoId = null;

  const body = document.getElementById('listaPlaylistsBody');
  const viewLista = document.getElementById('listaPlaylistsContainer');
  const viewDetalhes = document.getElementById('detalhesPlaylistContainer');

  function carregarPlaylists() {
    chrome.storage.local.get(['playlists', 'revolverAtivo', 'playlistIdAtiva', 'perfis'], (res) => {
      playlistsSalvas = res.playlists || [];
      perfisLocais = res.perfis || [];
      renderizarLista(res.revolverAtivo, res.playlistIdAtiva);
    });
  }

  function renderizarLista(isGlobalActive, activeId) {
    body.innerHTML = '';

    let btnGlobal = document.getElementById('btnToggleRevolverGlobal');
    if (!btnGlobal) {
      const btnNova = document.getElementById('btnNovaPlaylist');
      if (btnNova) {
        btnGlobal = document.createElement('button');
        btnGlobal.id = 'btnToggleRevolverGlobal';
        btnNova.insertAdjacentElement('afterend', btnGlobal);

        // ajustei o comportamento do play/pause global pra pegar a primeira playlist se nenhuma estiver ativa
        btnGlobal.addEventListener('click', () => {
          chrome.storage.local.get(['revolverAtivo', 'playlistIdAtiva', 'playlists'], res => {
            let nextPlaylistId = res.playlistIdAtiva;
            if (!res.revolverAtivo && !nextPlaylistId && res.playlists && res.playlists.length > 0) {
              nextPlaylistId = res.playlists[0].id;
            }

            if (res.revolverAtivo) {
              chrome.storage.local.set({ revolverAtivo: false });
            } else if (nextPlaylistId) {
              chrome.storage.local.set({ revolverAtivo: true, playlistIdAtiva: nextPlaylistId });
            } else {
              alert("Crie uma playlist primeiro para rodar o Revolver.");
            }
          });
        });
      }
    }

    if (btnGlobal) {
      btnGlobal.className = `btn btn-sm ${isGlobalActive ? 'btn-danger' : 'btn-success'}`;
      btnGlobal.style.marginLeft = '10px';
      btnGlobal.textContent = isGlobalActive ? '⏸ Pausar Todos' : '▶ Iniciar Revolver';
    }

    if (playlistsSalvas.length === 0) {
      body.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Nenhuma playlist cadastrada.</td></tr>`;
      return;
    }

    playlistsSalvas.forEach(pl => {
      const isRunning = isGlobalActive && (activeId === pl.id);
      const perfilNome = perfisLocais.find(p => p.id === pl.perfil_id)?.nome || 'Sem Perfil';
      const tr = document.createElement('tr');

      tr.innerHTML = `
      <td>${pl.nome || 'Sem Nome'}</td>
      <td>${perfilNome}</td>
      <td style="color: ${isRunning ? 'var(--success)' : 'var(--text-muted)'}; font-weight: bold;">
      ${isRunning ? 'Executando' : 'Parada'}
      </td>
      <td style="text-align: center;">
      <div class="action-buttons">
      <button class="btn btn-sm btn-secondary btn-toggle-pl" data-id="${pl.id}" title="${isRunning ? 'Pausar' : 'Rodar'}">${isRunning ? '⏸' : '▶'}</button>
      <button class="btn btn-sm btn-info btn-editar-pl" data-id="${pl.id}" title="Editar">✎</button>
      <button class="btn btn-sm btn-danger btn-excluir-pl" data-id="${pl.id}" title="Excluir">🗑</button>
      </div>
      </td>
      `;
      body.appendChild(tr);
    });

    document.querySelectorAll('.btn-toggle-pl').forEach(b => b.addEventListener('click', e => {
      const id = e.target.dataset.id;
      chrome.storage.local.get(['revolverAtivo', 'playlistIdAtiva'], res => {
        chrome.storage.local.set(res.revolverAtivo && res.playlistIdAtiva === id ? { revolverAtivo: false } : { revolverAtivo: true, playlistIdAtiva: id });
      });
    }));

    document.querySelectorAll('.btn-editar-pl').forEach(b => b.addEventListener('click', e => abrirEdicao(e.target.dataset.id)));
    document.querySelectorAll('.btn-excluir-pl').forEach(b => b.addEventListener('click', e => {
      if (confirm('Excluir esta playlist?')) {
        playlistsSalvas = playlistsSalvas.filter(p => p.id !== e.target.dataset.id);
        chrome.storage.local.set({ playlists: playlistsSalvas }, carregarPlaylists);
      }
    }));
  }

  document.getElementById('btnNovaPlaylist').addEventListener('click', () => {
    const id = Date.now().toString();
    playlistsSalvas.push({ id, nome: 'Nova Playlist', perfil_id: '', itens: [] });
    chrome.storage.local.set({ playlists: playlistsSalvas }, () => abrirEdicao(id));
  });

  function abrirEdicao(id) {
    playlistEmEdicaoId = id;
    const p = playlistsSalvas.find(x => x.id === id);
    document.getElementById('inputNomePlaylist').value = p.nome;
    document.getElementById('playlistPerfilId').value = p.perfil_id || '';

    const chkSelectAll = document.getElementById('chkSelectAll');
    if (chkSelectAll) chkSelectAll.checked = false;

    viewLista.classList.add('hidden');
    viewDetalhes.classList.remove('hidden');
    renderizarItens();
  }

  document.getElementById('btnVoltarPlaylists').addEventListener('click', () => {
    sincronizarDom();
    chrome.storage.local.set({ playlists: playlistsSalvas }, () => {
      viewDetalhes.classList.add('hidden');
      viewLista.classList.remove('hidden');
      carregarPlaylists();
    });
  });

  function renderizarItens() {
    const tbody = document.getElementById('playlistItensBody');
    tbody.innerHTML = '';
    const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);
    if (!pl) return;

    if (!pl.itens || pl.itens.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">Nenhuma URL cadastrada.</td></tr>`;
      return;
    }

    pl.itens.forEach((it, idx) => {
      const isAberto = it.aberto ? '<span style="color:var(--success); font-size:0.8em; margin-left:5px;">(Aberto)</span>' : '';
      const tr = document.createElement('tr');

      tr.innerHTML = `
      <td style="text-align:center;"><input type="checkbox" class="chk-item-revolver" data-idx="${idx}"></td>
      <td>${idx + 1}</td>
      <td><input type="text" class="item-url input-no-shrink" value="${it.url}" placeholder="https://... ou wildcard *">${isAberto}</td>
      <td>
      <div class="flex-row" style="flex-wrap: nowrap;" title="Tempo de Rotação da Guia">
      <input type="number" class="item-min input-no-shrink" value="${it.minutos}" style="width:45px;">:
      <input type="number" class="item-seg input-no-shrink" value="${it.segundos}" style="width:45px;">
      </div>
      </td>
      <td>
      <div class="flex-row" style="flex-wrap: nowrap;" title="Tempo de AutoRefresh">
      <input type="number" class="item-ref-min input-no-shrink" value="${it.refresh_min || 0}" style="width:45px;">:
      <input type="number" class="item-ref-seg input-no-shrink" value="${it.refresh_seg || 0}" style="width:45px;">
      </div>
      </td>
      <td style="text-align:center;"><input type="checkbox" class="item-ativo" ${it.ativo ? 'checked' : ''}></td>
      <td style="text-align:center;"><input type="radio" name="item-principal" ${it.principal ? 'checked' : ''}></td>
      <td style="text-align:center;"><button class="btn-danger-sm btn-remover-item" data-idx="${idx}" title="Excluir">X</button></td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-remover-item').forEach(b => b.addEventListener('click', (e) => {
      sincronizarDom();
      pl.itens.splice(parseInt(e.target.dataset.idx, 10), 1);
      renderizarItens();
    }));
  }

  function sincronizarDom() {
    const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);
    if (!pl) return;

    pl.nome = document.getElementById('inputNomePlaylist').value;
    pl.perfil_id = document.getElementById('playlistPerfilId').value;

    const linhas = document.querySelectorAll('#playlistItensBody tr:not(:has(td[colspan]))');
    pl.itens = Array.from(linhas).map((tr, idx) => ({
      url: tr.querySelector('.item-url').value,
      minutos: parseInt(tr.querySelector('.item-min').value, 10) || 0,
      segundos: parseInt(tr.querySelector('.item-seg').value, 10) || 0,
      refresh_min: parseInt(tr.querySelector('.item-ref-min').value, 10) || 0,
      refresh_seg: parseInt(tr.querySelector('.item-ref-seg').value, 10) || 0,
      ativo: tr.querySelector('.item-ativo').checked,
      principal: tr.querySelector('input[name="item-principal"]').checked,
      aberto: pl.itens[idx]?.aberto || false
    }));
  }

  document.getElementById('btnCapturarJanela').addEventListener('click', () => {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      sincronizarDom();
      const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);
      tabs.forEach(tab => {
        if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
          pl.itens.push({ url: tab.url, minutos: 0, segundos: 15, refresh_min: 0, refresh_seg: 0, ativo: true, principal: false, aberto: false });
        }
      });
      renderizarItens();
    });
  });

  const chkSelectAll = document.getElementById('chkSelectAll');
  if (chkSelectAll) {
    chkSelectAll.addEventListener('change', (e) => {
      document.querySelectorAll('.chk-item-revolver').forEach(chk => chk.checked = e.target.checked);
    });
  }

  const btnMarcarTodos = document.getElementById('btnMarcarTodos');
  if (btnMarcarTodos) {
    btnMarcarTodos.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.chk-item-revolver');
      const todosMarcados = Array.from(checkboxes).every(chk => chk.checked);
      checkboxes.forEach(chk => chk.checked = !todosMarcados);
      if (chkSelectAll) chkSelectAll.checked = !todosMarcados;
    });
  }

  const btnRemoverSelecionados = document.getElementById('btnRemoverSelecionados');
  if (btnRemoverSelecionados) {
    btnRemoverSelecionados.addEventListener('click', () => {
      sincronizarDom();
      const checkboxes = document.querySelectorAll('.chk-item-revolver');
      const indicesParaRemover = Array.from(checkboxes).filter(chk => chk.checked).map((_, idx) => idx);
      const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);
      pl.itens = pl.itens.filter((_, idx) => !indicesParaRemover.includes(idx));
      if (chkSelectAll) chkSelectAll.checked = false;
      renderizarItens();
    });
  }

  document.getElementById('btnAdicionarItemRevolver').addEventListener('click', () => {
    sincronizarDom();
    const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);
    pl.itens.push({ url: '', minutos: 0, segundos: 10, refresh_min: 0, refresh_seg: 0, ativo: true, principal: pl.itens.length === 0, aberto: false });
    renderizarItens();
  });

  document.getElementById('btnSalvarRevolver').addEventListener('click', () => {
    sincronizarDom();
    const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);
    if (!pl.perfil_id) {
      alert("Atenção: É obrigatório selecionar um Perfil de Contexto para vincular ao Autorevolver.");
      return;
    }

    chrome.storage.local.set({ playlists: playlistsSalvas }, () => {
      document.getElementById('btnVoltarPlaylists').click();
    });
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes.revolverAtivo || changes.playlistIdAtiva || changes.playlists)) {
      if (!document.getElementById('listaPlaylistsContainer').classList.contains('hidden')) {
        carregarPlaylists();
      } else if (changes.playlists && playlistEmEdicaoId) {
        playlistsSalvas = changes.playlists.newValue || [];
        sincronizarDom();
        renderizarItens();
      }
    }
  });

  carregarPlaylists();
}
