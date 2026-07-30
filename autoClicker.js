// tento buscar o arquivo config.json injetado pelo bash na raiz da extensao
fetch(chrome.runtime.getURL('config.json'))
  .then(response => response.json())
  .catch(() => ({})) // se o arquivo nao existir, instancio um objeto vazio para nao quebrar a execucao
  .then(configJson => {

    chrome.storage.local.get(['nomeLoja', 'linkPbi', 'tempoMinutos', 'tempoSegundos'], (configs) => {

      // priorizo o valor do banco local, caindo para o json, e por fim o valor padrao
      // todo: fazer o config.json alimentar os inputs
      const nomeLoja = configs.nomeLoja || configJson.nome_loja || "CAMPINAS";
      const linkPbi = configs.linkPbi || configJson.url_alvo || "";

      const min = configs.tempoMinutos !== undefined ? configs.tempoMinutos : 60;
      const seg = configs.tempoSegundos !== undefined ? configs.tempoSegundos : 0;

      let tempoAutoRefresh = (min * 60000) + (seg * 1000);
      if (tempoAutoRefresh < 10000) tempoAutoRefresh = 3600000;

      const horarioDeReload = Date.now() + tempoAutoRefresh;
      let menuAberto = false;

      console.log(`Autoclicker PBI iniciado. Loja: ${nomeLoja}`);

      function esperarElemento(seletor, timeout = 30000) {
        return new Promise((resolve, reject) => {
          const inicio = Date.now();
          const intervalo = setInterval(() => {
            const elemento = document.querySelector(seletor);
            if (elemento) {
              clearInterval(intervalo);
              resolve(elemento);
              return;
            }
            if (Date.now() - inicio > timeout) {
              clearInterval(intervalo);
              reject("Timeout procurando: " + seletor);
            }
          }, 500);
        });
      }

      async function abrirMenu() {
        try {
          console.log("Procurando botão do menu...");
          const botaoMenu = await esperarElemento(".thumbnail-image");
          botaoMenu.click();
          menuAberto = true;
          setTimeout(() => {
            nextPanel();
          }, 2000);
        }
        catch (erro) {
          console.log(erro);
        }
      }

      async function nextPanel() {
        try {
          const labelAcompanhamento = "ACOMPANHAMENTO VENDA"
          if (document.body.innerText.includes(labelAcompanhamento)) {
            if (!document.body.innerText.includes(nomeLoja)) {
              const seta = await esperarElemento(".pbi-glyph-chevronrightmedium");
              console.log("Avançando painel procurando por: " + nomeLoja);
              seta.click();

              setTimeout(nextPanel, 2000);
              return;
            }
          } else {
            setTimeout(nextPanel, 2000);
          }
        }
        catch (erro) {
          console.log(erro);
        }
      }

      function gerenciarContador() {
        const tempoRestanteMs = horarioDeReload - Date.now();

        if (tempoRestanteMs <= 0) {
          console.log("Tempo esgotado. Atualizando página...");
          chrome.runtime.sendMessage({ action: "updateBadge", text: "00:00" });
          location.reload();
          return;
        }

        const minutos = Math.floor(tempoRestanteMs / 60000);
        const segundos = Math.floor((tempoRestanteMs % 60000) / 1000);

        const tempoFormatado = `${minutos}:${segundos.toString().padStart(2, '0')}`;

        chrome.runtime.sendMessage({
          action: "updateBadge",
          text: tempoFormatado
        });
      }

      function iniciar() {
        console.log("Página carregada, acionando rotinas.");
        abrirMenu();

        gerenciarContador();
        setInterval(gerenciarContador, 5000);
      }

      if (linkPbi && location.href.includes(linkPbi)) {
        if (document.readyState === "complete" || document.readyState === "interactive") {
          iniciar();
        } else {
          window.addEventListener("load", iniciar);
        }
      }
    });
  });
