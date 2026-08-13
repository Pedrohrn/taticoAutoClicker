export function initRevolver() {
  let playlistsSalvas = [];
  let playlistEmEdicaoId = null;

  const body = document.getElementById('listaPlaylistsBody');
  const viewLista = document.getElementById('listaPlaylistsContainer');
  const viewDetalhes = document.getElementById('detalhesPlaylistContainer');

  function carregarPlaylists() {
    chrome.storage.local.get(['playlists', 'revolverAtivo', 'playlistIdAtiva'], (res) => {
      playlistsSalvas = res.playlists || [];
      const isGlobalActive = res.revolverAtivo;
      const activeId = res.playlistIdAtiva;
      renderizarLista(isGlobalActive, activeId);
    });
  }

  function renderizarLista(isGlobalActive, activeId) {
    body.innerHTML = '';

    // injetando botao global de play/pause dinamicamente se ainda nao existir na view
    let btnGlobal = document.getElementById('btnToggleRevolverGlobal');
    if (!btnGlobal) {
      const btnNova = document.getElementById('btnNovaPlaylist');
      if (btnNova) {
        btnGlobal = document.createElement('button');
        btnGlobal.id = 'btnToggleRevolverGlobal';
        btnNova.insertAdjacentElement('afterend', btnGlobal);

        btnGlobal.addEventListener('click', () => {
          chrome.storage.local.get(['revolverAtivo'], res => {
            chrome.storage.local.set({ revolverAtivo: !res.revolverAtivo });
          });
        });
      }
    }

    if (btnGlobal) {
      btnGlobal.className = `btn btn-sm ${isGlobalActive ? 'btn-danger' : 'btn-success'}`;
      btnGlobal.style.marginLeft = '10px';
      btnGlobal.textContent = isGlobalActive ? '⏸ Pausar Todos' : '▶ Iniciar Revólver';
    }

    if (playlistsSalvas.length === 0) {
      body.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Nenhuma playlist cadastrada.</td></tr>`;
      return;
    }

    playlistsSalvas.forEach(pl => {
      const isRunning = isGlobalActive && (activeId === pl.id);
      const tr = document.createElement('tr');
      // adotei icones puros para otimizar layout sem espremer as colunas e inseri classe de wrap
      tr.innerHTML = `
        <td>${pl.nome || 'Sem Nome'}</td>
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
        if (res.revolverAtivo && res.playlistIdAtiva === id) {
          chrome.storage.local.set({ revolverAtivo: false });
        } else {
          chrome.storage.local.set({ revolverAtivo: true, playlistIdAtiva: id });
        }
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
    playlistsSalvas.push({ id, nome: 'Nova Playlist', itens: [] });
    chrome.storage.local.set({ playlists: playlistsSalvas }, () => abrirEdicao(id));
  });

  function abrirEdicao(id) {
    playlistEmEdicaoId = id;
    const p = playlistsSalvas.find(x => x.id === id);
    document.getElementById('inputNomePlaylist').value = p.nome;

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
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Nenhuma URL cadastrada.</td></tr>`;
      return;
    }

    pl.itens.forEach((it, idx) => {
      const isAberto = it.aberto ? '<span style="color:var(--success); font-size:0.8em; margin-left:5px;">(Aberto)</span>' : '';
      const tr = document.createElement('tr');
      // garantindo que os inputs temporais nunca serao esmagados via flex-shrink na classe .flex-row-inputs
      tr.innerHTML = `
        <td style="text-align:center;"><input type="checkbox" class="chk-item-revolver" data-idx="${idx}"></td>
        <td>${idx + 1}</td>
        <td><input type="text" class="item-url input-no-shrink" value="${it.url}" placeholder="https://... ou wildcard *">${isAberto}</td>
        <td>
          <div class="flex-row" style="flex-wrap: nowrap;">
            <input type="number" class="item-min input-no-shrink" value="${it.minutos}" style="width:60px;">
            <input type="number" class="item-seg input-no-shrink" value="${it.segundos}" style="width:60px;">
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
    const linhas = document.querySelectorAll('#playlistItensBody tr:not(:has(td[colspan]))');
    pl.itens = Array.from(linhas).map((tr, idx) => ({
      url: tr.querySelector('.item-url').value,
      minutos: parseInt(tr.querySelector('.item-min').value, 10) || 0,
      segundos: parseInt(tr.querySelector('.item-seg').value, 10) || 0,
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
          pl.itens.push({
            url: tab.url,
            minutos: 0,
            segundos: 15,
            ativo: true,
            principal: false,
            aberto: false
          });
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
      const indicesParaRemover = [];
      checkboxes.forEach((chk, idx) => {
        if (chk.checked) indicesParaRemover.push(idx);
      });
      const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);
      pl.itens = pl.itens.filter((_, idx) => !indicesParaRemover.includes(idx));
      if (chkSelectAll) chkSelectAll.checked = false;
      renderizarItens();
    });
  }

  document.getElementById('btnAdicionarItemRevolver').addEventListener('click', () => {
    sincronizarDom();
    const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);
    pl.itens.push({ url: '', minutos: 0, segundos: 10, ativo: true, principal: pl.itens.length === 0, aberto: false });
    renderizarItens();
  });

  document.getElementById('btnSalvarRevolver').addEventListener('click', () => {
    sincronizarDom();
    chrome.storage.local.set({ playlists: playlistsSalvas }, () => {
      document.getElementById('btnVoltarPlaylists').click();
    });
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes.revolverAtivo || changes.playlistIdAtiva || changes.playlists)) {
      if (document.getElementById('listaPlaylistsContainer').classList.contains('hidden') === false) {
        carregarPlaylists();
      } else if (changes.playlists && playlistEmEdicaoId) {
        // caso o background altere os itens pra aberto em real time
        playlistsSalvas = changes.playlists.newValue || [];
        sincronizarDom();
        renderizarItens();
      }
    }
  });

  carregarPlaylists();
}
