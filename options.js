document.addEventListener('DOMContentLoaded', () => {
  const nomeLojaInput = document.getElementById('nomeLoja');
  const tipoTvInput = document.getElementById('tipoTv');
  const linkPbiInput = document.getElementById('linkPbi');
  const salvarBtn = document.getElementById('salvar');
  const status = document.getElementById('status');

  chrome.storage.local.get(['nomeLoja', 'tipoTv', 'linkPbi'], (result) => {
    if (result.nomeLoja) nomeLojaInput.value = result.nomeLoja;
    if (result.tipoTv) tipoTvInput.value = result.tipoTv;
    if (result.linkPbi) linkPbiInput.value = result.linkPbi;
  });

  nomeLojaInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });

  salvarBtn.addEventListener('click', () => {
    const configs = {
      nomeLoja: nomeLojaInput.value.toUpperCase(),
      tipoTv: tipoTvInput.value,
      linkPbi: linkPbiInput.value
    };

    chrome.storage.local.set(configs, () => {
      status.textContent = 'Configurações salvas com sucesso!';
      setTimeout(() => { status.textContent = ''; }, 3000);
    });
  });
});