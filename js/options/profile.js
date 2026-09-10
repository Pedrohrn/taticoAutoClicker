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

  function sugerirDownloadConfig() {
    setTimeout(() => {
      if (confirm('Atenção: Houve alterações nas URLs ou no Perfil Principal.\nDeseja baixar o novo arquivo "config.json" para atualizar o script de automação das TVs?')) {
        chrome.storage.local.get(null, (res) => {
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res, null, 2));
          const a = document.createElement('a');
          a.href = dataStr;
          a.download = "config.json";
          document.body.appendChild(a);
          a.click();
          a.remove();

          alert("Pronto! Mova/substitua o arquivo baixado na pasta taticoAutoClicker e execute o comando 'sincronizar_urls' no terminal da TV.");
        });
      }
    }, 300);
  }

  // usando delegacao de eventos na tabela
  bodyLista.addEventListener('click', (e) => {
    const btnEditar = e.target.closest('.btn-editar-p');
    const btnExcluir = e.target.closest('.btn-excluir-p');
    const btnPrincipal = e.target.closest('.btn-principal-p');

    if (btnEditar) {
      abrirEdicao(btnEditar.dataset.id);
    } else if (btnPrincipal) {
      const id = btnPrincipal.dataset.id;
      perfisLocais.forEach(p => p.principal = (p.id === id));
      salvarESincronizar(true);
    } else if (btnExcluir) {
      const id = btnExcluir.dataset.id;

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

      const badgePrincipal = p.principal
        ? `<span style="color: #fff; background: #28a745; font-size: 10px; margin-left: 8px; padding: 2px 6px; border-radius: 4px; font-weight: bold;">★ PRINCIPAL</span>`
        : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="chk-perfil" data-id="${p.id}"></td>
        <td>${p.nome} ${badgePrincipal}</td>
        <td>${dias}</td>
        <td>${horario}</td>
        <td style="text-align:center;">
          <div class="action-buttons">
            <button class="btn-action btn-action-warning btn-principal-p" data-id="${p.id}" title="Definir como Perfil Principal das TVs">★</button>
            <button class="btn-action btn-action-info btn-editar-p" data-id="${p.id}" title="Editar">✎</button>
            <button class="btn-action btn-action-danger btn-excluir-p" data-id="${p.id}" title="Excluir">🗑</button>
          </div>
        </td>
      `;
      fragment.appendChild(tr);
    });

    bodyLista.appendChild(fragment);
  }

  document.getElementById('btnNovoPerfil').addEventListener('click', () => {
    const novo = {
      id: crypto.randomUUID(),
      nome: 'Novo Perfil',
      principal: perfisLocais.length === 0, // o primeiro criado sempre assume como principal
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
      principal: perfisLocais.length === 0,
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

    document.getElementById('perfilStatusBar').checked = p.exibir_statusbar !== false;
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

    const urlsAtuaisStr = JSON.stringify(p.urls_alvo || []);
    p.urls_alvo = document.getElementById('perfilUrls').value.split('\n').map(u => u.trim()).filter(u => u);
    p.urls_exclusao = document.getElementById('perfilUrlsExclusao').value.split('\n').map(u => u.trim()).filter(u => u);
    const alterouUrls = urlsAtuaisStr !== JSON.stringify(p.urls_alvo);

    p.exibir_statusbar = document.getElementById('perfilStatusBar').checked;
    p.autorefresh_min = parseInt(document.getElementById('perfilAutoRefMin').value, 10) || 0;
    p.autorefresh_seg = parseInt(document.getElementById('perfilAutoRefSeg').value, 10) || 0;

    p.dias_semana = Array.from(document.querySelectorAll('#perfilDiasContainer input:checked'))
      .map(chk => parseInt(chk.value, 10));

    salvarESincronizar(alterouUrls || p.principal);

    document.getElementById('btnVoltarPerfis').click();
  });

  function salvarESincronizar(pedirDownloadConfig = false) {
    chrome.storage.local.set({ perfis: perfisLocais }, () => {
      carregarPerfis();
      if (pedirDownloadConfig) {
        sugerirDownloadConfig();
      }
    });
  }

  carregarPerfis();
}

export function atualizarSelectRotinas(perfis) {
  const selRotina = document.getElementById('rotinaPerfilId');
  const selPlaylist = document.getElementById('playlistPerfilId');
  const selScroll = document.getElementById('scrollPerfilId');

  const opcoesHTML = '<option value="">Sem Perfil Vinculado</option>' +
    perfis.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');

  if (selRotina) selRotina.innerHTML = opcoesHTML;
  if (selPlaylist) selPlaylist.innerHTML = opcoesHTML;
  if (selScroll) selScroll.innerHTML = opcoesHTML;
}
