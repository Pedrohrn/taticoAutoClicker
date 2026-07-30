document.addEventListener('DOMContentLoaded', () => {
  // seletores globais do menu
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const btnExportar = document.getElementById('btnExportar');
  const btnImportar = document.getElementById('btnImportar');
  const fileImportar = document.getElementById('fileImportar');
  const status = document.getElementById('status');

  // seletores da aba autoclicker
  const nomeLojaInput = document.getElementById('nomeLoja');
  const linkPbiInput = document.getElementById('linkPbi');
  const tempoMinutosInput = document.getElementById('tempoMinutos');
  const tempoSegundosInput = document.getElementById('tempoSegundos');
  const salvarAutoClickerBtn = document.getElementById('salvarAutoClicker');

  // seletores principais da aba revolver (listagem)
  const listaPlaylistsContainer = document.getElementById('listaPlaylistsContainer');
  const detalhesPlaylistContainer = document.getElementById('detalhesPlaylistContainer');
  const btnNovaPlaylist = document.getElementById('btnNovaPlaylist');
  const listaPlaylistsBody = document.getElementById('listaPlaylistsBody');
  const tabelaPlaylists = document.getElementById('tabelaPlaylists');

  // seletores internos da aba revolver (edicao)
  const btnVoltarPlaylists = document.getElementById('btnVoltarPlaylists');
  const inputNomePlaylist = document.getElementById('inputNomePlaylist');
  const playlistItensBody = document.getElementById('playlistItensBody');
  const btnCapturarJanela = document.getElementById('btnCapturarJanela');
  const btnAdicionarItem = document.getElementById('btnAdicionarItem');
  const btnMarcarTodos = document.getElementById('btnMarcarTodos');
  const btnRemoverSelecionados = document.getElementById('btnRemoverSelecionados');
  const chkSelectAll = document.getElementById('chkSelectAll');
  const salvarRevolverBtn = document.getElementById('salvarRevolver');

  // variaveis de estado global do script
  let playlistsSalvas = [];
  let playlistEmEdicaoId = null;
  let estadoRevolver = { ativo: false, playlistId: null };
  let dragSrcIndex = null;

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.id === 'btnExportar' || btn.id === 'btnImportar') return;

      navBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
    });
  });

  // busco o json injetado pelo bash antes de popular os campos predefinidos na view
  fetch(chrome.runtime.getURL('config.json'))
    .then(response => response.json())
    .catch(() => ({}))
    .then(configJson => {
      chrome.storage.local.get(['nomeLoja', 'linkPbi', 'tempoMinutos', 'tempoSegundos', 'playlists', 'revolverAtivo', 'playlistIdAtiva'], (result) => {

        // preencho as opcoes priorizando o banco local, caindo pro json, e caindo pro padrao
        // todo: remover nomeLoja e afins só é usado pelo autoClicker.js
        // todo: fazer configJson alimentar os inputs
        nomeLojaInput.value = result.nomeLoja || configJson.nome_loja || 'CAMPINAS';
        linkPbiInput.value = result.linkPbi || configJson.url_alvo || '';

        tempoMinutosInput.value = result.tempoMinutos !== undefined ? result.tempoMinutos : 60;
        tempoSegundosInput.value = result.tempoSegundos !== undefined ? result.tempoSegundos : 0;

        playlistsSalvas = result.playlists || [];
        estadoRevolver.ativo = result.revolverAtivo || false;
        estadoRevolver.playlistId = result.playlistIdAtiva || null;

        renderizarListaPlaylists();
      });
    });

  function renderizarListaPlaylists() {
    listaPlaylistsBody.innerHTML = '';

    if (playlistsSalvas.length === 0) {
      listaPlaylistsBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#888;">Nenhuma playlist cadastrada.</td></tr>`;
      return;
    }

    playlistsSalvas.forEach(pl => {
      const isRunning = (estadoRevolver.ativo && estadoRevolver.playlistId === pl.id);
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td style="font-weight: 500;">${pl.nome || 'Playlist Sem Nome'}</td>
        <td style="font-weight: bold; color: ${isRunning ? '#28a745' : '#6c757d'}">${isRunning ? 'Executando' : 'Parada'}</td>
        <td style="text-align: center; gap: 5px; display: flex; justify-content: center;">
          <button class="btn-sm btn-editar-pl" data-id="${pl.id}" style="background-color: #007bff;">Editar</button>
          <button class="btn-sm btn-toggle-pl" data-id="${pl.id}" style="background-color: ${isRunning ? '#ffc107' : '#28a745'}; color: ${isRunning ? '#000' : '#fff'}; width: 70px;">
            ${isRunning ? 'Parar' : 'Iniciar'}
          </button>
          <button class="btn-sm btn-remover-pl" data-id="${pl.id}" style="background-color: #dc3545;">Excluir</button>
        </td>
      `;
      listaPlaylistsBody.appendChild(tr);
    });
  }

  btnNovaPlaylist.addEventListener('click', () => {
    const novaPl = {
      id: Date.now().toString(),
      nome: `Nova Playlist ${playlistsSalvas.length + 1}`,
      itens: []
    };
    playlistsSalvas.push(novaPl);

    chrome.storage.local.set({ playlists: playlistsSalvas }, () => {
      renderizarListaPlaylists();
      abrirEdicaoPlaylist(novaPl.id);
    });
  });

  tabelaPlaylists.addEventListener('click', (e) => {
    const idAlvo = e.target.dataset.id;
    if (!idAlvo) return;

    if (e.target.classList.contains('btn-editar-pl')) {
      abrirEdicaoPlaylist(idAlvo);
    }
    else if (e.target.classList.contains('btn-remover-pl')) {
      if (confirm('Tem certeza que deseja excluir esta playlist?')) {
        // caso o usuario remova a playlist que esta em execucao, eu interrompo a execucao por seguranca
        if (estadoRevolver.playlistId === idAlvo) {
          estadoRevolver.ativo = false;
          estadoRevolver.playlistId = null;
          chrome.storage.local.set({ revolverAtivo: false, playlistIdAtiva: null });
        }

        playlistsSalvas = playlistsSalvas.filter(p => p.id !== idAlvo);
        chrome.storage.local.set({ playlists: playlistsSalvas }, () => {
          renderizarListaPlaylists();
        });
      }
    }
    else if (e.target.classList.contains('btn-toggle-pl')) {
      // gerencio o toggle exclusivista, para que apenas uma playlist rode por vez
      // todo: criar funcao de multi execao e alternancia
      if (estadoRevolver.ativo && estadoRevolver.playlistId === idAlvo) {
        estadoRevolver.ativo = false;
        estadoRevolver.playlistId = null;
      } else {
        estadoRevolver.ativo = true;
        estadoRevolver.playlistId = idAlvo;
      }

      chrome.storage.local.set({
        revolverAtivo: estadoRevolver.ativo,
        playlistIdAtiva: estadoRevolver.playlistId
      }, () => {
        renderizarListaPlaylists();
      });
    }
  });

  function abrirEdicaoPlaylist(id) {
    playlistEmEdicaoId = id;
    const pl = playlistsSalvas.find(p => p.id === id);
    if (!pl) return;

    inputNomePlaylist.value = pl.nome;
    listaPlaylistsContainer.style.display = 'none';
    detalhesPlaylistContainer.style.display = 'block';

    renderizarItensPlaylist();
  }

  btnVoltarPlaylists.addEventListener('click', () => {
    // salvo implicitamente se houver edicao de nome solta antes de sair
    sincronizarCamposDomParaArray();
    chrome.storage.local.set({ playlists: playlistsSalvas });

    playlistEmEdicaoId = null;
    detalhesPlaylistContainer.style.display = 'none';
    listaPlaylistsContainer.style.display = 'block';

    renderizarListaPlaylists();
  });

  function renderizarItensPlaylist() {
    playlistItensBody.innerHTML = '';
    const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);
    if (!pl || !pl.itens) return;

    pl.itens.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.draggable = true;
      tr.dataset.index = index;

      tr.innerHTML = `
        <td><input type="checkbox" class="chk-item" data-index="${index}"></td>
        <td class="drag-handle">☰</td>
        <td><input type="url" class="item-url" value="${item.url || ''}" style="width: 100%;"></td>
        <td>
          <div style="display:flex; gap: 4px;">
            <input type="number" class="item-min" value="${item.minutos || 0}" min="0" style="width: 50px;">
            <input type="number" class="item-seg" value="${item.segundos !== undefined ? item.segundos : 10}" min="0" max="59" style="width: 50px;">
          </div>
        </td>
        <td style="text-align: center;">
          <input type="checkbox" class="item-ativo" ${item.ativo ? 'checked' : ''}>
        </td>
        <td style="text-align: center;">
          <input type="radio" name="guiaPrincipal" class="item-principal" ${item.principal ? 'checked' : ''}>
        </td>
        <td>
          <button class="btn-danger-sm btn-remover-linha" data-index="${index}">X</button>
        </td>
      `;

      tr.addEventListener('dragstart', handleDragStart);
      tr.addEventListener('dragover', handleDragOver);
      tr.addEventListener('drop', handleDrop);

      playlistItensBody.appendChild(tr);
    });

    vincularEventosLinha();
  }

  // amarro a atualizacao dos inputs soltos com o array da playlist
  function sincronizarCamposDomParaArray() {
    if (!playlistEmEdicaoId) return;
    const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);
    if (!pl) return;

    pl.nome = inputNomePlaylist.value;
    const linhas = playlistItensBody.querySelectorAll('tr');

    pl.itens = Array.from(linhas).map(tr => {
      return {
        url: tr.querySelector('.item-url').value,
        minutos: parseInt(tr.querySelector('.item-min').value, 10) || 0,
        segundos: parseInt(tr.querySelector('.item-seg').value, 10) || 0,
        ativo: tr.querySelector('.item-ativo').checked,
        principal: tr.querySelector('.item-principal').checked
      };
    });
  }

  function handleDragStart(e) {
    dragSrcIndex = this.dataset.index;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    const targetIndex = this.dataset.index;

    if (dragSrcIndex !== null && dragSrcIndex !== targetIndex) {
      sincronizarCamposDomParaArray();
      const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);
      const itemMovido = pl.itens.splice(dragSrcIndex, 1)[0];
      pl.itens.splice(targetIndex, 0, itemMovido);
      renderizarItensPlaylist();
    }
    return false;
  }

  function vincularEventosLinha() {
    document.querySelectorAll('.btn-remover-linha').forEach(btn => {
      btn.addEventListener('click', (e) => {
        sincronizarCamposDomParaArray();
        const idx = parseInt(e.target.dataset.index, 10);
        const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);
        pl.itens.splice(idx, 1);
        renderizarItensPlaylist();
      });
    });

    document.querySelectorAll('.item-principal').forEach((radio, idx) => {
      radio.addEventListener('change', () => {
        sincronizarCamposDomParaArray();
        const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);
        pl.itens.forEach((item, i) => {
          item.principal = (i === idx);
        });
      });
    });
  }

  btnCapturarJanela.addEventListener('click', () => {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      sincronizarCamposDomParaArray();
      const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);

      tabs.forEach(tab => {
        if (tab.url && !tab.url.startsWith('chrome://')) {
          pl.itens.push({
            url: tab.url,
            minutos: 0,
            segundos: 15,
            ativo: true,
            principal: false
          });
        }
      });
      renderizarItensPlaylist();
    });
  });

  btnAdicionarItem.addEventListener('click', () => {
    sincronizarCamposDomParaArray();
    const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);

    pl.itens.push({
      url: '',
      minutos: 0,
      segundos: 10,
      ativo: true,
      principal: pl.itens.length === 0
    });
    renderizarItensPlaylist();
  });

  chkSelectAll.addEventListener('change', (e) => {
    const marcado = e.target.checked;
    document.querySelectorAll('.chk-item').forEach(chk => chk.checked = marcado);
  });

  btnMarcarTodos.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.chk-item');
    const todosMarcados = Array.from(checkboxes).every(chk => chk.checked);

    checkboxes.forEach(chk => {
      chk.checked = !todosMarcados;
    });
    chkSelectAll.checked = !todosMarcados;
  });

  btnRemoverSelecionados.addEventListener('click', () => {
    sincronizarCamposDomParaArray();
    const checkboxes = document.querySelectorAll('.chk-item');
    const indicesParaRemover = [];

    checkboxes.forEach((chk, idx) => {
      if (chk.checked) indicesParaRemover.push(idx);
    });

    const pl = playlistsSalvas.find(p => p.id === playlistEmEdicaoId);
    pl.itens = pl.itens.filter((_, idx) => !indicesParaRemover.includes(idx));

    chkSelectAll.checked = false;
    renderizarItensPlaylist();
  });

  salvarRevolverBtn.addEventListener('click', () => {
    sincronizarCamposDomParaArray();
    chrome.storage.local.set({ playlists: playlistsSalvas }, () => {
      mostrarStatus('Playlist de rotação salva com sucesso!', true);
    });
  });

  salvarAutoClickerBtn.addEventListener('click', () => {
    const min = parseInt(tempoMinutosInput.value, 10);
    const seg = parseInt(tempoSegundosInput.value, 10);

    if (linkPbiInput.value !== "" && !linkPbiInput.value.includes('app.powerbi.com/view?r=')) {
      mostrarStatus('Link do Power BI inválido.', false);
      return;
    }

    const configs = {
      nomeLoja: nomeLojaInput.value,
      linkPbi: linkPbiInput.value,
      tempoMinutos: isNaN(min) ? 60 : min,
      tempoSegundos: isNaN(seg) ? 0 : seg
    };

    chrome.storage.local.set(configs, () => {
      mostrarStatus('Configurações do AutoClicker salvas com sucesso!', true);
    });
  });

  btnExportar.addEventListener('click', () => {
    if (playlistEmEdicaoId) sincronizarCamposDomParaArray();

    chrome.storage.local.get(null, (items) => {
      const json = JSON.stringify(items, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'tatico_configuracoes.json';
      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  });

  btnImportar.addEventListener('click', () => {
    fileImportar.click();
  });

  fileImportar.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evento) => {
      try {
        const dados = JSON.parse(evento.target.result);
        chrome.storage.local.set(dados, () => {
          mostrarStatus('Configurações importadas! Recarregando interface...', true);
          setTimeout(() => location.reload(), 1500);
        });
      } catch (erro) {
        mostrarStatus('Erro ao ler ou processar o JSON.', false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  function mostrarStatus(mensagem, sucesso) {
    status.style.color = sucesso ? '#28a745' : '#dc3545';
    status.textContent = mensagem;
    setTimeout(() => { status.textContent = ''; }, 3000);
  }
});
