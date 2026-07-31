import { initProfiles } from './profile.js';
import { initRoutines } from './routines.js';
import { initRevolver } from './revolver.js';
import { initStorage } from './storage.js';

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
  // mapeio botoes e submenus respeitando o estado ativo e parentesco no menu
  const navGroupTitles = document.querySelectorAll('.nav-group-title');
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  navGroupTitles.forEach(title => {
    title.addEventListener('click', () => {
      const group = title.closest('.nav-group');
      if (group) group.classList.toggle('open');

      // aplico logica de aba caso o titulo root seja clicavel diretamente (ex: revolver)
      if (title.dataset.target) {
        navBtns.forEach(b => b.classList.remove('active'));
        navGroupTitles.forEach(t => t.classList.remove('active'));
        title.classList.add('active');

        tabContents.forEach(c => c.classList.remove('active'));
        const targetId = title.dataset.target;
        if (targetId && document.getElementById(targetId)) {
          document.getElementById(targetId).classList.add('active');
        }
      }
    });
  });

  navBtns.forEach(btn => {
    // anulo propagacao nos nav-group-titles pois sao independentes
    if (btn.classList.contains('nav-group-title')) return;

    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      navGroupTitles.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');

      // conservo o brilho no menu pai caso um de seus submenus seja ativo
      const group = btn.closest('.nav-group');
      if (group) {
        const title = group.querySelector('.nav-group-title');
        if (title) title.classList.add('active');
      }

      const targetId = btn.dataset.target;
      if (targetId && document.getElementById(targetId)) {
        document.getElementById(targetId).classList.add('active');
      }
    });
  });

  // inicializo os submodulos injetando o escopo
  initProfiles();
  initRoutines();
  initRevolver();
  initStorage();
});
