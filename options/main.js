import { initProfiles } from './profile.js';
import { initRoutines } from './options/routines.js';
import { initRevolver } from './options/revolver.js';
import { initStorage } from './options/storage.js';

// garanto o estado inicial do sistema caso seja a primeira instalacao
function garantirEstadoInicial() {
  chrome.storage.local.get(['perfis', 'rotinas', 'playlists'], (data) => {
    const estado = {};
    if (!data.perfis) estado.perfis = [];
    if (!data.rotinas) estado.rotinas = [];
    if (!data.playlists) estado.playlists = [];

    if (Object.keys(estado).length > 0) {
      chrome.storage.local.set(estado);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  garantirEstadoInicial();

  // logica isolada para navegacao de abas no layout global
  const navBtns = document.querySelectorAll('.sidebar > .nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
    });
  });

  // inicializo os submodulos injetando o escopo
  initProfiles();
  initRoutines();
  initRevolver();
  initStorage();
});
