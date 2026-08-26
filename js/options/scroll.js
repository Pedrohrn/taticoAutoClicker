export function initScroll() {
  let autoScrollsSalvos = [];
  let perfisLocais = [];
  let configEmEdicaoId = null;

  const body = document.getElementById('listaAutoScrollBody');
  const viewLista = document.getElementById('listaAutoScrollContainer');
  const viewDetalhes = document.getElementById('formAutoScrollContainer');

  function carregarAutoScrolls() {
    chrome.storage.local.get(['autoScrolls', 'perfis'], (res) => {
      autoScrollsSalvos = res.autoScrolls || [];
      perfisLocais = res.perfis || [];
      renderizarLista();
    });
  }

  function renderizarLista() {
    if (!body) return;
    body.innerHTML = '';

    if (autoScrollsSalvos.length === 0) {
      // ajustando colspan para 5 pra respeitar as colunas do thead
      body.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Nenhuma configuração de AutoScroll cadastrada.</td></tr>`;
      return;
    }

    autoScrollsSalvos.forEach((config, idx) => {
      const isRunning = config.ativo !== false;
      const perfilNome = perfisLocais.find(p => p.id === config.perfil_id)?.nome || 'Sem Perfil';
      const tr = document.createElement('tr');

      // gerando exatamente 5 colunas espelhando o html: checkbox, index, nome, perfil, acoes
      tr.innerHTML = `
      <td style="text-align:center;"><input type="checkbox" class="chk-item-autoscroll" value="${config.id}"></td>
      <td style="text-align:center; font-weight:bold; color: ${isRunning ? 'var(--success)' : 'var(--text-muted)'};" title="${isRunning ? 'Ativo' : 'Pausado'}">${idx + 1}</td>
      <td>${config.nome || 'Sem Nome'}</td>
      <td>${perfilNome}</td>
      <td style="text-align: center;">
        <div class="action-buttons">
          <button class="btn btn-sm btn-secondary btn-toggle-as" data-id="${config.id}" title="${isRunning ? 'Pausar' : 'Rodar'}">${isRunning ? '⏸' : '▶'}</button>
          <button class="btn btn-sm btn-info btn-editar-as" data-id="${config.id}" title="Editar">✎</button>
          <button class="btn btn-sm btn-danger btn-excluir-as" data-id="${config.id}" title="Excluir">🗑</button>
        </div>
      </td>
      `;
      body.appendChild(tr);
    });

    // binding dos botoes de acao da tabela
    document.querySelectorAll('.btn-toggle-as').forEach(b => b.addEventListener('click', e => {
      const id = e.target.dataset.id;
      const config = autoScrollsSalvos.find(c => c.id === id);
      if (config) {
        config.ativo = !(config.ativo !== false);
        chrome.storage.local.set({ autoScrolls: autoScrollsSalvos }, carregarAutoScrolls);
      }
    }));

    document.querySelectorAll('.btn-editar-as').forEach(b => b.addEventListener('click', e => abrirEdicao(e.target.dataset.id)));

    document.querySelectorAll('.btn-excluir-as').forEach(b => b.addEventListener('click', e => {
      if (confirm('Excluir este AutoScroll?')) {
        autoScrollsSalvos = autoScrollsSalvos.filter(p => p.id !== e.target.dataset.id);
        chrome.storage.local.set({ autoScrolls: autoScrollsSalvos }, carregarAutoScrolls);
      }
    }));
  }

  // lidando com exclusao em lote via checkboxes
  const chkAll = document.getElementById('chkAutoScrollAll');
  if (chkAll) {
    chkAll.addEventListener('change', (e) => {
      document.querySelectorAll('.chk-item-autoscroll').forEach(chk => chk.checked = e.target.checked);
    });
  }

  const btnExcluirEmLote = document.getElementById('btnExcluirAutoScroll');
  if (btnExcluirEmLote) {
    btnExcluirEmLote.addEventListener('click', () => {
      const marcados = Array.from(document.querySelectorAll('.chk-item-autoscroll:checked')).map(c => c.value);
      if (marcados.length === 0) return alert('Selecione pelo menos um registro para excluir.');

      if (confirm(`Excluir ${marcados.length} configuração(ões)?`)) {
        autoScrollsSalvos = autoScrollsSalvos.filter(c => !marcados.includes(c.id));
        chrome.storage.local.set({ autoScrolls: autoScrollsSalvos }, () => {
          if (chkAll) chkAll.checked = false;
          carregarAutoScrolls();
        });
      }
    });
  }

  const btnNovo = document.getElementById('btnNovoAutoScroll');
  if (btnNovo) {
    btnNovo.addEventListener('click', () => {
      const id = Date.now().toString();

      // gerando o registro inicial apenas em memoria pra evitar que suje o banco com um orfao se eu cancelar a edicao
      autoScrollsSalvos.push({
        id,
        nome: 'Novo AutoScroll',
        perfil_id: '',
        ativo: true,
        unidade_rolagem: 'pages',
        quantidade: 1,
        intervalo_segundos: 5,
        velocidade: 'smooth',
        voltar_ao_inicio: false,
        limite_ciclos: 0
      });
      abrirEdicao(id);
    });
  }

  function abrirEdicao(id) {
    configEmEdicaoId = id;
    const config = autoScrollsSalvos.find(x => x.id === id);
    if (!config) return;

    // mapeando ids estritamente conforme o options.html atual
    document.getElementById('autoScrollNome').value = config.nome || '';
    document.getElementById('scrollPerfilId').value = config.perfil_id || '';

    const radiosUnidade = document.getElementsByName('scrollUnidade');
    radiosUnidade.forEach(r => {
      r.checked = (r.value === (config.unidade_rolagem || 'pages'));
    });

    document.getElementById('autoScrollQuantidade').value = config.quantidade || 1;
    document.getElementById('autoScrollIntervaloSeg').value = config.intervalo_segundos || 5;
    document.getElementById('autoScrollVelocidade').value = config.velocidade || 'smooth';

    const chkVoltar = document.getElementById('autoScrollVoltarInicio');
    if (chkVoltar) chkVoltar.checked = !!config.voltar_ao_inicio;

    document.getElementById('autoScrollCiclos').value = config.limite_ciclos || 0;

    viewLista.classList.add('hidden');
    viewDetalhes.classList.remove('hidden');
  }

  const btnVoltar = document.getElementById('btnVoltarAutoScroll');
  if (btnVoltar) {
    btnVoltar.addEventListener('click', () => {
      const config = autoScrollsSalvos.find(p => p.id === configEmEdicaoId);

      // se nao tem perfil_id, limpo o registro da memoria (ex: desisti de criar um novo) pra nao quebrar o content script
      if (config && !config.perfil_id) {
        autoScrollsSalvos = autoScrollsSalvos.filter(p => p.id !== configEmEdicaoId);
      } else {
        sincronizarDom();
      }

      chrome.storage.local.set({ autoScrolls: autoScrollsSalvos }, () => {
        viewDetalhes.classList.add('hidden');
        viewLista.classList.remove('hidden');
        carregarAutoScrolls();
      });
    });
  }

  function sincronizarDom() {
    const config = autoScrollsSalvos.find(p => p.id === configEmEdicaoId);
    if (!config) return;

    // puxando valores baseando-se estritamente no thead e id's do html fornecido
    config.nome = document.getElementById('autoScrollNome').value;
    config.perfil_id = document.getElementById('scrollPerfilId').value;

    const radioAtivo = document.querySelector('input[name="scrollUnidade"]:checked');
    config.unidade_rolagem = radioAtivo ? radioAtivo.value : 'pages';

    config.quantidade = parseFloat(document.getElementById('autoScrollQuantidade').value) || 0;
    config.intervalo_segundos = parseFloat(document.getElementById('autoScrollIntervaloSeg').value) || 0;
    config.velocidade = document.getElementById('autoScrollVelocidade').value;

    const chkVoltar = document.getElementById('autoScrollVoltarInicio');
    config.voltar_ao_inicio = chkVoltar ? chkVoltar.checked : false;

    config.limite_ciclos = parseInt(document.getElementById('autoScrollCiclos').value, 10) || 0;
  }

  const btnSalvar = document.getElementById('btnSalvarAutoScroll');
  if (btnSalvar) {
    btnSalvar.addEventListener('click', () => {
      sincronizarDom();
      const config = autoScrollsSalvos.find(p => p.id === configEmEdicaoId);

      // impedindo de ficar orfa pra nao falhar na execucao
      if (!config.perfil_id) {
        alert("Atenção: É obrigatório selecionar um Perfil de Contexto para vincular ao AutoScroll.");
        return;
      }

      chrome.storage.local.set({ autoScrolls: autoScrollsSalvos }, () => {
        document.getElementById('btnVoltarAutoScroll').click();
      });
    });
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.autoScrolls) {
      if (viewLista && !viewLista.classList.contains('hidden')) {
        carregarAutoScrolls();
      }
    }
  });

  carregarAutoScrolls();
}
