import { initProfiles } from './profile.js';
import { initRoutines } from './routine.js';
import { initRevolver } from './revolver.js';
import { initStorage } from './storage.js';
import { initSettings } from './settings.js';

function garantirEstadoInicial(callbackInits) {
  chrome.storage.local.get(['perfis', 'rotinas', 'playlists', 'statusBarClosed'], (data) => {
    if (!data.perfis || data.perfis.length === 0) {
      fetch(chrome.runtime.getURL('config.json'))
        .then(res => res.json())
        .then(config => {
          chrome.storage.local.set({
            perfis: config.perfis || [],
            rotinas: config.rotinas || [],
            playlists: config.playlists || [],
            statusBarClosed: config.statusBarClosed !== undefined ? config.statusBarClosed : false,
            rotinaAtualNome: config.rotinaAtualNome || ''
          }, () => location.reload());
        })
        .catch(() => {
          aplicarEstadoVazio(data);
          callbackInits();
        });
    } else {
      aplicarEstadoVazio(data);
      callbackInits();
    }
  });
}

function aplicarEstadoVazio(data) {
  const estado = {};
  if (!data.perfis) estado.perfis = [];
  if (!data.rotinas) estado.rotinas = [];
  if (!data.playlists) estado.playlists = [];
  if (data.statusBarClosed === undefined) estado.statusBarClosed = false;

  if (Object.keys(estado).length > 0) {
    chrome.storage.local.set(estado);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const applyTheme = (theme) => document.documentElement.setAttribute('data-theme', theme);
  chrome.storage.local.get(['theme'], (res) => {
    const defaultTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(res.theme || defaultTheme);
  });

  document.addEventListener('click', (e) => {
    const themeSwitch = e.target.closest('.theme-switch');
    if (themeSwitch) {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
      chrome.storage.local.set({ theme: isDark ? 'light' : 'dark' });
    }
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.theme) applyTheme(changes.theme.newValue);
  });

  garantirEstadoInicial(() => {
    initProfiles();
    initRoutines();
    initRevolver();
    initStorage();
    initSettings();
  });

  const navGroupTitles = document.querySelectorAll('.nav-group-title');
  const navBtns = document.querySelectorAll('.nav-btn.sub-btn, .nav-group-title[data-target], .sidebar > .nav-btn[data-target]');
  const tabContents = document.querySelectorAll('.tab-content');

  navGroupTitles.forEach(title => {
    title.addEventListener('click', () => {
      const group = title.closest('.nav-group');
      if (group) group.classList.toggle('open');
      if (title.dataset.target) ativarMenu(title);
    });
  });

  navBtns.forEach(btn => {
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
});
