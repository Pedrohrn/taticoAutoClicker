// encapsulando todo o arquivo em uma iife para evitar colisoes de escopo global no content script
(() => {
  let currentWindowId = null;
  let autoScrollInterval = null;
  let ciclosFeitos = 0;

  // isolando a logica de coringa para garantir que o modulo rode de forma independente sem depender de globais de outros scripts
  function matchComCoringa(urlAba, padrao) {
    if (!padrao) return false;
    if (padrao.includes('*')) {
      const regexStr = '^' + padrao.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
      return new RegExp(regexStr).test(urlAba);
    }
    const normalize = (u) => {
      try {
        const obj = new URL(u.includes('http') ? u : 'https://' + u);
        return obj.hostname.replace(/^www\./, '') + obj.pathname.replace(/\/$/, '');
      } catch (e) {
        return u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').split('?')[0];
      }
    };
    return normalize(urlAba) === normalize(padrao);
  }

  // retendo o loop temporal no frontend caso a extensao mande o comando de pausar
  async function resolverPausaScroll() {
    while (true) {
      const res = await chrome.storage.local.get(['windowStates']);
      const isPaused = res.windowStates?.[currentWindowId]?.autoScrollPaused;
      if (!isPaused) break;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  async function iniciarAutoScroll(config) {
    console.log(`Tatico AutoScroll: iniciando config '${config.nome}'`);

    const intervaloMs = (config.intervalo_segundos || 5) * 1000;
    const behavior = config.velocidade || 'smooth';

    ciclosFeitos = 0;
    if (autoScrollInterval) clearInterval(autoScrollInterval);

    autoScrollInterval = setInterval(async () => {
      await resolverPausaScroll();

      // extraindo a altura maxima do dom suportando as variacoes de renderizacao dos navegadores atuais
      const scrollHeight = Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight,
        document.body.clientHeight, document.documentElement.clientHeight
      );

      // calculando o pe da pagina baseando-se no viewport mais o que ja foi rolado
      const posAtual = window.innerHeight + window.scrollY;
      const noFimDaPagina = Math.ceil(posAtual) >= scrollHeight;

      if (noFimDaPagina) {
        ciclosFeitos++;

        if (config.limite_ciclos > 0 && ciclosFeitos >= config.limite_ciclos) {
          console.log('Tatico AutoScroll: limite de ciclos atingido. parando loop.');
          clearInterval(autoScrollInterval);
          return;
        }

        if (config.voltar_ao_inicio) {
          window.scrollTo({ top: 0, behavior });
          // abortando este frame especifico pra dar tempo da tela subir antes do proximo calculo
          return;
        }
      }

      let qtdPixels = config.quantidade || 1;
      if (config.unidade_rolagem === 'pages') {
        // multiplicando a quantidade pedida pelo height do viewport atual pra simular pagedowns
        qtdPixels = window.innerHeight * (config.quantidade || 1);
      }

      window.scrollBy({ top: qtdPixels, behavior });
    }, intervaloMs);
  }

  window.addEventListener('load', () => {
    // identificando a janela atual pra consumir o status de execucao correto vindo do background
    chrome.runtime.sendMessage({ action: "getTabContext" }, (context) => {
      if (!context || !context.windowId) return;
      currentWindowId = context.windowId;

      chrome.storage.local.get(['perfis', 'autoScrolls', 'windowStates'], (data) => {
        const perfis = data.perfis || [];
        const scrolls = data.autoScrolls || [];
        const urlAtual = location.href;

        const hojeDate = new Date();
        const diaAtual = hojeDate.getDay();
        const horaAtualStr = hojeDate.getHours().toString().padStart(2, '0') + ':' + hojeDate.getMinutes().toString().padStart(2, '0');

        // descobrindo qual perfil abraça a tab atual usando as mesmas diretrizes do clique
        const perfilAtivo = perfis.find(p => {
          const matchDia = !p.dias_semana || p.dias_semana.length === 0 || p.dias_semana.includes(diaAtual);
          let matchHora = true;
          if (p.horario && p.horario.inicio && p.horario.fim) {
            matchHora = (horaAtualStr >= p.horario.inicio && horaAtualStr <= p.horario.fim);
          }

          const urlsAlvo = p.urls_alvo || [];
          const matchUrl = urlsAlvo.length === 0 || urlsAlvo.some(url => matchComCoringa(urlAtual, url));

          const urlsExclusao = p.urls_exclusao || [];
          const isExcluido = urlsExclusao.length > 0 && urlsExclusao.some(url => matchComCoringa(urlAtual, url));

          return matchDia && matchHora && matchUrl && !isExcluido;
        });

        if (!perfilAtivo) return;

        const scrollConfig = scrolls.find(s => s.perfil_id === perfilAtivo.id && s.ativo !== false);
        if (scrollConfig) {
          iniciarAutoScroll(scrollConfig);
        }
      });
    });
  });
})();
