import { initProfiles } from './profile.js';
import { initRoutines } from './routine.js';
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

  // mapeio botoes e submenus respeitando o estado ativo e parentesco no menu
  const navGroupTitles = document.querySelectorAll('.nav-group-title');
  const navBtns = document.querySelectorAll('.nav-btn.sub-btn, .nav-group-title[data-target]');
  const tabContents = document.querySelectorAll('.tab-content');

  navGroupTitles.forEach(title => {
    title.addEventListener('click', () => {
      const group = title.closest('.nav-group');
      if (group) group.classList.toggle('open');

      if (title.dataset.target) ativarMenu(title);
    });
  });

  navBtns.forEach(btn => {
    // anulo propagacao nos nav-group-titles pois ja sao tratados acima
    if (btn.classList.contains('nav-group-title')) return;
    btn.addEventListener('click', () => ativarMenu(btn));
  });

  function ativarMenu(btnAtivo) {
    document.querySelectorAll('.nav-btn, .nav-group-title').forEach(b => {
      b.classList.remove('active');
      b.classList.remove('active-parent');
    });
    tabContents.forEach(c => c.classList.remove('active'));

    btnAtivo.classList.add('active');

    const group = btnAtivo.closest('.nav-group');
    if (group) {
      const title = group.querySelector('.nav-group-title');
      if (title) title.classList.add('active-parent');
    }

    const targetId = btnAtivo.dataset.target;
    if (targetId && document.getElementById(targetId)) {
      document.getElementById(targetId).classList.add('active');
    }
  }

  const selectStatusBarPos = document.getElementById('configStatusBarPos');
  if (selectStatusBarPos) {
    chrome.storage.local.get(['statusBarPos'], (res) => {
      if (res.statusBarPos) selectStatusBarPos.value = res.statusBarPos;
    });
    selectStatusBarPos.addEventListener('change', (e) => {
      chrome.storage.local.set({ statusBarPos: e.target.value });
    });
  }

  // inicializo os submodulos injetando o escopo
  initProfiles();
  initRoutines();
  initRevolver();
  initStorage();
});
