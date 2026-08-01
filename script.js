/* ═══════════════════════════════════════════════
   Roads Along Reefs — Main Script
   Screens: main-menu → cutscene → (game)
═══════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────
   SCREEN HELPERS
───────────────────────────────────────────── */
function _setActiveScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.toggle('active', s.id === id);
    s.classList.toggle('hidden', s.id !== id);
  });
}

// showScreen is defined once below, after SCREEN_MUSIC is declared,
// so it can also manage music. Forward-declare a stub so early callers work.
function showScreen(id) { _setActiveScreen(id); }

function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function hideModal(id) {
  document.getElementById(id).classList.add('hidden');
}

/* ─────────────────────────────────────────────
   UI SFX  (click / close)
───────────────────────────────────────────── */
function playUiSfx(which) {
  // which = 'click' | 'close'
  const el = document.getElementById(`sfx-${which}`);
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(() => {});
}

/* ─────────────────────────────────────────────
   PIXEL-COLOUR HIT DETECTION
   Each button image (full 692×492 canvas) is
   drawn to an offscreen canvas once; on every
   mousemove we sample the pixel under the cursor
   and consider it a hit if alpha > 30.
───────────────────────────────────────────── */
const CANVAS_W = 692;
const CANVAS_H = 492;

class PixelButton {
  constructor(imgEl, action) {
    this.imgEl  = imgEl;
    this.action = action;
    this.oc  = document.createElement('canvas');
    this.oc.width  = CANVAS_W;
    this.oc.height = CANVAS_H;
    this.ctx = this.oc.getContext('2d', { willReadFrequently: true });
    this.ready = false;
    this._isHover  = false;
    this._isActive = false;

    if (imgEl.complete && imgEl.naturalWidth > 0) {
      this._draw();
    } else {
      imgEl.addEventListener('load', () => this._draw());
    }
  }

  _draw() {
    this.ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    this.ctx.drawImage(this.imgEl, 0, 0, CANVAS_W, CANVAS_H);
    this.ready = true;
  }

  /** Returns true if the mouse (in viewport coords) is over a visible pixel */
  hitTest(clientX, clientY, containerRect) {
    if (!this.ready) return false;
    const scaleX = CANVAS_W / containerRect.width;
    const scaleY = CANVAS_H / containerRect.height;
    const ix = Math.floor((clientX - containerRect.left)  * scaleX);
    const iy = Math.floor((clientY - containerRect.top)   * scaleY);
    if (ix < 0 || iy < 0 || ix >= CANVAS_W || iy >= CANVAS_H) return false;
    const alpha = this.ctx.getImageData(ix, iy, 1, 1).data[3];
    return alpha > 30;
  }

  setHover(on) {
    if (this._isHover === on) return;
    this._isHover = on;
    this.imgEl.classList.toggle('btn-hover', on);
    if (!on) this.setActive(false);
  }

  setActive(on) {
    if (this._isActive === on) return;
    this._isActive = on;
    this.imgEl.classList.toggle('btn-active', on);
  }
}

/* ─────────────────────────────────────────────
   TRUCK & TITLE HOVER  (rectangular hit divs)
───────────────────────────────────────────── */
[
  { hitId: 'hit-truck', imgId: 'menu-truck' },
  { hitId: 'hit-title', imgId: 'menu-title' },
].forEach(({ hitId, imgId }) => {
  const hit = document.getElementById(hitId);
  const img = document.getElementById(imgId);
  if (!hit || !img) return;
  hit.addEventListener('mouseenter', () => img.classList.add('btn-hover'));
  hit.addEventListener('mouseleave', () => {
    img.classList.remove('btn-hover');
    img.classList.remove('btn-active');
  });
  hit.addEventListener('mousedown', () => img.classList.add('btn-active'));
  hit.addEventListener('mouseup',   () => img.classList.remove('btn-active'));
});

const menuScreen = document.getElementById('menu-screen');

const pixelButtons = [
  new PixelButton(document.getElementById('playbtn'),     'play'),
  new PixelButton(document.getElementById('settingsbtn'), 'settings'),
  new PixelButton(document.getElementById('loadbtn'),     'load'),
];

// Shared state: which button is currently the hit target
let hitBtn = null;

menuScreen.addEventListener('mousemove', e => {
  const rect = menuScreen.getBoundingClientRect();
  let found = null;
  for (const pb of pixelButtons) {
    if (pb.hitTest(e.clientX, e.clientY, rect)) { found = pb; break; }
  }

  // Update hover states
  for (const pb of pixelButtons) {
    pb.setHover(pb === found);
  }

  menuScreen.style.cursor = found ? 'pointer' : '';
  hitBtn = found;
});

menuScreen.addEventListener('mouseleave', () => {
  for (const pb of pixelButtons) {
    pb.setHover(false);
    pb.setActive(false);
  }
  menuScreen.style.cursor = '';
  hitBtn = null;
});

menuScreen.addEventListener('mousedown', e => {
  const rect = menuScreen.getBoundingClientRect();
  for (const pb of pixelButtons) {
    pb.setActive(pb.hitTest(e.clientX, e.clientY, rect));
  }
});

menuScreen.addEventListener('mouseup', () => {
  for (const pb of pixelButtons) pb.setActive(false);
});

menuScreen.addEventListener('click', e => {
  const rect = menuScreen.getBoundingClientRect();
  for (const pb of pixelButtons) {
    if (pb.hitTest(e.clientX, e.clientY, rect)) {
      playUiSfx('click');
      if (pb.action === 'play')     startCutscene();
      if (pb.action === 'settings') showModal('settings-modal');
      if (pb.action === 'load')     { renderSaveSlots(); showModal('load-modal'); }
      break;
    }
  }
});

/* ─────────────────────────────────────────────
   SETTINGS MODAL
───────────────────────────────────────────── */
document.getElementById('settings-close').addEventListener('click', () => {
  playUiSfx('close');
  hideModal('settings-modal');
});

// Close on backdrop click
document.getElementById('settings-modal').addEventListener('click', function(e) {
  if (e.target === this) {
    playUiSfx('close');
    hideModal('settings-modal');
  }
});

// Tab switching — play click sfx
document.querySelectorAll('#settings-modal .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    playUiSfx('click');
    const tab = btn.dataset.tab;
    document.querySelectorAll('#settings-modal .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('#settings-modal .tab-content').forEach(c => {
      c.classList.toggle('hidden', c.id !== `tab-${tab}`);
    });
  });
});

// Range sliders → live value display + live apply
document.querySelectorAll('.setting-row input[type="range"]').forEach(slider => {
  const valEl = document.getElementById(`${slider.id}-val`);
  slider.addEventListener('input', () => {
    if (valEl) valEl.textContent = slider.value;
    applySettings();
  });
});

// Toggles + selects → live apply
document.querySelectorAll('.setting-row input[type="checkbox"], .setting-row select').forEach(el => {
  el.addEventListener('change', () => applySettings());
});

// Reset defaults
const SETTING_DEFAULTS = {
  'master-vol': 80,
  'music-vol':  70,
  'sfx-vol':    90,
};

document.getElementById('settings-reset').addEventListener('click', () => {
  playUiSfx('click');
  Object.entries(SETTING_DEFAULTS).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = val;
      const valEl = document.getElementById(`${id}-val`);
      if (valEl) valEl.textContent = val;
    }
  });
  // Reset toggles
  ['mute-toggle', 'high-contrast', 'autosave-toggle'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = id === 'autosave-toggle';
  });
  // Reset selects
  const textSize  = document.getElementById('text-size');   if (textSize)  textSize.value  = 'medium';
  const colorblind= document.getElementById('colorblind');  if (colorblind) colorblind.value= 'none';
  const lang      = document.getElementById('lang');        if (lang)       lang.value      = 'en';
  applySettings();
  saveSettings();
});

document.getElementById('settings-apply').addEventListener('click', () => {
  playUiSfx('close');
  saveSettings();
  hideModal('settings-modal');
});

/* ─────────────────────────────────────────────
   TRANSLATIONS
───────────────────────────────────────────── */
const TRANSLATIONS = {
  en: {
    'settings-title':  '⚙️ Settings',
    'tab-audio':        '🔊 Audio',
    'tab-accessibility':'♿ Access.',
    'tab-game':         '🐱 Game',
    'lbl-master-vol':   'Master Volume',
    'lbl-music-vol':    'Music',
    'lbl-sfx-vol':      'Sound Effects',
    'lbl-mute-toggle':  'Mute All',
    'lbl-text-size':    'Text Size',
    'lbl-colorblind':   'Colour-Blind Mode',
    'lbl-high-contrast':'High Contrast UI',
    'lbl-lang':         'Language',
    'lbl-autosave':     'Auto-Save',
    'btn-reset':        'Reset Defaults',
    'btn-apply':        'Apply',
    'load-title':       '💾 Save / Load',
    'btn-load-close':   'Close',
    'opt-small':        'Small',
    'opt-medium':       'Medium',
    'opt-large':        'Large',
    'opt-cb-none':      'None',
    'opt-cb-prot':      'Protanopia',
    'opt-cb-deut':      'Deuteranopia',
    'opt-cb-trit':      'Tritanopia',
    'opt-cb-grey':      'Greyscale',
  },
  ms: {
    'settings-title':  '⚙️ Tetapan',
    'tab-audio':        '🔊 Audio',
    'tab-accessibility':'♿ Akses.',
    'tab-game':         '🐱 Permainan',
    'lbl-master-vol':   'Kelantangan Utama',
    'lbl-music-vol':    'Muzik',
    'lbl-sfx-vol':      'Kesan Bunyi',
    'lbl-mute-toggle':  'Redam Semua',
    'lbl-text-size':    'Saiz Teks',
    'lbl-colorblind':   'Mod Buta Warna',
    'lbl-high-contrast':'UI Kontras Tinggi',
    'lbl-lang':         'Bahasa',
    'lbl-autosave':     'Simpan Auto',
    'btn-reset':        'Set Semula',
    'btn-apply':        'Guna',
    'load-title':       '💾 Simpan / Muatkan',
    'btn-load-close':   'Tutup',
    'opt-small':        'Kecil',
    'opt-medium':       'Sederhana',
    'opt-large':        'Besar',
    'opt-cb-none':      'Tiada',
    'opt-cb-prot':      'Protanopia',
    'opt-cb-deut':      'Deuteranopia',
    'opt-cb-trit':      'Tritanopia',
    'opt-cb-grey':      'Skala Kelabu',
  },
  zh: {
    'settings-title':  '⚙️ 设置',
    'tab-audio':        '🔊 音频',
    'tab-accessibility':'♿ 辅助',
    'tab-game':         '🐱 游戏',
    'lbl-master-vol':   '主音量',
    'lbl-music-vol':    '音乐',
    'lbl-sfx-vol':      '音效',
    'lbl-mute-toggle':  '静音',
    'lbl-text-size':    '文字大小',
    'lbl-colorblind':   '色盲模式',
    'lbl-high-contrast':'高对比界面',
    'lbl-lang':         '语言',
    'lbl-autosave':     '自动存档',
    'btn-reset':        '恢复默认',
    'btn-apply':        '应用',
    'load-title':       '💾 存档 / 读档',
    'btn-load-close':   '关闭',
    'opt-small':        '小',
    'opt-medium':       '中',
    'opt-large':        '大',
    'opt-cb-none':      '无',
    'opt-cb-prot':      '红色盲',
    'opt-cb-deut':      '绿色盲',
    'opt-cb-trit':      '蓝色盲',
    'opt-cb-grey':      '灰度',
  },
  ta: {
    'settings-title':  '⚙️ அமைப்புகள்',
    'tab-audio':        '🔊 ஆடியோ',
    'tab-accessibility':'♿ அணுகல்',
    'tab-game':         '🐱 விளையாட்டு',
    'lbl-master-vol':   'மாஸ்டர் ஒலி',
    'lbl-music-vol':    'இசை',
    'lbl-sfx-vol':      'ஒலி விளைவுகள்',
    'lbl-mute-toggle':  'முழு நிசப்தம்',
    'lbl-text-size':    'உரை அளவு',
    'lbl-colorblind':   'வண்ண குருட்டு பயன்முறை',
    'lbl-high-contrast':'உயர் கான்ட்ராஸ்ட் UI',
    'lbl-lang':         'மொழி',
    'lbl-autosave':     'தன்னியக்க சேமிப்பு',
    'btn-reset':        'இயல்புநிலை மீட்டமை',
    'btn-apply':        'பயன்படுத்து',
    'load-title':       '💾 சேமி / ஏற்று',
    'btn-load-close':   'மூடு',
    'opt-small':        'சிறிய',
    'opt-medium':       'நடுத்தர',
    'opt-large':        'பெரிய',
    'opt-cb-none':      'இல்லை',
    'opt-cb-prot':      'புரோட்டனோபியா',
    'opt-cb-deut':      'டியூட்ரனோபியா',
    'opt-cb-trit':      'ட்ரைட்டனோபியா',
    'opt-cb-grey':      'சாம்பல் நிறம்',
  },
};

function applyLanguage(lang) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  document.documentElement.lang = lang;

  // Translate all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key] !== undefined) el.textContent = t[key];
  });

  // Translate select options with data-i18n-opt
  document.querySelectorAll('[data-i18n-opt]').forEach(opt => {
    const key = opt.dataset.i18nOpt;
    if (t[key] !== undefined) opt.textContent = t[key];
  });
}

/* ─────────────────────────────────────────────
   APPLY SETTINGS — makes every control do
   something real in the running game
───────────────────────────────────────────── */
function applySettings() {
  // ── Volume ──────────────────────────────────
  const masterVol = (parseFloat(document.getElementById('master-vol')?.value ?? 80)) / 100;
  const musicVol  = (parseFloat(document.getElementById('music-vol') ?.value ?? 70)) / 100;
  const sfxVol    = (parseFloat(document.getElementById('sfx-vol')   ?.value ?? 90)) / 100;
  const muted     = document.getElementById('mute-toggle')?.checked ?? false;

  // Music tracks
  Object.values(SCREEN_MUSIC).forEach(track => {
    if (!track) return;
    track.volume = muted ? 0 : masterVol * musicVol;
  });

  // All SFX elements (both ui sfx and cutscene sfx)
  document.querySelectorAll('audio[id^="sfx-"]').forEach(el => {
    el.volume = muted ? 0 : masterVol * sfxVol;
  });

  // ── Language ────────────────────────────────
  const lang = document.getElementById('lang')?.value ?? 'en';
  applyLanguage(lang);

  // ── Text size ───────────────────────────────
  const textSize = document.getElementById('text-size')?.value ?? 'medium';
  document.body.classList.remove('text-small', 'text-medium', 'text-large');
  document.body.classList.add(`text-${textSize}`);

  // ── Colour-blind filter ─────────────────────
  const cb = document.getElementById('colorblind')?.value ?? 'none';
  const cbFilters = {
    none:          '',
    protanopia:    'url(#cb-protanopia)',
    deuteranopia:  'url(#cb-deuteranopia)',
    tritanopia:    'url(#cb-tritanopia)',
    achromatopsia: 'grayscale(1)',
  };
  document.getElementById('game-container').style.filter = cbFilters[cb] ?? '';

  // ── High contrast ───────────────────────────
  const hiContrast = document.getElementById('high-contrast')?.checked ?? false;
  document.body.classList.toggle('high-contrast', hiContrast);
}

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
      const valEl = document.getElementById(`${id}-val`);
      if (valEl) valEl.textContent = val;
    });
  } catch (_) {}
  applySettings();
}

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
      playUiSfx('click');
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
      playUiSfx('click');
      hideModal('load-modal');
      alert(`Loaded Slot ${i + 1}! (game world coming soon)`);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'slot-btn danger';
    delBtn.textContent = '🗑';
    delBtn.disabled = !slot;
    delBtn.addEventListener('click', () => {
      if (!slot) return;
      playUiSfx('click');
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

document.getElementById('load-close').addEventListener('click', () => {
  playUiSfx('close');
  hideModal('load-modal');
});
document.getElementById('load-close-btn').addEventListener('click', () => {
  playUiSfx('close');
  hideModal('load-modal');
});
document.getElementById('load-modal').addEventListener('click', function(e) {
  if (e.target === this) {
    playUiSfx('close');
    hideModal('load-modal');
  }
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

let csIndex     = -1;
let csAdvancing = false;

function startCutscene() {
  csIndex     = -1;
  csAdvancing = false;

  CUTSCENE_ORDER.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible');
  });

  showScreen('cutscene-screen');
  setTimeout(advanceCutscene, 400);
}

function advanceCutscene() {
  if (csAdvancing) return;
  csAdvancing = true;

  csIndex++;

  if (csIndex >= CUTSCENE_ORDER.length) {
    csAdvancing = false;
    endCutscene();
    return;
  }

  const frameId = CUTSCENE_ORDER[csIndex];
  const next = document.getElementById(frameId);
  if (next) {
    next.classList.add('visible');
    if (CUTSCENE_SFX[frameId]) playSfx(CUTSCENE_SFX[frameId]);
  } else {
    csAdvancing = false;
    advanceCutscene();
    return;
  }

  setTimeout(() => { csAdvancing = false; }, 500);
}

function endCutscene() {
  fadeToScene('scene2-screen', () => {
    CUTSCENE_ORDER.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('visible');
    });
  });
}

/* ─────────────────────────────────────────────
   SCENE TRANSITION HELPER
───────────────────────────────────────────── */
function fadeToScene(targetScreenId, swapFn) {
  const overlay = document.getElementById('scene-transition');
  overlay.classList.add('fading');
  setTimeout(() => {
    if (swapFn) swapFn();
    showScreen(targetScreenId);
    setTimeout(() => overlay.classList.remove('fading'), 80);
  }, 780);
}

// Click / keyboard advances the cutscene
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
  playUiSfx('click');
  fadeToScene('menu-screen');
});

/* ─────────────────────────────────────────────
   AUDIO — music + SFX
───────────────────────────────────────────── */

// ── Music tracks ────────────────────────────
const menuMusic   = document.getElementById('menu-music');
const scene2Music = document.getElementById('scene2-music');

const SCREEN_MUSIC = {
  'menu-screen':   menuMusic,
  'scene2-screen': scene2Music,
};

// Track which screen's music should be playing so the autoplay
// fallback can resume the *right* track after user interaction.
let _currentTrack = null;

function playTrack(audio) {
  if (!audio) return;
  _currentTrack = audio;
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Autoplay blocked — wait for any interaction then retry
    const resume = () => {
      if (_currentTrack === audio) {
        audio.play().catch(() => {});
      }
    };
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
  _currentTrack = null;
}

// Full showScreen — handles both DOM switching and per-screen music.
// Declared last so it supersedes the early stub at the top of the file.
function showScreen(id) { // eslint-disable-line no-redeclare
  _setActiveScreen(id);
  stopAllMusic();
  if (SCREEN_MUSIC[id]) playTrack(SCREEN_MUSIC[id]);
}

// Start menu music immediately on load
playTrack(menuMusic);

// ── SFX (cutscene frames) ────────────────────
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
