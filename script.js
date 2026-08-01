/* ═══════════════════════════════════════════════
   Roads Along Reefs — Main Script
   Screens: main-menu → cutscene → (game)
═══════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────
   SCREEN HELPERS
───────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.toggle('active', s.id === id);
    s.classList.toggle('hidden', s.id !== id);
  });
}

function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function hideModal(id) {
  document.getElementById(id).classList.add('hidden');
}

/* ─────────────────────────────────────────────
   MAIN MENU — hit-area driven interactions
   All img layers have pointer-events:none.
   Invisible .menu-hit divs handle hover/click,
   then toggle classes on the target img.
───────────────────────────────────────────── */
document.querySelectorAll('.menu-hit').forEach(hit => {
  const targetId = hit.dataset.target;
  const action   = hit.dataset.action;
  const img      = document.getElementById(targetId);

  hit.addEventListener('mouseenter', () => img?.classList.add('btn-hover'));
  hit.addEventListener('mouseleave', () => {
    img?.classList.remove('btn-hover');
    img?.classList.remove('btn-active');
  });
  hit.addEventListener('mousedown',  () => img?.classList.add('btn-active'));
  hit.addEventListener('mouseup',    () => img?.classList.remove('btn-active'));

  hit.addEventListener('click', () => {
    if (action === 'play')     startCutscene();
    if (action === 'settings') showModal('settings-modal');
    if (action === 'load')     { renderSaveSlots(); showModal('load-modal'); }
  });
});

/* ─────────────────────────────────────────────
   SETTINGS MODAL
───────────────────────────────────────────── */
document.getElementById('settings-close').addEventListener('click', () => hideModal('settings-modal'));

// Close on backdrop click
document.getElementById('settings-modal').addEventListener('click', function(e) {
  if (e.target === this) hideModal('settings-modal');
});

// Tab switching
document.querySelectorAll('#settings-modal .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    // Update active tab button
    document.querySelectorAll('#settings-modal .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Show correct tab content
    document.querySelectorAll('#settings-modal .tab-content').forEach(c => {
      c.classList.toggle('hidden', c.id !== `tab-${tab}`);
    });
  });
});

// Range sliders → live value display
document.querySelectorAll('.setting-row input[type="range"]').forEach(slider => {
  const valEl = document.getElementById(`${slider.id}-val`);
  if (valEl) {
    slider.addEventListener('input', () => (valEl.textContent = slider.value));
  }
});

// Fullscreen toggle
document.getElementById('fullscreen-toggle').addEventListener('change', function() {
  if (this.checked) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
});

// Reset defaults
const SETTING_DEFAULTS = {
  'master-vol': 80, 'music-vol': 70, 'sfx-vol': 90, 'ambient-vol': 50,
  'brightness': 100,
};
document.getElementById('settings-reset').addEventListener('click', () => {
  Object.entries(SETTING_DEFAULTS).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = val;
      const valEl = document.getElementById(`${id}-val`);
      if (valEl) valEl.textContent = val;
    }
  });
  // Reset toggles
  ['mute-toggle','vsync-toggle','particle-toggle','tutorial-toggle','autosave-toggle','sdg-tips'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = ['vsync-toggle','particle-toggle','tutorial-toggle','autosave-toggle','sdg-tips'].includes(id);
  });
  // Reset selects
  document.getElementById('resolution').value  = '1280x720';
  document.getElementById('text-size').value   = 'medium';
  document.getElementById('colorblind').value  = 'none';
  document.getElementById('difficulty').value  = 'normal';
  document.getElementById('lang').value        = 'en';
  saveSettings();
});

document.getElementById('settings-apply').addEventListener('click', () => {
  saveSettings();
  hideModal('settings-modal');
});

function saveSettings() {
  const data = {};
  document.querySelectorAll('#settings-modal input, #settings-modal select').forEach(el => {
    data[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  try { localStorage.setItem('rar_settings', JSON.stringify(data)); } catch (_) {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('rar_settings');
    if (!raw) return;
    const data = JSON.parse(raw);
    Object.entries(data).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') { el.checked = val; }
      else { el.value = val; }
      // Update range display
      const valEl = document.getElementById(`${id}-val`);
      if (valEl) valEl.textContent = val;
    });
  } catch (_) {}
}

// Keybind rebinding
let rebindTarget = null;
document.querySelectorAll('.keybind').forEach(chip => {
  chip.addEventListener('click', () => {
    if (rebindTarget) rebindTarget.classList.remove('listening');
    rebindTarget = chip;
    chip.classList.add('listening');
    chip.textContent = '…';
  });
});

document.addEventListener('keydown', e => {
  if (!rebindTarget) return;
  e.preventDefault();
  const label = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  rebindTarget.textContent = label;
  rebindTarget.classList.remove('listening');
  rebindTarget = null;
});

// Add listening style
const style = document.createElement('style');
style.textContent = `.keybind.listening { background: #e07b39; animation: pulse 0.6s ease-in-out infinite; }`;
document.head.appendChild(style);

/* ─────────────────────────────────────────────
   SAVE / LOAD MODAL
───────────────────────────────────────────── */
const SLOT_COUNT = 3;

function getSaveSlots() {
  try {
    return JSON.parse(localStorage.getItem('rar_saves') || '[]');
  } catch (_) { return []; }
}

function writeSaveSlots(slots) {
  try { localStorage.setItem('rar_saves', JSON.stringify(slots)); } catch (_) {}
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function renderSaveSlots() {
  const slots = getSaveSlots();
  const container = document.getElementById('save-slots-container');
  container.innerHTML = '';

  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot = slots[i] || null;
    const div = document.createElement('div');
    div.className = 'save-slot';

    const numEl = document.createElement('div');
    numEl.className = 'slot-number';
    numEl.textContent = `Slot ${i + 1}`;

    const infoEl = document.createElement('div');
    infoEl.className = 'slot-info';
    infoEl.textContent = slot ? `Day ${slot.day || 1} · ${formatDate(slot.savedAt)}` : 'Empty';

    const btnsEl = document.createElement('div');
    btnsEl.className = 'slot-btns';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'slot-btn';
    saveBtn.textContent = '💾 Save';
    saveBtn.addEventListener('click', () => {
      const updated = getSaveSlots();
      updated[i] = {
        day: (updated[i]?.day || 0) + 1,
        savedAt: new Date().toISOString(),
        placeholder: true,
      };
      writeSaveSlots(updated);
      renderSaveSlots();
    });

    const loadBtn = document.createElement('button');
    loadBtn.className = 'slot-btn';
    loadBtn.textContent = '▶ Load';
    loadBtn.disabled = !slot;
    loadBtn.addEventListener('click', () => {
      if (!slot) return;
      hideModal('load-modal');
      // Future: restore game state from slot
      alert(`Loaded Slot ${i + 1}! (game world coming soon)`);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'slot-btn danger';
    delBtn.textContent = '🗑';
    delBtn.disabled = !slot;
    delBtn.addEventListener('click', () => {
      if (!slot) return;
      if (!confirm(`Delete Slot ${i + 1}?`)) return;
      const updated = getSaveSlots();
      updated[i] = null;
      writeSaveSlots(updated);
      renderSaveSlots();
    });

    btnsEl.append(saveBtn, loadBtn, delBtn);
    div.append(numEl, infoEl, btnsEl);
    container.appendChild(div);
  }
}

document.getElementById('load-close').addEventListener('click', () => hideModal('load-modal'));
document.getElementById('load-close-btn').addEventListener('click', () => hideModal('load-modal'));
document.getElementById('load-modal').addEventListener('click', function(e) {
  if (e.target === this) hideModal('load-modal');
});

/* ─────────────────────────────────────────────
   CUTSCENE ENGINE
   Sequence: cutscene1 → getajob → flyerpapers → cutscene2 → cutscene5
───────────────────────────────────────────── */
const CUTSCENE_ORDER = [
  'cs-cutscene1',
  'cs-getajob',
  'cs-flyerpapers',
  'cs-cutscene2',
  'cs-cutscene3',
];

let csIndex     = -1;   // which frame is showing (-1 = none yet)
let csAdvancing = false; // debounce

function startCutscene() {
  csIndex     = -1;
  csAdvancing = false;

  // Hide all frames
  CUTSCENE_ORDER.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible');
  });

  showScreen('cutscene-screen');

  // Small delay so the fade-in reads cleanly
  setTimeout(advanceCutscene, 400);
}

function advanceCutscene() {
  if (csAdvancing) return;
  csAdvancing = true;

  csIndex++;

  // All frames shown → end cutscene
  if (csIndex >= CUTSCENE_ORDER.length) {
    csAdvancing = false;
    endCutscene();
    return;
  }

  // Fade in the next image; previous ones stay visible (they accumulate)
  const frameId = CUTSCENE_ORDER[csIndex];
  const next = document.getElementById(frameId);
  if (next) {
    next.classList.add('visible');
    // Fire SFX tied to this frame, if any
    if (CUTSCENE_SFX[frameId]) playSfx(CUTSCENE_SFX[frameId]);
  } else {
    // Image missing — skip silently
    csAdvancing = false;
    advanceCutscene();
    return;
  }

  // Short debounce so rapid clicks don't skip two frames at once
  setTimeout(() => { csAdvancing = false; }, 500);
}

function endCutscene() {
  // Fade the whole game canvas to black simultaneously, then switch to scene 2
  fadeToScene('scene2-screen', () => {
    CUTSCENE_ORDER.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('visible');
    });
  });
}

/* ─────────────────────────────────────────────
   SCENE TRANSITION HELPER
   Fades the canvas to black, runs swapFn (which
   switches the active screen), then fades back in.
───────────────────────────────────────────── */
function fadeToScene(targetScreenId, swapFn) {
  const overlay = document.getElementById('scene-transition');
  // Fade to black
  overlay.classList.add('fading');
  setTimeout(() => {
    // Swap screens while screen is black
    if (swapFn) swapFn();
    showScreen(targetScreenId);
    // Fade back in
    setTimeout(() => overlay.classList.remove('fading'), 80);
  }, 780);
}

// Click, Space, or Enter advances the cutscene
document.getElementById('cutscene-screen').addEventListener('click', advanceCutscene);
document.addEventListener('keydown', e => {
  const csActive = document.getElementById('cutscene-screen').classList.contains('active');
  if (!csActive) return;
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    advanceCutscene();
  }
});

/* ─────────────────────────────────────────────
   SCENE 2 — desk scene
───────────────────────────────────────────── */
const phoneHit  = document.getElementById('hit-phone');
const phoneImg  = document.getElementById('scene2-phone');

phoneHit.addEventListener('mouseenter', () => phoneImg.classList.add('btn-hover'));
phoneHit.addEventListener('mouseleave', () => {
  phoneImg.classList.remove('btn-hover');
  phoneImg.classList.remove('btn-active');
});
phoneHit.addEventListener('mousedown',  () => phoneImg.classList.add('btn-active'));
phoneHit.addEventListener('mouseup',    () => phoneImg.classList.remove('btn-active'));

phoneHit.addEventListener('click', () => {
  // Placeholder: leads to the next screen (to be built)
  fadeToScene('menu-screen'); // swap for the actual next screen when ready
});

/* ─────────────────────────────────────────────
   AUDIO — music + SFX
───────────────────────────────────────────── */

// ── Music tracks ────────────────────────────
const menuMusic  = document.getElementById('menu-music');
const scene2Music = document.getElementById('scene2-music');

// All looping tracks; keyed by screen id
const SCREEN_MUSIC = {
  'menu-screen':   menuMusic,
  'scene2-screen': scene2Music,
};

function playTrack(audio) {
  if (!audio) return;
  audio.currentTime = 0;
  const p = audio.play();
  if (p) p.catch(() => {
    // Autoplay blocked — resume on first interaction
    const resume = () => { audio.play().catch(() => {}); };
    document.addEventListener('pointerdown', resume, { once: true });
    document.addEventListener('keydown',     resume, { once: true });
  });
}

function stopAllMusic() {
  Object.values(SCREEN_MUSIC).forEach(t => {
    if (!t) return;
    t.pause();
    t.currentTime = 0;
  });
}

// Hook into showScreen so the right track plays per screen
const _originalShowScreen = showScreen;
function showScreen(id) {
  _originalShowScreen(id);
  stopAllMusic();
  if (SCREEN_MUSIC[id]) playTrack(SCREEN_MUSIC[id]);
}

// Start menu music immediately on load
playTrack(menuMusic);

// ── SFX ─────────────────────────────────────
// Maps cutscene frame id → audio element id
const CUTSCENE_SFX = {
  'cs-cutscene1':   'sfx-angry-meow',
  'cs-flyerpapers': 'sfx-paperslam',
  'cs-cutscene3':   'sfx-angry-meow2',
};

function playSfx(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(() => {});
}

/* ─────────────────────────────────────────────
   INITIALISE
───────────────────────────────────────────── */
loadSettings();
