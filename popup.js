document.addEventListener('DOMContentLoaded', () => {
  const btnToggle = document.getElementById('btnToggle');
  const btnOpcoes = document.getElementById('btnOpcoes');
  const textoStatus = document.getElementById('textoStatus');

  function atualizarInterface() {
    chrome.runtime.sendMessage({ action: "obterStatusRevolver" }, (response) => {
      const rodando = response && response.rodando;
      if (rodando) {
        textoStatus.textContent = "Status: Rodando (ON)";
        textoStatus.style.color = "#28a745";
        btnToggle.textContent = "Pausar Revolver";
        btnToggle.className = "btn btn-pause";
      } else {
        textoStatus.textContent = "Status: Pausado (OFF)";
        textoStatus.style.color = "#dc3545";
        btnToggle.textContent = "Iniciar Revolver";
        btnToggle.className = "btn btn-play";
      }
    });
  }

  btnToggle.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "obterStatusRevolver" }, (response) => {
      const rodando = response && response.rodando;
      const novoEstado = !rodando;

      chrome.storage.local.set({ revolverAtivo: novoEstado }, () => {
        if (novoEstado) {
          chrome.runtime.sendMessage({ action: "iniciarRevolver" });
        } else {
          chrome.runtime.sendMessage({ action: "pararRevolver" });
        }
        atualizarInterface();
      });
    });
  });

  btnOpcoes.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  atualizarInterface();
});
