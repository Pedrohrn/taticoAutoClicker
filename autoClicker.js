chrome.storage.local.get(['nomeLoja', 'tipoTv', 'linkPbi'], (configs) => {
    
    const nomeLoja = configs.nomeLoja || "GARAVELO"; 
    const tipoTv = configs.tipoTv || "Padaria";
    
    const tempoAutoRefresh = 3600000; // 1 hora
    const horarioDeReload = Date.now() + tempoAutoRefresh;
    let menuAberto = false;

    console.log(`Autoclicker PBI iniciado. Loja: ${nomeLoja} | Setor: ${tipoTv}`);

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
            const menu = await esperarElemento(".thumbnail-image");
            console.log("Menu encontrado.");
            menu.click();
            menuAberto = true;
            setTimeout(() => {
                nextPanel();
            }, 1000);
        }
        catch (erro) {
            console.log(erro);
        }
    }

    async function nextPanel() {
        try {
            if (!document.body.innerText.includes(nomeLoja)) {
                const seta = await esperarElemento(".pbi-glyph-chevronrightmedium");
                console.log("Avançando painel procurando por: " + nomeLoja);
                seta.click();
                
                setTimeout(nextPanel, 2000); 
                return;
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

    if (document.readyState === "complete" || document.readyState === "interactive") {
        iniciar();
    } else {
        window.addEventListener("load", iniciar);
    }
});