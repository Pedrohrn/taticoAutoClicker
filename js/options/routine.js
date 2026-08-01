export function initRoutines() {
  let rotinasLocais = [];
  let perfisLocais = [];
  let playlistsLocais = [];
  let rotinaEditandoId = null;
  let dragStepIndex = null;
  let dragRotinaIndex = null;

  const viewLista = document.getElementById('listaRotinasContainer');
  const viewForm = document.getElementById('formRotinaContainer');
  const listaBody = document.getElementById('listaRotinasBody');

  function carregarDadosGlobais() {
    chrome.storage.local.get(['rotinas', 'perfis', 'playlists'], (res) => {
      rotinasLocais = res.rotinas || [];
      perfisLocais = res.perfis || [];
      playlistsLocais = res.playlists || [];
      renderizarLista();
    });
  }

  function renderizarLista() {
    listaBody.innerHTML = '';
    rotinasLocais.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.draggable = true;
      tr.dataset.index = idx;

      // procuro o nome do perfil; se nao tiver, caio no fallback
      const nomePerfil = perfisLocais.find(p => p.id === r.perfil_id)?.nome || 'Sem Perfil';

      tr.innerHTML = `
        <td><input type="checkbox" class="chk-rotina" data-id="${r.id}"></td>
        <td class="drag-handle">☰</td>
        <td>${r.nome}</td>
        <td>${nomePerfil}</td>
        <td>${r.tipo === 'simples' ? 'Simples' : 'Avançada'}</td>
        <td style="color:${r.ativa ? '#28a745' : '#dc3545'}; font-weight:bold;">${r.ativa ? 'Ativa' : 'Pausada'}</td>
        <td style="text-align:center;">
          <button class="btn btn-sm ${r.ativa ? 'btn-secondary' : 'btn-success'} btn-toggle-r" data-id="${r.id}">${r.ativa ? 'Pausar' : 'Ativar'}</button>
          <button class="btn btn-sm btn-info btn-editar-r" data-id="${r.id}" style="background-color:#17a2b8;">Edit</button>
          <button class="btn btn-sm btn-secondary btn-duplicar-r" data-id="${r.id}">Copiar</button>
          <button class="btn btn-sm btn-danger btn-excluir-r" data-id="${r.id}">Del</button>
        </td>
      `;

      tr.addEventListener('dragstart', () => { dragRotinaIndex = idx; });
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
      loop: false,
      qtde_execucoes: 1,
      usa_parada: false,
      condicao_parada: { tipo: 'css', valor_seletor: '' },
      autorefresh_min: 0,
      autorefresh_seg: 0,
      acionar_revolver: false,
      revolver_playlist_id: '',
      revolver_timeout_ms: 0,
      config_simples: { intermitencia_ms: 1000, seletor_alvo: '', clique_continuo: true },
      passos_avancados: []
    };
    rotinasLocais.push(nova);
    abrirEdicao(nova.id);
  });

  document.querySelectorAll('input[name="rotinaTipo"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.getElementById('fsRotinaSimples').classList.toggle('hidden', e.target.value !== 'simples');
      document.getElementById('fsRotinaAvancada').classList.toggle('hidden', e.target.value !== 'avancada');
    });
  });

  // exibe e amarra os listeners p/ visibilidade dos sub-blocos
  document.getElementById('rotinaUsaParada').addEventListener('change', (e) => {
    document.getElementById('containerRotinaParada').style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('rotinaAcionaRevolver').addEventListener('change', (e) => {
    document.getElementById('containerRotinaRevolver').style.display = e.target.checked ? 'inline-flex' : 'none';
  });

  function atualizarComboboxPlaylists(idSelecionado) {
    const sel = document.getElementById('rotinaRevolverPlaylist');
    sel.innerHTML = '<option value="">Selecione a Playlist...</option>';
    playlistsLocais.forEach(p => {
      sel.innerHTML += `<option value="${p.id}" ${p.id === idSelecionado ? 'selected' : ''}>${p.nome}</option>`;
    });
  }

  function abrirEdicao(id) {
    rotinaEditandoId = id;
    const r = rotinasLocais.find(x => x.id === id);

    document.getElementById('rotinaNome').value = r.nome;
    document.getElementById('rotinaPerfilId').value = r.perfil_id || '';
    document.querySelector(`input[name="rotinaTipo"][value="${r.tipo}"]`).checked = true;

    // config geral de execucao
    document.getElementById('rotinaLoop').checked = r.loop || false;
    document.getElementById('rotinaQtde').value = r.qtde_execucoes || 1;
    document.getElementById('rotinaUsaParada').checked = r.usa_parada || false;
    document.getElementById('rotinaParadaTipo').value = r.condicao_parada?.tipo || 'css';
    document.getElementById('rotinaParadaValor').value = r.condicao_parada?.valor_seletor || '';
    document.getElementById('rotinaAutoRefMin').value = r.autorefresh_min || 0;
    document.getElementById('rotinaAutoRefSeg').value = r.autorefresh_seg || 0;

    document.getElementById('rotinaAcionaRevolver').checked = r.acionar_revolver || false;
    atualizarComboboxPlaylists(r.revolver_playlist_id);
    document.getElementById('rotinaRevolverTimeout').value = r.revolver_timeout_ms || 0;

    // config simples
    document.getElementById('rotinaSimplesSeletor').value = r.config_simples.seletor_alvo;
    document.getElementById('rotinaSimplesIntervalo').value = r.config_simples.intermitencia_ms;
    document.getElementById('rotinaSimplesContinuo').checked = r.config_simples.clique_continuo;

    // forco os disparos pra atualizar interface visual
    document.querySelector(`input[name="rotinaTipo"]:checked`).dispatchEvent(new Event('change'));
    document.getElementById('rotinaUsaParada').dispatchEvent(new Event('change'));
    document.getElementById('rotinaAcionaRevolver').dispatchEvent(new Event('change'));

    viewLista.classList.add('hidden');
    viewForm.classList.remove('hidden');
    renderizarPassosAvancados();
  }

  document.getElementById('btnVoltarRotinas').addEventListener('click', () => {
    viewForm.classList.add('hidden');
    viewLista.classList.remove('hidden');
    carregarDadosGlobais();
  });

  function renderizarPassosAvancados() {
    const r = rotinasLocais.find(x => x.id === rotinaEditandoId);
    const body = document.getElementById('listaPassosBody');
    body.innerHTML = '';

    // injeto o thead formatado padrao direto via JS pra n precisar poluir o html
    const head = document.getElementById('headPassosAvancados');
    if (head) {
      head.innerHTML = `<tr>
        <th style="width:30px;"></th>
        <th style="width:125px;">Ação</th>
        <th style="width:90px;">Tipo Sel.</th>
        <th>Alvo Principal</th>
        <th style="width:70px;">Atraso</th>
        <th style="width:230px;">Regras do Passo</th>
        <th style="width:40px;">Del</th>
      </tr>`;
    }

    r.passos_avancados.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.draggable = true;
      tr.dataset.index = idx;

      let regrasHtml = '';
      if (p.acao === 'click') {
        regrasHtml = `
          <div style="display:flex; flex-direction:column; gap:4px; font-size:11px;">
            <div style="display:flex; gap:4px; align-items:center;">
              <span>Qtd:</span> <input type="number" class="p-click-qtde" value="${p.click_qtde || 1}" style="width:45px;">
              <span>Int(ms):</span> <input type="number" step="1000" class="p-click-int" value="${p.click_intervalo_ms || 1000}" style="width:55px;">
            </div>
            <div style="display:flex; gap:4px; align-items:center;">
              <span>Parar se:</span>
              <select class="p-click-stop-tipo" style="width:55px;">
                <option value="css" ${p.parada_tipo === 'css' ? 'selected' : ''}>CSS</option>
                <option value="xpath" ${p.parada_tipo === 'xpath' ? 'selected' : ''}>XPath</option>
                <option value="text" ${p.parada_tipo === 'text' ? 'selected' : ''}>Text</option>
              </select>
              <input type="text" class="p-click-stop" value="${p.parada_seletor || ''}" placeholder="Seletor" style="width:75px;">
            </div>
          </div>
        `;
      } else if (p.acao === 'wait') {
        regrasHtml = `<label style="font-size:11px;"><input type="checkbox" class="p-wait-block" ${p.wait_block !== false ? 'checked' : ''}> Bloquear avanço até achar</label>`;
      }

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
            <option value="css" ${p.tipo_seletor === 'css' ? 'selected' : ''}>CSS</option>
            <option value="xpath" ${p.tipo_seletor === 'xpath' ? 'selected' : ''}>XPath</option>
            <option value="text" ${p.tipo_seletor === 'text' ? 'selected' : ''}>Texto</option>
          </select>
        </td>
        <td><input type="text" class="p-valor" value="${p.valor_seletor}"></td>
        <td><input type="number" step="1000" class="p-delay" value="${p.delay_ms}" style="width:100%;"></td>
        <td>${regrasHtml}</td>
        <td style="text-align:center;"><button class="btn btn-sm btn-danger btn-del-passo" data-idx="${idx}">X</button></td>
      `;

      // re-renderizo dinamicamente quando a acao for trocada pra atualizar as rules do passo
      tr.querySelector('.p-acao').addEventListener('change', (e) => {
        sincronizarPassosDom();
        r.passos_avancados[idx].acao = e.target.value;
        renderizarPassosAvancados();
      });

      tr.addEventListener('dragstart', () => { dragStepIndex = idx; });
      tr.addEventListener('dragover', (e) => { e.preventDefault(); });
      tr.addEventListener('drop', (e) => {
        sincronizarPassosDom();
        if (dragStepIndex !== null && dragStepIndex !== idx) {
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
        r.passos_avancados.splice(parseInt(e.target.dataset.idx, 10), 1);
        renderizarPassosAvancados();
      });
    });
  }

  function sincronizarPassosDom() {
    const r = rotinasLocais.find(x => x.id === rotinaEditandoId);
    const linhas = document.querySelectorAll('#listaPassosBody tr');
    r.passos_avancados = Array.from(linhas).map((tr, i) => {
      const acao = tr.querySelector('.p-acao').value;
      const obj = {
        id: r.passos_avancados[i]?.id || Date.now().toString() + Math.random(),
        acao: acao,
        tipo_seletor: tr.querySelector('.p-tipo').value,
        valor_seletor: tr.querySelector('.p-valor').value,
        delay_ms: parseInt(tr.querySelector('.p-delay').value, 10) || 0
      };
      if (acao === 'click') {
        obj.click_qtde = parseInt(tr.querySelector('.p-click-qtde')?.value, 10) || 1;
        obj.click_intervalo_ms = parseInt(tr.querySelector('.p-click-int')?.value, 10) || 1000;
        obj.parada_tipo = tr.querySelector('.p-click-stop-tipo')?.value || 'css';
        obj.parada_seletor = tr.querySelector('.p-click-stop')?.value || '';
      } else if (acao === 'wait') {
        obj.wait_block = tr.querySelector('.p-wait-block')?.checked ?? true;
      }
      return obj;
    });
  }

  document.getElementById('btnAdicionarPasso').addEventListener('click', () => {
    sincronizarPassosDom();
    const r = rotinasLocais.find(x => x.id === rotinaEditandoId);
    r.passos_avancados.push({ id: Date.now().toString(), acao: 'click', tipo_seletor: 'css', valor_seletor: '', delay_ms: 1000 });
    renderizarPassosAvancados();
  });

  document.getElementById('btnSalvarRotina').addEventListener('click', () => {
    const perfilSelecionado = document.getElementById('rotinaPerfilId').value;

    // validacao stricta p/ vinculo de contexto
    if (!perfilSelecionado) {
      alert('Atenção: É obrigatório selecionar um Perfil de Contexto para a rotina.');
      return;
    }

    sincronizarPassosDom();
    const r = rotinasLocais.find(x => x.id === rotinaEditandoId);

    r.nome = document.getElementById('rotinaNome').value;
    r.perfil_id = perfilSelecionado;
    r.tipo = document.querySelector('input[name="rotinaTipo"]:checked').value;

    r.loop = document.getElementById('rotinaLoop').checked;
    r.qtde_execucoes = parseInt(document.getElementById('rotinaQtde').value, 10) || 1;
    r.usa_parada = document.getElementById('rotinaUsaParada').checked;
    r.condicao_parada.tipo = document.getElementById('rotinaParadaTipo').value;
    r.condicao_parada.valor_seletor = document.getElementById('rotinaParadaValor').value;

    r.autorefresh_min = parseInt(document.getElementById('rotinaAutoRefMin').value, 10) || 0;
    r.autorefresh_seg = parseInt(document.getElementById('rotinaAutoRefSeg').value, 10) || 0;

    r.acionar_revolver = document.getElementById('rotinaAcionaRevolver').checked;
    r.revolver_playlist_id = document.getElementById('rotinaRevolverPlaylist').value;
    r.revolver_timeout_ms = parseInt(document.getElementById('rotinaRevolverTimeout').value, 10) || 0;

    r.config_simples.seletor_alvo = document.getElementById('rotinaSimplesSeletor').value;
    r.config_simples.intermitencia_ms = parseInt(document.getElementById('rotinaSimplesIntervalo').value, 10) || 1000;
    r.config_simples.clique_continuo = document.getElementById('rotinaSimplesContinuo').checked;

    salvarESincronizar();
    document.getElementById('btnVoltarRotinas').click();
  });

  function salvarESincronizar() {
    chrome.storage.local.set({ rotinas: rotinasLocais }, carregarDadosGlobais);
  }

  carregarDadosGlobais();
}
