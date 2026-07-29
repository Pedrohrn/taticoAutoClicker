document.addEventListener('DOMContentLoaded', () => {
  const nomeLojaInput = document.getElementById('nomeLoja');
  const linkPbiInput = document.getElementById('linkPbi');
  const tempoMinutosInput = document.getElementById('tempoMinutos');
  const tempoSegundosInput = document.getElementById('tempoSegundos');
  const salvarBtn = document.getElementById('salvar');
  const status = document.getElementById('status');

  chrome.storage.local.get(['nomeLoja', 'linkPbi', 'tempoMinutos', 'tempoSegundos'], (result) => {
    nomeLojaInput.value = result.nomeLoja || 'CAMPINAS';
    if (result.linkPbi) linkPbiInput.value = result.linkPbi;
    tempoMinutosInput.value = result.tempoMinutos !== undefined ? result.tempoMinutos : 60;
    tempoSegundosInput.value = result.tempoSegundos !== undefined ? result.tempoSegundos : 0;
  });

  function validarInputs() {
    let valido = true;

    linkPbiInput.classList.remove('error');
    tempoMinutosInput.classList.remove('error');
    tempoSegundosInput.classList.remove('error');

    if (!linkPbiInput.value.includes('app.powerbi.com/view?r=')) {
      linkPbiInput.classList.add('error');
      valido = false;
    }

    const min = parseInt(tempoMinutosInput.value, 10);
    const seg = parseInt(tempoSegundosInput.value, 10);

    if (isNaN(min) || min < 0 || min > 1440) {
      tempoMinutosInput.classList.add('error');
      valido = false;
    }

    if (isNaN(seg) || seg < 0 || seg > 59) {
      tempoSegundosInput.classList.add('error');
      valido = false;
    }

    if (valido && min === 0 && seg === 0) {
      tempoMinutosInput.classList.add('error');
      tempoSegundosInput.classList.add('error');
      valido = false;
    }

    return valido;
  }

  salvarBtn.addEventListener('click', () => {
    if (!validarInputs()) {
      status.style.color = '#dc3545';
      status.textContent = 'Revise os campos em vermelho.';
      setTimeout(() => { status.textContent = ''; }, 3000);
      return;
    }

    const configs = {
      nomeLoja: nomeLojaInput.value,
      linkPbi: linkPbiInput.value,
      tempoMinutos: parseInt(tempoMinutosInput.value, 10),
      tempoSegundos: parseInt(tempoSegundosInput.value, 10)
    };

    chrome.storage.local.set(configs, () => {
      status.style.color = '#28a745';
      status.textContent = 'Configurações salvas com sucesso!';
      setTimeout(() => { status.textContent = ''; }, 3000);
    });
  });
});
