export function initRoutines() {
  let rotinasLocais = [];
  let rotinaEditandoId = null;
  let dragStepIndex = null;
  let dragRotinaIndex = null;

  const viewLista = document.getElementById('listaRotinasContainer');
  const viewForm = document.getElementById('formRotinaContainer');
  const listaBody = document.getElementById('listaRotinasBody');

  function carregarRotinas() {
    chrome.storage.local.get(['rotinas'], (res) => {
      rotinasLocais = res.rotinas || [];
      renderizarLista();
    });
  }

  function renderizarLista() {
    listaBody.innerHTML = '';
    rotinasLocais.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.draggable = true;
      tr.dataset.index = idx;

      tr.innerHTML = `
        <td><input type="checkbox" class="chk-rotina" data-id="${r.id}"></td>
        <td class="drag-handle">☰</td>
        <td>${r.nome}</td>
        <td>${r.perfil_id || 'Nenhum'}</td>
        <td>${r.tipo === 'simples' ? 'Simples' : 'Avançada'}</td>
        <td style="color:${r.ativa ? '#28a745' : '#dc3545'}; font-weight:bold;">${r.ativa ? 'Ativa' : 'Pausada'}</td>
        <td style="text-align:center;">
          <button class="btn btn-sm ${r.ativa ? 'btn-secondary' : 'btn-success'} btn-toggle-r" data-id="${r.id}">${r.ativa ? 'Pausar' : 'Ativar'}</button>
          <button class="btn btn-sm btn-info btn-editar-r" data-id="${r.id}" style="background-color:#17a2b8;">Edit</button>
          <button class="btn btn-sm btn-secondary btn-duplicar-r" data-id="${r.id}">Copiar</button>
          <button class="btn btn-sm btn-danger btn-excluir-r" data-id="${r.id}">Del</button>
        </td>
      `;

      tr.addEventListener('dragstart', (e) => { dragRotinaIndex = idx; });
      tr.addEventListener('dragover', (e) => { e.preventDefault(); });
      tr.addEventListener('drop', (e) => {
        const targetIdx = idx;
        if (dragRotinaIndex !== null && dragRotinaIndex !== targetIdx) {
          const movida = rotinasLocais.splice(dragRotinaIndex, 1)[0];
          rotinasLocais.splice(targetIdx, 0, movida);
          salvarESincronizar();
        }
      });

      listaBody.appendChild(tr);
    });
    vincularEventosLista();
  }

  function vincularEventosLista() {
    document.querySelectorAll('.btn-editar-r').forEach(b => b.addEventListener('click', (e) => abrirEdicao(e.target.dataset.id)));
    document.querySelectorAll('.btn-toggle-r').forEach(b => b.addEventListener('click', (e) => {
      const r = rotinasLocais.find(x => x.id === e.target.dataset.id);
      r.ativa = !r.ativa;
      salvarESincronizar();
    }));
    document.querySelectorAll('.btn-excluir-r').forEach(b => b.addEventListener('click', (e) => {
      if (confirm('Excluir esta rotina?')) {
        rotinasLocais = rotinasLocais.filter(x => x.id !== e.target.dataset.id);
        salvarESincronizar();
      }
    }));
    document.querySelectorAll('.btn-duplicar-r').forEach(b => b.addEventListener('click', (e) => {
      const original = rotinasLocais.find(x => x.id === e.target.dataset.id);
      const copia = JSON.parse(JSON.stringify(original));
      copia.id = Date.now().toString();
      copia.nome += ' (Cópia)';
      rotinasLocais.push(copia);
      salvarESincronizar();
    }));
  }

  // acoes em massa para rotinas
  document.getElementById('btnPausarRotinas').addEventListener('click', () => {
    document.querySelectorAll('.chk-rotina:checked').forEach(chk => {
      const r = rotinasLocais.find(x => x.id === chk.dataset.id);
      if (r) r.ativa = false;
    });
    salvarESincronizar();
  });

  document.getElementById('btnExcluirRotinas').addEventListener('click', () => {
    const ids = Array.from(document.querySelectorAll('.chk-rotina:checked')).map(c => c.dataset.id);
    rotinasLocais = rotinasLocais.filter(x => !ids.includes(x.id));
    salvarESincronizar();
  });

  document.getElementById('chkRotinasAll').addEventListener('change', (e) => {
    document.querySelectorAll('.chk-rotina').forEach(c => c.checked = e.target.checked);
  });

  document.getElementById('btnNovaRotina').addEventListener('click', () => {
    const nova = {
      id: Date.now().toString(),
      nome: 'Nova Rotina',
      perfil_id: '',
      ativa: true,
      tipo: 'simples',
      condicao_parada: { tipo: 'loop_infinito', valor_seletor: '' },
      config_simples: { intermitencia_ms: 1000, seletor_alvo: '', clique_continuo: true },
      passos_avancados: []
    };
    rotinasLocais.push(nova);
    abrirEdicao(nova.id);
  });

  // toggle de visibilidade dos fieldsets com base no modo selecionado
  document.querySelectorAll('input[name="rotinaTipo"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.getElementById('fsRotinaSimples').classList.toggle('hidden', e.target.value !== 'simples');
      document.getElementById('fsRotinaAvancada').classList.toggle('hidden', e.target.value !== 'avancada');
    });
  });

  function abrirEdicao(id) {
    rotinaEditandoId = id;
    const r = rotinasLocais.find(x => x.id === id);

    document.getElementById('rotinaNome').value = r.nome;
    document.getElementById('rotinaPerfilId').value = r.perfil_id;
    document.querySelector(`input[name="rotinaTipo"][value="${r.tipo}"]`).checked = true;

    document.getElementById('rotinaSimplesSeletor').value = r.config_simples.seletor_alvo;
    document.getElementById('rotinaSimplesIntervalo').value = r.config_simples.intermitencia_ms;
    document.getElementById('rotinaSimplesContinuo').checked = r.config_simples.clique_continuo;

    document.getElementById('rotinaParadaTipo').value = r.condicao_parada.tipo;
    document.getElementById('rotinaParadaValor').value = r.condicao_parada.valor_seletor;

    // disparo o evento para ajustar a tela
    document.querySelector(`input[name="rotinaTipo"]:checked`).dispatchEvent(new Event('change'));

    viewLista.classList.add('hidden');
    viewForm.classList.remove('hidden');
    renderizarPassosAvancados();
  }

  document.getElementById('btnVoltarRotinas').addEventListener('click', () => {
    viewForm.classList.add('hidden');
    viewLista.classList.remove('hidden');
    carregarRotinas();
  });

  function renderizarPassosAvancados() {
    const r = rotinasLocais.find(x => x.id === rotinaEditandoId);
    const body = document.getElementById('listaPassosBody');
    body.innerHTML = '';

    r.passos_avancados.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.draggable = true;
      tr.dataset.index = idx;

      tr.innerHTML = `
        <td class="drag-handle">☰</td>
        <td>
          <select class="p-acao">
            <option value="click" ${p.acao === 'click' ? 'selected' : ''}>Click</option>
            <option value="wait" ${p.acao === 'wait' ? 'selected' : ''}>Aguardar</option>
          </select>
        </td>
        <td>
          <select class="p-tipo">
            <option value="css" ${p.tipo_seletor === 'css' ? 'selected' : ''}>CSS (Id/Class)</option>
            <option value="xpath" ${p.tipo_seletor === 'xpath' ? 'selected' : ''}>XPath</option>
            <option value="text" ${p.tipo_seletor === 'text' ? 'selected' : ''}>Texto (Fallback)</option>
          </select>
        </td>
        <td><input type="text" class="p-valor" value="${p.valor_seletor}"></td>
        <td><input type="number" class="p-delay" value="${p.delay_ms}" style="width:70px;"></td>
        <td style="text-align:center;"><button class="btn btn-sm btn-danger btn-del-passo" data-idx="${idx}">X</button></td>
      `;

      tr.addEventListener('dragstart', () => { dragStepIndex = idx; });
      tr.addEventListener('dragover', (e) => { e.preventDefault(); });
      tr.addEventListener('drop', (e) => {
        sincronizarPassosDom();
        if (dragStepIndex !== null && dragStepIndex !== idx) {
          const r = rotinasLocais.find(x => x.id === rotinaEditandoId);
          const movido = r.passos_avancados.splice(dragStepIndex, 1)[0];
          r.passos_avancados.splice(idx, 0, movido);
          renderizarPassosAvancados();
        }
      });

      body.appendChild(tr);
    });

    document.querySelectorAll('.btn-del-passo').forEach(b => {
      b.addEventListener('click', (e) => {
        sincronizarPassosDom();
        const r = rotinasLocais.find(x => x.id === rotinaEditandoId);
        r.passos_avancados.splice(parseInt(e.target.dataset.idx, 10), 1);
        renderizarPassosAvancados();
      });
    });
  }

  function sincronizarPassosDom() {
    const r = rotinasLocais.find(x => x.id === rotinaEditandoId);
    const linhas = document.querySelectorAll('#listaPassosBody tr');
    r.passos_avancados = Array.from(linhas).map(tr => ({
      id: Date.now().toString() + Math.random(),
      acao: tr.querySelector('.p-acao').value,
      tipo_seletor: tr.querySelector('.p-tipo').value,
      valor_seletor: tr.querySelector('.p-valor').value,
      delay_ms: parseInt(tr.querySelector('.p-delay').value, 10) || 0
    }));
  }

  document.getElementById('btnAdicionarPasso').addEventListener('click', () => {
    sincronizarPassosDom();
    const r = rotinasLocais.find(x => x.id === rotinaEditandoId);
    r.passos_avancados.push({ id: Date.now().toString(), acao: 'click', tipo_seletor: 'css', valor_seletor: '', delay_ms: 1000 });
    renderizarPassosAvancados();
  });

  document.getElementById('btnSalvarRotina').addEventListener('click', () => {
    sincronizarPassosDom();
    const r = rotinasLocais.find(x => x.id === rotinaEditandoId);

    r.nome = document.getElementById('rotinaNome').value;
    r.perfil_id = document.getElementById('rotinaPerfilId').value;
    r.tipo = document.querySelector('input[name="rotinaTipo"]:checked').value;

    r.config_simples.seletor_alvo = document.getElementById('rotinaSimplesSeletor').value;
    r.config_simples.intermitencia_ms = parseInt(document.getElementById('rotinaSimplesIntervalo').value, 10) || 1000;
    r.config_simples.clique_continuo = document.getElementById('rotinaSimplesContinuo').checked;

    r.condicao_parada.tipo = document.getElementById('rotinaParadaTipo').value;
    r.condicao_parada.valor_seletor = document.getElementById('rotinaParadaValor').value;

    salvarESincronizar();
    document.getElementById('btnVoltarRotinas').click();
  });

  function salvarESincronizar() {
    chrome.storage.local.set({ rotinas: rotinasLocais }, carregarRotinas);
  }

  carregarRotinas();
}
