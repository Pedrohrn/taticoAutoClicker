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
      tempoRefreshTexto: '',
      revolverTargetTime: 0,
      revolverCurrentIdx: 0,
      revolverTotalItems: 0,
      revolverTempoRestante: '--:--'
    };
  }

  async inicializar(nomeRotinaAtiva) {
    chrome.storage.local.set({ rotinaAtualNome: nomeRotinaAtiva || "Ativa" });
    const res = await chrome.storage.local.get([
      'statusBarPos', 'statusBarCoords', 'statusBarMinimized', 'statusBarClosed',
      'autoClickerPaused', 'autoRefreshPaused', 'revolverAtivo',
      'revolverTargetTime', 'revolverCurrentIdx', 'revolverTotalItems'
    ]);

    this.posicao = res.statusBarPos || 'bottom-center';
    this.coords = res.statusBarCoords || null;
    this.estado.minimizada = !!res.statusBarMinimized;
    this.estado.fechada = !!res.statusBarClosed;
    this.estado.autoClickerPaused = !!res.autoClickerPaused;
    this.estado.autoRefreshPaused = !!res.autoRefreshPaused;
    this.estado.revolverAtivo = !!res.revolverAtivo;
    this.estado.revolverTargetTime = res.revolverTargetTime || 0;
    this.estado.revolverCurrentIdx = res.revolverCurrentIdx || 0;
    this.estado.revolverTotalItems = res.revolverTotalItems || 0;

    this.construirDOM();
    this.escutarAlteracoesStorage();
    this.iniciarSincronismoRevolver();
  }

  construirDOM() {
    if (document.getElementById('tatico-statusbar-inj')) return;

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
        <button id="tsb-btn-ac" class="tsb-btn" title="Alternar AutoClicker"></button>
        <button id="tsb-btn-ar" class="tsb-btn" title="Alternar AutoRefresh"></button>
        <button id="tsb-btn-rev" class="tsb-btn" title="Alternar Revolver"></button>
        <div class="tsb-controls-row">
          <button id="tsb-btn-conf" class="tsb-btn tsb-icon-btn" title="Configurações">\u2699</button>
          <button id="tsb-btn-min" class="tsb-btn tsb-icon-btn" title="Minimizar">\u25BC</button>
          <button id="tsb-btn-close" class="tsb-btn tsb-icon-btn" title="Fechar (Reabrir via Popup)">\u2715</button>
        </div>
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
        if (changes.revolverTargetTime) {
          this.estado.revolverTargetTime = changes.revolverTargetTime.newValue;
        }
        if (changes.revolverCurrentIdx) {
          this.estado.revolverCurrentIdx = changes.revolverCurrentIdx.newValue; mudouUi = true;
        }
        if (changes.revolverTotalItems) {
          this.estado.revolverTotalItems = changes.revolverTotalItems.newValue; mudouUi = true;
        }

        if (mudouUi) this.renderizarConteudo();
      }
    });
  }

  iniciarSincronismoRevolver() {
    setInterval(() => {
      if (this.estado.revolverAtivo && this.estado.revolverTargetTime) {
        const restanteMs = this.estado.revolverTargetTime - Date.now();
        if (restanteMs > 0) {
          const seg = Math.ceil(restanteMs / 1000);
          const m = Math.floor(seg / 60);
          const s = seg % 60;
          this.estado.revolverTempoRestante = `${m}:${s.toString().padStart(2, '0')}`;
        } else {
          this.estado.revolverTempoRestante = '0:00';
        }
        this.atualizarApenasValores();
      }
    }, 1000);
  }

  atualizarApenasValores() {
    if (!this.elemento || this.isDragging) return;

    const btnAc = this.elemento.querySelector('#tsb-btn-ac');
    if (btnAc) {
      const iconeAcao = this.estado.autoClickerPaused ? '\u25B6' : '\u23F8';
      const iconeStatus = this.estado.statusPasso === 'done' ? '\u2713' : (this.estado.statusPasso === 'error' ? '\u2715' : '\u231B');
      btnAc.innerHTML = `${iconeAcao} AC: ${this.estado.passoAtual}/${this.estado.passoTotal} [${iconeStatus}]`;
    }

    const btnAr = this.elemento.querySelector('#tsb-btn-ar');
    if (btnAr) {
      const iconeAcao = this.estado.autoRefreshPaused ? '\u25B6' : '\u23F8';
      const textoTempo = this.estado.tempoRefreshTexto || '--:--';
      btnAr.innerHTML = `${iconeAcao} AR: ${textoTempo}`;
    }

    const btnRev = this.elemento.querySelector('#tsb-btn-rev');
    if (btnRev) {
      const iconeAcao = this.estado.revolverAtivo ? '\u23F8' : '\u25B6';
      if (this.estado.revolverAtivo) {
        btnRev.innerHTML = `${iconeAcao} REV: ${this.estado.revolverCurrentIdx}/${this.estado.revolverTotalItems} (\u23F2 ${this.estado.revolverTempoRestante})`;
      } else {
        btnRev.innerHTML = `${iconeAcao} REV: OFF`;
      }
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

window.taticoUI = new TaticoStatusBarUI();
