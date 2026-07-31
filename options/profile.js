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

  function renderizarLista() {
    bodyLista.innerHTML = '';
    perfisLocais.forEach((p, idx) => {
      const dias = p.dias_semana ? p.dias_semana.join(',') : '-';
      const horario = p.horario ? `${p.horario.inicio || '*'} as ${p.horario.fim || '*'}` : '-';
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
      bodyLista.appendChild(tr);
    });
    vincularEventosLista();
  }

  function vincularEventosLista() {
    document.querySelectorAll('.btn-editar-p').forEach(b => {
      b.addEventListener('click', (e) => abrirEdicao(e.target.dataset.id));
    });
    document.querySelectorAll('.btn-excluir-p').forEach(b => {
      b.addEventListener('click', (e) => {
        if (confirm('Excluir este perfil? (As rotinas atreladas perderão contexto)')) {
          perfisLocais = perfisLocais.filter(p => p.id !== e.target.dataset.id);
          salvarESincronizar();
        }
      });
    });
  }

  document.getElementById('btnNovoPerfil').addEventListener('click', () => {
    const novo = { id: Date.now().toString(), nome: 'Novo Perfil', dias_semana: [], urls_alvo: [], horario: { inicio: '', fim: '' } };
    perfisLocais.push(novo);
    abrirEdicao(novo.id);
  });

  // junto as urls e dias de dois perfis, exigindo nova reconfiguracao de horario
  document.getElementById('btnMesclarPerfis').addEventListener('click', () => {
    const checados = Array.from(document.querySelectorAll('.chk-perfil:checked')).map(c => c.dataset.id);
    if (checados.length < 2) return alert('Selecione ao menos 2 perfis para mesclar.');

    const mesclado = {
      id: Date.now().toString(),
      nome: 'Perfil Mesclado',
      horario: { inicio: '', fim: '' },
      dias_semana: [],
      urls_alvo: []
    };

    checados.forEach(id => {
      const p = perfisLocais.find(x => x.id === id);
      if (p) {
        if (p.dias_semana) mesclado.dias_semana = [...new Set([...mesclado.dias_semana, ...p.dias_semana])];
        if (p.urls_alvo) mesclado.urls_alvo = [...new Set([...mesclado.urls_alvo, ...p.urls_alvo])];
      }
    });

    perfisLocais.push(mesclado);
    abrirEdicao(mesclado.id);
  });

  function abrirEdicao(id) {
    perfilEditandoId = id;
    const p = perfisLocais.find(x => x.id === id);
    document.getElementById('perfilNome').value = p.nome;
    document.getElementById('perfilHoraInicio').value = p.horario?.inicio || '';
    document.getElementById('perfilHoraFim').value = p.horario?.fim || '';
    document.getElementById('perfilUrls').value = (p.urls_alvo || []).join('\n');

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
    p.nome = document.getElementById('perfilNome').value;
    p.horario = {
      inicio: document.getElementById('perfilHoraInicio').value,
      fim: document.getElementById('perfilHoraFim').value
    };
    p.urls_alvo = document.getElementById('perfilUrls').value.split('\n').map(u => u.trim()).filter(u => u);

    const dias = [];
    document.querySelectorAll('#perfilDiasContainer input:checked').forEach(chk => dias.push(parseInt(chk.value, 10)));
    p.dias_semana = dias;

    salvarESincronizar();
    document.getElementById('btnVoltarPerfis').click();
  });

  function salvarESincronizar() {
    chrome.storage.local.set({ perfis: perfisLocais }, carregarPerfis);
  }

  carregarPerfis();
}

// funcao exportada para atualizar o dropdown do outro modulo dinamicamente
export function atualizarSelectRotinas(perfis) {
  const sel = document.getElementById('rotinaPerfilId');
  if (!sel) return;
  sel.innerHTML = '<option value="">Sem Perfil Vinculado</option>';
  perfis.forEach(p => {
    sel.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
  });
}
