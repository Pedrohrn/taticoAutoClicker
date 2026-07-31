export function initRevolver() {
  let playlistsSalvas = [];
  let playlistEmEdicaoId = null;

  const body = document.getElementById('listaPlaylistsBody');
  const viewLista = document.getElementById('listaPlaylistsContainer');
  const viewDetalhes = document.getElementById('detalhesPlaylistContainer');

  function carregarPlaylists() {
    chrome.storage.local.get(['playlists'], (res) => {
      playlistsSalvas = res.playlists || [];
      renderizarLista();
    });
  }

  function renderizarLista() {
    body.innerHTML = '';
    playlistsSalvas.forEach(pl => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${pl.nome || 'Sem Nome'}</td>
        <td>Configurada</td>
        <td style="text-align: center;">
          <button class="btn btn-sm btn-info btn-editar-pl" data-id="${pl.id}">Edit</button>
          <button class="btn btn-sm btn-danger btn-excluir-pl" data-id="${pl.id}">Del</button>
        </td>
      `;
      body.appendChild(tr);
    });

    document.querySelectorAll('.btn-editar-pl').forEach(b => b.addEventListener('click', e => abrirEdicao(e.target.dataset.id)));
    document.querySelectorAll('.btn-excluir-pl').forEach(b => b.addEventListener('click', e => {
      playlistsSalvas = playlistsSalvas.filter(p => p.id !== e.target.dataset.id);
      chrome.storage.local.set({ playlists: playlistsSalvas }, carregarPlaylists);
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
    viewLista.classList.add('hidden');
    viewDetalhes.classList.remove('hidden');
    renderizarItens();
  }

  document.getElementById('btnVoltarPlaylists').addEventListener('click', () => {
    viewDetalhes.classList.add('hidden');
    viewLista.classList.remove('hidden');
    carregarPlaylists();
  });

  function renderizarItens() {
    const tbody = document.getElementById('playlistItensBody');
    tbody.innerHTML = '';
    const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);

    pl.itens.forEach((it, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><input type="url" class="item-url" value="${it.url}"></td>
        <td><div class="flex-row"><input type="number" class="item-min" value="${it.minutos}" style="width:50px;"><input type="number" class="item-seg" value="${it.segundos}" style="width:50px;"></div></td>
        <td><input type="checkbox" class="item-ativo" ${it.ativo ? 'checked' : ''}></td>
        <td><input type="radio" name="item-principal" ${it.principal ? 'checked' : ''}></td>
        <td><button class="btn-danger-sm btn-remover-item" data-idx="${idx}">X</button></td>
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
    pl.nome = document.getElementById('inputNomePlaylist').value;
    pl.itens = Array.from(document.querySelectorAll('#playlistItensBody tr')).map(tr => ({
      url: tr.querySelector('.item-url').value,
      minutos: parseInt(tr.querySelector('.item-min').value, 10) || 0,
      segundos: parseInt(tr.querySelector('.item-seg').value, 10) || 0,
      ativo: tr.querySelector('.item-ativo').checked,
      principal: tr.querySelector('input[name="item-principal"]').checked
    }));
  }

  document.getElementById('btnAdicionarItemRevolver').addEventListener('click', () => {
    sincronizarDom();
    const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);
    pl.itens.push({ url: '', minutos: 0, segundos: 10, ativo: true, principal: false });
    renderizarItens();
  });

  document.getElementById('btnSalvarRevolver').addEventListener('click', () => {
    sincronizarDom();
    chrome.storage.local.set({ playlists: playlistsSalvas }, () => {
      document.getElementById('btnVoltarPlaylists').click();
    });
  });

  carregarPlaylists();
}
