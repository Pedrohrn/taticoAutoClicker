export function initProfiles() {
  let perfisLocais = [];
  let perfilEditandoId = null;

  const bodyLista = document.getElementById('listaPerfisBody');
  const viewLista = document.getElementById('listaPerfisContainer');
  const viewForm = document.getElementById('formPerfilContainer');

  function carregarPerfis() {
    chrome.storage.local.get(['perfis'], (res) => {
      perfisLocais = res.perfis || [];
      renderizarLista();
      atualizarSelectRotinas(perfisLocais);
    });
  }

  // usando delegacao de eventos base na tabela inteira garantindo performance
  bodyLista.addEventListener('click', (e) => {
    const btnEditar = e.target.closest('.btn-editar-p');
    const btnExcluir = e.target.closest('.btn-excluir-p');

    if (btnEditar) {
      abrirEdicao(btnEditar.dataset.id);
    } else if (btnExcluir) {
      const id = btnExcluir.dataset.id;

      // regra de validacao de exclusao: verificando dependencias ativas
      chrome.storage.local.get(['rotinas', 'playlists'], (res) => {
        const rotinas = res.rotinas || [];
        const playlists = res.playlists || [];

        const emUsoRotina = rotinas.some(r => r.perfil_id === id);
        const emUsoRevolver = playlists.some(p => p.perfil_id === id);

        if (emUsoRotina || emUsoRevolver) {
          alert('Validação: Este perfil não pode ser excluído, pois encontra-se vinculado a uma Rotina ou Playlist ativa no sistema.');
          return;
        }

        if (confirm('Excluir este perfil permanentemente?')) {
          perfisLocais = perfisLocais.filter(p => p.id !== id);
          salvarESincronizar();
        }
      });
    }
  });

  function renderizarLista() {
    bodyLista.innerHTML = '';
    const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const fragment = document.createDocumentFragment();

    perfisLocais.forEach(p => {
      const dias = p.dias_semana?.length > 0 ? p.dias_semana.map(d => nomesDias[d]).join(', ') : '-';
      const horario = p.horario?.inicio || p.horario?.fim ? `${p.horario.inicio || '*'} as ${p.horario.fim || '*'}` : '-';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="chk-perfil" data-id="${p.id}"></td>
        <td>${p.nome}</td>
        <td>${dias}</td>
        <td>${horario}</td>
        <td style="text-align:center;">
          <button class="btn btn-sm btn-secondary btn-editar-p" data-id="${p.id}">Edit</button>
          <button class="btn btn-sm btn-danger btn-excluir-p" data-id="${p.id}">Del</button>
        </td>
      `;
      fragment.appendChild(tr);
    });

    bodyLista.appendChild(fragment);
  }

  document.getElementById('btnNovoPerfil').addEventListener('click', () => {
    // stdlib nativo para injetar uuid
    const novo = {
      id: crypto.randomUUID(),
      nome: 'Novo Perfil',
      dias_semana: [],
      urls_alvo: [],
      urls_exclusao: [],
      horario: { inicio: '', fim: '' },
      exibir_statusbar: true,
      autorefresh_min: 0,
      autorefresh_seg: 0
    };
    perfisLocais.push(novo);
    abrirEdicao(novo.id);
  });

  document.getElementById('btnMesclarPerfis').addEventListener('click', () => {
    const checados = Array.from(document.querySelectorAll('.chk-perfil:checked')).map(c => c.dataset.id);
    if (checados.length < 2) return alert('Selecione ao menos 2 perfis para mesclar.');

    const mesclado = {
      id: crypto.randomUUID(),
      nome: 'Perfil Mesclado',
      horario: { inicio: '', fim: '' },
      dias_semana: [],
      urls_alvo: [],
      urls_exclusao: [],
      exibir_statusbar: true
    };

    checados.forEach(id => {
      const p = perfisLocais.find(x => x.id === id);
      if (p) {
        if (p.dias_semana) mesclado.dias_semana = [...new Set([...mesclado.dias_semana, ...p.dias_semana])];
        if (p.urls_alvo) mesclado.urls_alvo = [...new Set([...mesclado.urls_alvo, ...p.urls_alvo])];
        if (p.urls_exclusao) mesclado.urls_exclusao = [...new Set([...mesclado.urls_exclusao, ...p.urls_exclusao])];
      }
    });

    perfisLocais.push(mesclado);
    abrirEdicao(mesclado.id);
  });

  function abrirEdicao(id) {
    perfilEditandoId = id;
    const p = perfisLocais.find(x => x.id === id);
    if (!p) return;

    document.getElementById('perfilNome').value = p.nome || '';
    document.getElementById('perfilHoraInicio').value = p.horario?.inicio || '';
    document.getElementById('perfilHoraFim').value = p.horario?.fim || '';
    document.getElementById('perfilUrls').value = (p.urls_alvo || []).join('\n');
    document.getElementById('perfilUrlsExclusao').value = (p.urls_exclusao || []).join('\n');

    document.getElementById('perfilStatusBar').checked = p.exibir_statusbar !== false; // fallback baseando-se no true
    document.getElementById('perfilAutoRefMin').value = p.autorefresh_min || 0;
    document.getElementById('perfilAutoRefSeg').value = p.autorefresh_seg || 0;

    document.querySelectorAll('#perfilDiasContainer input').forEach(chk => {
      chk.checked = (p.dias_semana || []).includes(parseInt(chk.value, 10));
    });

    viewLista.classList.add('hidden');
    viewForm.classList.remove('hidden');
  }

  document.getElementById('btnVoltarPerfis').addEventListener('click', () => {
    viewForm.classList.add('hidden');
    viewLista.classList.remove('hidden');
    carregarPerfis();
  });

  document.getElementById('btnSalvarPerfil').addEventListener('click', () => {
    const p = perfisLocais.find(x => x.id === perfilEditandoId);
    if (!p) return;

    p.nome = document.getElementById('perfilNome').value.trim() || 'Sem Nome';
    p.horario = {
      inicio: document.getElementById('perfilHoraInicio').value,
      fim: document.getElementById('perfilHoraFim').value
    };

    p.urls_alvo = document.getElementById('perfilUrls').value.split('\n').map(u => u.trim()).filter(u => u);
    p.urls_exclusao = document.getElementById('perfilUrlsExclusao').value.split('\n').map(u => u.trim()).filter(u => u);

    p.exibir_statusbar = document.getElementById('perfilStatusBar').checked;
    p.autorefresh_min = parseInt(document.getElementById('perfilAutoRefMin').value, 10) || 0;
    p.autorefresh_seg = parseInt(document.getElementById('perfilAutoRefSeg').value, 10) || 0;

    p.dias_semana = Array.from(document.querySelectorAll('#perfilDiasContainer input:checked'))
      .map(chk => parseInt(chk.value, 10));

    salvarESincronizar();
    document.getElementById('btnVoltarPerfis').click();
  });

  function salvarESincronizar() {
    chrome.storage.local.set({ perfis: perfisLocais }, carregarPerfis);
  }

  carregarPerfis();
}

// export unificado para popular combos em multiplos modulos ao inves de buscar na arvore do dom
export function atualizarSelectRotinas(perfis) {
  const selRotina = document.getElementById('rotinaPerfilId');
  const selPlaylist = document.getElementById('playlistPerfilId');

  const opcoesHTML = '<option value="">Sem Perfil Vinculado</option>' +
    perfis.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');

  if (selRotina) selRotina.innerHTML = opcoesHTML;
  if (selPlaylist) selPlaylist.innerHTML = opcoesHTML;
}
