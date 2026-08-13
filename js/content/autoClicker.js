class TaticoStatusBarUI {
  constructor() {
    this.elemento = null;
    this.posicao = 'bottom-center';
    this.coords = null;
    this.isDragging = false;
    this.estado = {
      fechada: false,
      minimizada: false,
      autoClickerPaused: false,
      autoRefreshPaused: false,
      revolverAtivo: false,
      passoAtual: 0,
      passoTotal: 0,
      statusPasso: 'loading',
      tempoRefreshTexto: ''
    };
  }

  async inicializar(nomeRotinaAtiva) {
    chrome.storage.local.set({ rotinaAtualNome: nomeRotinaAtiva || "Ativa" });
    const res = await chrome.storage.local.get(['statusBarPos', 'statusBarCoords', 'statusBarMinimized', 'statusBarClosed', 'autoClickerPaused', 'autoRefreshPaused', 'revolverAtivo']);

    this.posicao = res.statusBarPos || 'bottom-center';
    this.coords = res.statusBarCoords || null;
    this.estado.minimizada = !!res.statusBarMinimized;
    this.estado.fechada = !!res.statusBarClosed;
    this.estado.autoClickerPaused = !!res.autoClickerPaused;
    this.estado.autoRefreshPaused = !!res.autoRefreshPaused;
    this.estado.revolverAtivo = !!res.revolverAtivo;

    this.construirDOM();
    this.escutarAlteracoesStorage();
  }

  construirDOM() {
    if (document.getElementById('tatico-statusbar-inj')) return;

    // injeto estilos base de controle pro arraste e layout dinamico sem encostar nos globais
    if (!document.getElementById('tatico-statusbar-inj-style')) {
      const style = document.createElement('style');
      style.id = 'tatico-statusbar-inj-style';
      style.textContent = `
        .tsb-drag-handle { cursor: grab; padding: 0 8px; font-size: 16px; user-select: none; display: flex; align-items: center; justify-content: center; }
        .tsb-drag-handle:active { cursor: grabbing; }
        .tatico-statusbar.tsb-vertical .tsb-content { flex-direction: column; }
        .tatico-statusbar.tsb-vertical .tsb-drag-handle { padding: 8px 0; transform: rotate(90deg); }
        .tatico-statusbar.is-custom { bottom: auto !important; right: auto !important; transform: none !important; margin: 0 !important; }
      `;
      document.head.appendChild(style);
    }

    this.elemento = document.createElement('div');
    this.elemento.id = 'tatico-statusbar-inj';
    document.body.appendChild(this.elemento);

    this.elemento.addEventListener('click', (e) => {
      if (this.estado.minimizada && e.target.closest('.tsb-min-icon')) {
        this.estado.minimizada = false;
        chrome.storage.local.set({ statusBarMinimized: false });
        this.renderizarConteudo();
      }
    });

    window.addEventListener('resize', this.ajustarLimitesTela.bind(this));

    this.renderizarConteudo();
  }

  ajustarLimitesTela() {
    if (this.posicao === 'custom' && this.coords && !this.isDragging && !this.estado.minimizada) {
      const rect = this.elemento.getBoundingClientRect();
      let newX = this.coords.x;
      let newY = this.coords.y;

      const maxRight = window.innerWidth - rect.width;
      const maxBottom = window.innerHeight - rect.height;

      if (newX > maxRight) newX = maxRight;
      if (newY > maxBottom) newY = maxBottom;
      if (newX < 0) newX = 0;
      if (newY < 0) newY = 0;

      if (newX !== this.coords.x || newY !== this.coords.y) {
        this.coords.x = newX;
        this.coords.y = newY;
        this.elemento.style.left = `${newX}px`;
        this.elemento.style.top = `${newY}px`;
        chrome.storage.local.set({ statusBarCoords: this.coords });
      }
    }
  }

  renderizarConteudo() {
    if (!this.elemento || this.isDragging) return;

    if (this.estado.fechada) {
      this.elemento.className = 'tatico-statusbar is-closed';
      this.elemento.style.display = 'none';
      return;
    } else {
      this.elemento.style.display = '';
    }

    if (this.estado.minimizada) {
      this.elemento.className = 'tatico-statusbar is-minimized';
      this.aplicarPosicaoECoordenadas();
      this.elemento.innerHTML = `<div class="tsb-min-icon" title="Expandir Tatico">\u25B2</div>`;
      return;
    }

    this.elemento.innerHTML = `
      <div class="tsb-content">
        <div class="tsb-drag-handle" title="Arraste para mover a barra">\u2630</div>
        <span class="tsb-label tsb-label-passo"></span>
        <button id="tsb-btn-ac" class="tsb-btn" title="Alternar AutoClicker">
          ${this.estado.autoClickerPaused ? '\u25B6 AC' : '\u23F8 AC'}
        </button>
        <button id="tsb-btn-ar" class="tsb-btn" title="Alternar AutoRefresh">
          ${this.estado.autoRefreshPaused ? '\u25B6 AR' : '\u23F8 AR'}
        </button>
        <button id="tsb-btn-rev" class="tsb-btn" title="Alternar Revolver">
          ${this.estado.revolverAtivo ? '\u23F8 REV' : '\u25B6 REV'}
        </button>
        <span class="tsb-label tsb-label-tempo"></span>
        <button id="tsb-btn-conf" class="tsb-btn" title="Configurações">\u2699</button>
        <button id="tsb-btn-min" class="tsb-btn" title="Minimizar">\u25BC</button>
        <button id="tsb-btn-close" class="tsb-btn" title="Fechar (Reabrir via Popup)">\u2715</button>
      </div>
    `;

    this.aplicarPosicaoECoordenadas();
    this.atualizarApenasValores();
    this.bindEventosInternos();
  }

  aplicarPosicaoECoordenadas() {
    if (this.posicao === 'custom') {
      if (this.coords) {
        this.elemento.style.left = `${this.coords.x}px`;
        this.elemento.style.top = `${this.coords.y}px`;
        this.elemento.style.bottom = 'auto';
        this.elemento.style.right = 'auto';
        this.elemento.style.transform = 'none';

        this.elemento.className = 'tatico-statusbar is-custom';
        if (this.estado.minimizada) this.elemento.classList.add('is-minimized');

        // ajustando a espelhagem visual para nao quebrar em cantos apertados
        const isNearEdge = this.coords.x < 50 || this.coords.x + this.elemento.offsetWidth > window.innerWidth - 50;
        if (isNearEdge && !this.estado.minimizada) {
          this.elemento.classList.add('tsb-vertical');
        }
      } else {
        // defino estado temporario baseado em calculo pra extrair default e gravar
        this.elemento.className = 'tatico-statusbar tsb-pos-bottom-center';
        const rect = this.elemento.getBoundingClientRect();
        this.coords = { x: rect.left, y: rect.top };
        this.aplicarPosicaoECoordenadas();
      }
    } else {
      this.elemento.style.left = '';
      this.elemento.style.top = '';
      this.elemento.style.bottom = '';
      this.elemento.style.right = '';
      this.elemento.style.transform = '';

      this.elemento.className = `tatico-statusbar tsb-pos-${this.posicao}`;
      if (this.estado.minimizada) this.elemento.classList.add('is-minimized');
    }
  }

  bindEventosInternos() {
    document.getElementById('tsb-btn-ac')?.addEventListener('click', () => {
      chrome.storage.local.set({ autoClickerPaused: !this.estado.autoClickerPaused });
    });

    document.getElementById('tsb-btn-ar')?.addEventListener('click', () => {
      chrome.storage.local.set({ autoRefreshPaused: !this.estado.autoRefreshPaused });
    });

    document.getElementById('tsb-btn-rev')?.addEventListener('click', () => {
      chrome.storage.local.set({ revolverAtivo: !this.estado.revolverAtivo });
    });

    document.getElementById('tsb-btn-conf')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: "openOptions" });
    });

    document.getElementById('tsb-btn-min')?.addEventListener('click', () => {
      this.estado.minimizada = true;
      chrome.storage.local.set({ statusBarMinimized: true });
      this.renderizarConteudo();
    });

    document.getElementById('tsb-btn-close')?.addEventListener('click', () => {
      this.estado.fechada = true;
      chrome.storage.local.set({ statusBarClosed: true });
      this.renderizarConteudo();
    });

    const handle = this.elemento.querySelector('.tsb-drag-handle');
    if (handle) {
      handle.addEventListener('mousedown', this.iniciarArraste.bind(this));
    }
  }

  // injeto manipuladores de drag para arrastar solto pelo viewport
  iniciarArraste(e) {
    this.isDragging = true;
    this.startX = e.clientX;
    this.startY = e.clientY;

    const rect = this.elemento.getBoundingClientRect();
    this.initialX = rect.left;
    this.initialY = rect.top;

    this.elemento.className = 'tatico-statusbar is-custom';
    this.elemento.style.bottom = 'auto';
    this.elemento.style.right = 'auto';
    this.elemento.style.transform = 'none';

    this.onMouseMove = this.arrastar.bind(this);
    this.onMouseUp = this.pararArraste.bind(this);

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  arrastar(e) {
    if (!this.isDragging) return;

    let newX = this.initialX + (e.clientX - this.startX);
    let newY = this.initialY + (e.clientY - this.startY);

    if (newX < 0) newX = 0;
    if (newY < 0) newY = 0;

    // uso a posicao exata do mouse pra avaliar encostas laterais evitando colisoes do element container (flick)
    const isVertical = e.clientX < 50 || e.clientX > window.innerWidth - 50;
    if (isVertical) {
      this.elemento.classList.add('tsb-vertical');
    } else {
      this.elemento.classList.remove('tsb-vertical');
    }

    const rect = this.elemento.getBoundingClientRect();
    if (newX + rect.width > window.innerWidth) newX = window.innerWidth - rect.width;
    if (newY + rect.height > window.innerHeight) newY = window.innerHeight - rect.height;

    this.elemento.style.left = `${newX}px`;
    this.elemento.style.top = `${newY}px`;
  }

  pararArraste() {
    if (!this.isDragging) return;
    this.isDragging = false;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);

    const rect = this.elemento.getBoundingClientRect();
    const updatedCoords = { x: rect.left, y: rect.top };

    this.coords = updatedCoords;
    this.posicao = 'custom';

    // defino no storage local pra preencher na aba configuracoes de forma passiva
    chrome.storage.local.set({
      statusBarPos: 'custom',
      statusBarCoords: updatedCoords
    });
  }

  escutarAlteracoesStorage() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        let mudouUi = false;

        if (changes.statusBarPos && changes.statusBarPos.newValue !== this.posicao) {
          this.posicao = changes.statusBarPos.newValue; mudouUi = true;
        }
        if (changes.statusBarCoords) {
          this.coords = changes.statusBarCoords.newValue; mudouUi = true;
        }
        if (changes.statusBarMinimized) {
          this.estado.minimizada = !!changes.statusBarMinimized.newValue; mudouUi = true;
        }
        if (changes.statusBarClosed) {
          this.estado.fechada = !!changes.statusBarClosed.newValue; mudouUi = true;
        }
        if (changes.autoClickerPaused) {
          this.estado.autoClickerPaused = !!changes.autoClickerPaused.newValue; mudouUi = true;
        }
        if (changes.autoRefreshPaused) {
          this.estado.autoRefreshPaused = !!changes.autoRefreshPaused.newValue; mudouUi = true;
        }
        if (changes.revolverAtivo) {
          this.estado.revolverAtivo = !!changes.revolverAtivo.newValue; mudouUi = true;
        }

        if (mudouUi) this.renderizarConteudo();
      }
    });
  }

  // manipulo somentes os nodes textuais pra evitar re-render no innerHTML em pleno processo
  atualizarApenasValores() {
    if (!this.elemento || this.isDragging) return;

    const lblPasso = this.elemento.querySelector('.tsb-label-passo');
    if (lblPasso) {
      const iconStatusMap = {
        'done': '<span class="tsb-status-icon done">\u2713</span>',
        'error': '<span class="tsb-status-icon error">\u2715</span>',
        'loading': '<span class="tsb-status-icon loading">?</span>'
      };
      lblPasso.innerHTML = `Passo ${this.estado.passoAtual}/${this.estado.passoTotal} ${iconStatusMap[this.estado.statusPasso] || iconStatusMap['loading']}`;
    }

    const lblTempo = this.elemento.querySelector('.tsb-label-tempo');
    if (lblTempo) {
      lblTempo.innerHTML = this.estado.tempoRefreshTexto ? `\u23F2 ${this.estado.tempoRefreshTexto}` : '';
    }
  }

  atualizarProgresso(atual, total, status) {
    this.estado.passoAtual = atual;
    this.estado.passoTotal = total;
    this.estado.statusPasso = status;
    this.atualizarApenasValores();
  }

  atualizarTimerUI(texto) {
    if (this.estado.tempoRefreshTexto !== texto) {
      this.estado.tempoRefreshTexto = texto;
      this.atualizarApenasValores();
    }
  }
}

// instancio globalmente para acesso nos loops de avaliacao
window.taticoUI = new TaticoStatusBarUI();

function encontrarElemento(tipo, seletor) {
  if (!seletor) return null;
  try {
    if (tipo === 'css' || tipo === 'id' || tipo === 'class') {
      return document.querySelector(seletor);
    }
    if (tipo === 'xpath') {
      return document.evaluate(seletor, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
    if (tipo === 'text') {
      const todos = document.querySelectorAll('*');
      for (let el of todos) {
        if (el.textContent.trim() === seletor) return el;
      }
    }
  } catch (e) {
    console.warn('Tatico AutoClicker: Erro ao buscar elemento (Seletor Invalido)', e);
  }
  return null;
}

function verificarParada(condicao) {
  if (!condicao || !condicao.valor_seletor) return false;
  return encontrarElemento(condicao.tipo || 'css', condicao.valor_seletor) !== null;
}

async function resolverPausaAc() {
  while (window.taticoUI && window.taticoUI.estado.autoClickerPaused) {
    await new Promise(r => setTimeout(r, 1000));
  }
}

async function executarRotinaAvancada(rotina) {
  console.log(`Iniciando Fila Avancada: ${rotina.nome}`);

  let abortar = false;
  let qtdeExecutado = 0;
  let refreshTimer = null;

  if (rotina.autorefresh && (rotina.autorefresh_min > 0 || rotina.autorefresh_seg > 0)) {
    const timeMs = ((rotina.autorefresh_min || 0) * 60 + (rotina.autorefresh_seg || 0)) * 1000;
    console.log(`A página será automáticamente recarregada em ${rotina.autorefresh_min}:${rotina.autorefresh_seg}`);

    let counterMs = timeMs;

    // isolo a rotina em intervalo para que ele consiga ser evitado pelo estado unificado autoRefreshPaused
    refreshTimer = setInterval(() => {
      if (counterMs > 0 && !window.taticoUI.estado.autoRefreshPaused) {
        counterMs -= 5000;

        if (counterMs <= 0) {
          clearInterval(refreshTimer);
          location.reload();
          return;
        }

        const mm = Math.floor(counterMs / 60000);
        const ss = Math.floor((counterMs % 60000) / 1000);
        const txt = `${mm}:${ss.toString().padStart(2, '0')}`;

        window.taticoUI.atualizarTimerUI(txt);
        chrome.runtime.sendMessage({ action: "updateBadge", text: txt });
      }
    }, 5000);
  }

  while (!abortar && (rotina.loop || qtdeExecutado < (rotina.qtde_execucoes || 1))) {
    if (rotina.usa_parada && verificarParada(rotina.condicao_parada)) {
      console.log(`Fila abortada via Condicao de Parada Global: ${rotina.nome}`);
      abortar = true;
      break;
    }

    for (let index = 0; index < rotina.passos_avancados.length; index++) {
      const passo = rotina.passos_avancados[index];
      if (abortar) break;

      await resolverPausaAc();
      window.taticoUI.atualizarProgresso(index + 1, rotina.passos_avancados.length, 'loading');

      if (passo.delay_ms > 0) {
        await new Promise(res => setTimeout(res, passo.delay_ms));
      }

      let alvoEncontrado = false;

      if (passo.acao === 'click') {
        const limiteClicks = passo.click_qtde || 1;
        let cliquesFeitos = 0;

        const sobreporLimitePorParada = (limiteClicks === 1 && passo.parada_seletor !== '');

        while (true) {
          await resolverPausaAc();
          if (abortar) break;

          if (passo.parada_seletor && encontrarElemento(passo.parada_tipo || 'css', passo.parada_seletor)) {
            console.log(`Parada de passo atingida. Pulando para o proximo.`);
            alvoEncontrado = true;
            break;
          }

          const alvo = encontrarElemento(passo.tipo_seletor, passo.valor_seletor);

          if (!alvo) {
            if (cliquesFeitos > 0) {
              alvoEncontrado = true;
              break;
            }
            await new Promise(res => setTimeout(res, 1000));
            continue;
          }

          alvo.click();
          cliquesFeitos++;
          alvoEncontrado = true;

          if (!sobreporLimitePorParada && limiteClicks > 0 && cliquesFeitos >= limiteClicks) {
            break;
          }

          await new Promise(res => setTimeout(res, passo.click_intervalo_ms || 1000));
        }
      }
      else if (passo.acao === 'wait') {
        while (true) {
          await resolverPausaAc();
          if (abortar) break;
          if (encontrarElemento(passo.tipo_seletor, passo.valor_seletor)) {
            alvoEncontrado = true;
            break;
          }
          await new Promise(res => setTimeout(res, 1000));
        }
      }

      if (alvoEncontrado) {
        window.taticoUI.atualizarProgresso(index + 1, rotina.passos_avancados.length, 'done');
      } else {
        window.taticoUI.atualizarProgresso(index + 1, rotina.passos_avancados.length, 'error');
      }
    }
    qtdeExecutado++;
  }

  if (rotina.acionar_revolver && rotina.revolver_playlist_id && !abortar) {
    console.log('Rotina concluida. Acionando Auto Tab Revolver...');
    setTimeout(() => {
      chrome.storage.local.set({
        revolverAtivo: true,
        playlistIdAtiva: rotina.revolver_playlist_id
      });
    }, rotina.revolver_timeout_ms || 0);
  }
}

async function iniciarFilaRotinasSimples(rotina) {
  const cfg = rotina.config_simples;

  window.taticoUI.atualizarProgresso(1, 1, 'loading');

  const intervalo = setInterval(async () => {
    await resolverPausaAc();

    if (rotina.usa_parada && verificarParada(rotina.condicao_parada)) {
      console.log(`Fila simples abortada via Condicao de Parada: ${rotina.nome}`);
      clearInterval(intervalo);
      window.taticoUI.atualizarProgresso(1, 1, 'done');
      return;
    }

    const elemento = encontrarElemento('css', cfg.seletor_alvo);
    if (elemento) {
      elemento.click();
      window.taticoUI.atualizarProgresso(1, 1, 'done');
      if (!cfg.clique_continuo) clearInterval(intervalo);
    } else {
      window.taticoUI.atualizarProgresso(1, 1, 'loading');
    }
  }, cfg.intermitencia_ms);
}

window.addEventListener('load', () => {
  chrome.storage.local.get(['perfis', 'rotinas'], (data) => {
    const perfis = data.perfis || [];
    const rotinas = data.rotinas || [];

    const urlAtual = location.href;
    const hojeDate = new Date();
    const diaAtual = hojeDate.getDay();
    const hh = hojeDate.getHours().toString().padStart(2, '0');
    const mm = hojeDate.getMinutes().toString().padStart(2, '0');
    const horaAtualStr = `${hh}:${mm}`;

    const perfilAtivo = perfis.find(p => {
      const matchDia = p.dias_semana.includes(diaAtual);
      const matchUrl = p.urls_alvo.some(url => urlAtual.includes(url));
      let matchHora = true;
      if (p.horario && p.horario.inicio && p.horario.fim) {
        matchHora = (horaAtualStr >= p.horario.inicio && horaAtualStr <= p.horario.fim);
      }
      return matchDia && matchUrl && matchHora;
    });

    if (!perfilAtivo) {
      console.log('Tatico AutoClicker: Contexto atual nao atende a nenhum perfil.');
      return;
    }

    const rotinasDoPerfil = rotinas.filter(r => r.perfil_id === perfilAtivo.id && r.ativa);

    if (rotinasDoPerfil.length > 0) {
      window.taticoUI.inicializar(rotinasDoPerfil[0].nome);

      rotinasDoPerfil.forEach(rotina => {
        if (rotina.tipo === 'simples') iniciarFilaRotinasSimples(rotina);
        else executarRotinaAvancada(rotina);
      });
    }
  });
});
