document.addEventListener('DOMContentLoaded', () => {
  // seletores do menu lateral
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // seletores da aba autoclicker
  const nomeLojaInput = document.getElementById('nomeLoja');
  const linkPbiInput = document.getElementById('linkPbi');
  const tempoMinutosInput = document.getElementById('tempoMinutos');
  const tempoSegundosInput = document.getElementById('tempoSegundos');
  const salvarAutoClickerBtn = document.getElementById('salvarAutoClicker');
  const status = document.getElementById('status');

  // seletores da aba revolver
  const playlistBody = document.getElementById('playlistBody');
  const btnCapturarJanela = document.getElementById('btnCapturarJanela');
  const btnAdicionarItem = document.getElementById('btnAdicionarItem');
  const btnMarcarTodos = document.getElementById('btnMarcarTodos');
  const btnRemoverSelecionados = document.getElementById('btnRemoverSelecionados');
  const chkSelectAll = document.getElementById('chkSelectAll');
  const salvarRevolverBtn = document.getElementById('salvarRevolver');

  let playlistLocal = [];

  // navegação entre abas laterais
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
    });
  });

  // carrega configuracoes salvas do chrome.storage
  chrome.storage.local.get(['nomeLoja', 'linkPbi', 'tempoMinutos', 'tempoSegundos', 'playlists'], (result) => {
    nomeLojaInput.value = result.nomeLoja || 'CAMPINAS';
    if (result.linkPbi) linkPbiInput.value = result.linkPbi;
    tempoMinutosInput.value = result.tempoMinutos !== undefined ? result.tempoMinutos : 60;
    tempoSegundosInput.value = result.tempoSegundos !== undefined ? result.tempoSegundos : 0;

    playlistLocal = result.playlists || [];
    renderizarPlaylist();
  });

  // renderizacao da tabela de playlist com suporte a drag and drop
  function renderizarPlaylist() {
    playlistBody.innerHTML = '';

    playlistLocal.forEach((item, index) => {
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
            <input type="number" class="item-seg" value="${item.segundos || 10}" min="0" max="59" style="width: 50px;">
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

      // eventos de drag e drop na tabela
      tr.addEventListener('dragstart', handleDragStart);
      tr.addEventListener('dragover', handleDragOver);
      tr.addEventListener('drop', handleDrop);

      playlistBody.appendChild(tr);
    });

    vincularEventosLinha();
  }

  let dragSrcIndex = null;

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
      const itemMovido = playlistLocal.splice(dragSrcIndex, 1)[0];
      playlistLocal.splice(targetIndex, 0, itemMovido);
      renderizarPlaylist();
    }
    return false;
  }

  function sincronizarCamposDomParaArray() {
    const linhas = playlistBody.querySelectorAll('tr');
    linhas.forEach((tr, idx) => {
      if (playlistLocal[idx]) {
        playlistLocal[idx].url = tr.querySelector('.item-url').value;
        playlistLocal[idx].minutos = parseInt(tr.querySelector('.item-min').value, 10) || 0;
        playlistLocal[idx].segundos = parseInt(tr.querySelector('.item-seg').value, 10) || 0;
        playlistLocal[idx].ativo = tr.querySelector('.item-ativo').checked;
        playlistLocal[idx].principal = tr.querySelector('.item-principal').checked;
      }
    });
  }

  function vincularEventosLinha() {
    document.querySelectorAll('.btn-remover-linha').forEach(btn => {
      btn.addEventListener('click', (e) => {
        sincronizarCamposDomParaArray();
        const idx = e.target.dataset.index;
        playlistLocal.splice(idx, 1);
        renderizarPlaylist();
      });
    });

    document.querySelectorAll('.item-principal').forEach((radio, idx) => {
      radio.addEventListener('change', () => {
        sincronizarCamposDomParaArray();
        playlistLocal.forEach((item, i) => {
          item.principal = (i === idx);
        });
      });
    });
  }

  // captura de guias abertas na janela
  btnCapturarJanela.addEventListener('click', () => {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      sincronizarCamposDomParaArray();
      tabs.forEach(tab => {
        if (tab.url && !tab.url.startsWith('chrome://')) {
          playlistLocal.push({
            url: tab.url,
            minutos: 0,
            segundos: 15,
            ativo: true,
            principal: false
          });
        }
      });
      renderizarPlaylist();
    });
  });

  btnAdicionarItem.addEventListener('click', () => {
    sincronizarCamposDomParaArray();
    playlistLocal.push({
      url: '',
      minutos: 0,
      segundos: 10,
      ativo: true,
      principal: playlistLocal.length === 0
    });
    renderizarPlaylist();
  });

  chkSelectAll.addEventListener('change', (e) => {
    const marcado = e.target.checked;
    document.querySelectorAll('.chk-item').forEach(chk => chk.checked = marcado);
  });

  btnMarcarTodos.addEventListener('click', () => {
    sincronizarCamposDomParaArray();
    const todosAtivos = playlistLocal.every(i => i.ativo);
    playlistLocal.forEach(i => i.ativo = !todosAtivos);
    renderizarPlaylist();
  });

  btnRemoverSelecionados.addEventListener('click', () => {
    sincronizarCamposDomParaArray();
    const checkboxes = document.querySelectorAll('.chk-item');
    const indicesParaRemover = [];

    checkboxes.forEach((chk, idx) => {
      if (chk.checked) indicesParaRemover.push(idx);
    });

    playlistLocal = playlistLocal.filter((_, idx) => !indicesParaRemover.includes(idx));
    renderizarPlaylist();
  });

  // salvamento do autoclicker
  salvarAutoClickerBtn.addEventListener('click', () => {
    const min = parseInt(tempoMinutosInput.value, 10);
    const seg = parseInt(tempoSegundosInput.value, 10);

    if (!linkPbiInput.value.includes('app.powerbi.com/view?r=')) {
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

  // salvamento da playlist do revolver
  salvarRevolverBtn.addEventListener('click', () => {
    sincronizarCamposDomParaArray();
    chrome.storage.local.set({ playlists: playlistLocal }, () => {
      mostrarStatus('Playlist de rotação salva com sucesso!', true);
    });
  });

  function mostrarStatus(mensagem, sucesso) {
    status.style.color = sucesso ? '#28a745' : '#dc3545';
    status.textContent = mensagem;
    setTimeout(() => { status.textContent = ''; }, 3000);
  }
});
