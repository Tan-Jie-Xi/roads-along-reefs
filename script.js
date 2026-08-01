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

  /** Returns true if the mouse (in viewport coords) is over a visible pixel.
   *  xShift / yShift compensate for a CSS transform applied to the image:
   *  when translateX(9.10%) shifts the visual rendering right by ~63px,
   *  the user clicks at canvas_x+63, so we subtract 63 to get back to the
   *  pixel coordinate where the button is drawn in the original PNG.       */
  hitTest(clientX, clientY, containerRect, xShift = 0, yShift = 0) {
    if (!this.ready) return false;
    const scaleX = CANVAS_W / containerRect.width;
    const scaleY = CANVAS_H / containerRect.height;
    const ix = Math.floor((clientX - containerRect.left)  * scaleX) - xShift;
    const iy = Math.floor((clientY - containerRect.top)   * scaleY) - yShift;
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
   SCENE 2 — desk scene  (phone on table)
───────────────────────────────────────────── */
const phoneHit = document.getElementById('hit-phone');
const phoneImg = document.getElementById('scene2-phone');

phoneHit.addEventListener('mouseenter', () => phoneImg.classList.add('btn-hover'));
phoneHit.addEventListener('mouseleave', () => {
  phoneImg.classList.remove('btn-hover');
  phoneImg.classList.remove('btn-active');
});
phoneHit.addEventListener('mousedown', () => phoneImg.classList.add('btn-active'));
phoneHit.addEventListener('mouseup',   () => phoneImg.classList.remove('btn-active'));

phoneHit.addEventListener('click', () => {
  playUiSfx('click');
  resetPhoneScene();
  fadeToScene('phone-screen');
});

/* ─────────────────────────────────────────────
   PHONE SCENE — dial-pad state machine
───────────────────────────────────────────── */
const CORRECT_NUMBER  = '01167023154';   // 011-6702-3154
const PHONE_SFX_COUNT = 5;
const MAX_PHONE_INPUT = 11;              // length of correct number

let phoneState       = 'dialing';        // 'dialing' | 'calling' | 'ringing'
let phoneInput       = '';
let lastPhoneSfxIdx  = -1;
let phoneRingTimer   = null;

// ── Button definitions ─────────────────────
const PHONE_BTN_DEFS = [
  { key:'1', id:'pbtn-1'    },
  { key:'2', id:'pbtn-2'    },
  { key:'3', id:'pbtn-3'    },
  { key:'4', id:'pbtn-4'    },
  { key:'5', id:'pbtn-5'    },
  { key:'6', id:'pbtn-6'    },
  { key:'7', id:'pbtn-7'    },
  { key:'8', id:'pbtn-8'    },
  { key:'9', id:'pbtn-9'    },
  { key:'backspace', id:'pbtn-star' },
  { key:'0', id:'pbtn-0'    },
  { key:'#', id:'pbtn-hash' },
  { key:'call', id:'pbtn-call' },
];

// Build PixelButton instances for every phone button
const phonePixelBtns = PHONE_BTN_DEFS.map(def => {
  const img = document.getElementById(def.id);
  const pb  = new PixelButton(img, def.key);
  return pb;
});

// ── Helpers ────────────────────────────────
function formatPhoneDisplay(digits) {
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return digits.slice(0,3) + '-' + digits.slice(3);
  return digits.slice(0,3) + '-' + digits.slice(3,7) + '-' + digits.slice(7);
}

function updatePhoneDisplay() {
  const el = document.getElementById('phone-display');
  if (el) el.textContent = formatPhoneDisplay(phoneInput);
}

function setPhoneState(state) {
  phoneState = state;
  const dialEl   = document.getElementById('phone-dialing');
  const callEl   = document.getElementById('phone-calling');
  const ringEl   = document.getElementById('phone-ringing');
  const dispEl   = document.getElementById('phone-display');
  const inDialing = state === 'dialing';

  dialEl.style.display = state === 'dialing'  ? '' : 'none';
  callEl.style.display  = state === 'calling'  ? '' : 'none';
  ringEl.style.display  = state === 'ringing'  ? '' : 'none';

  document.querySelectorAll('.phone-btn-img').forEach(el => {
    el.style.display = inDialing ? '' : 'none';
  });
  if (dispEl) dispEl.style.display = inDialing ? '' : 'none';
}

function resetPhoneScene() {
  if (phoneRingTimer) { clearTimeout(phoneRingTimer); phoneRingTimer = null; }
  phoneInput      = '';
  lastPhoneSfxIdx = -1;
  setPhoneState('dialing');
  updatePhoneDisplay();
  // Silence any lingering ring
  const ringSfx = document.getElementById('sfx-phone-ring');
  if (ringSfx) { ringSfx.pause(); ringSfx.currentTime = 0; }
}

function playPhoneKeySfx() {
  let idx;
  do { idx = Math.floor(Math.random() * PHONE_SFX_COUNT) + 1; }
  while (idx === lastPhoneSfxIdx && PHONE_SFX_COUNT > 1);
  lastPhoneSfxIdx = idx;
  const el = document.getElementById(`sfx-phonesfx${idx}`);
  if (el) { el.currentTime = 0; el.play().catch(() => {}); }
}

function handlePhoneKey(key) {
  if (phoneState !== 'dialing') return;

  if (key === 'call') {
    if (phoneInput !== CORRECT_NUMBER) return;   // wrong number — no response
    // Correct! → calling → ringing → fade to black when ring ends
    setPhoneState('calling');
    phoneRingTimer = setTimeout(() => {
      setPhoneState('ringing');
      const ringSfx = document.getElementById('sfx-phone-ring');
      if (ringSfx) {
        ringSfx.currentTime = 0;
        ringSfx.play().catch(() => {});
        // Show dialogue once the ring sound finishes
        ringSfx.addEventListener('ended', () => {
          showDialogue();
        }, { once: true });
      }
    }, 1600);
    return;
  }

  // Backspace key (mapped to * button)
  if (key === 'backspace') {
    if (phoneInput.length === 0) return;
    phoneInput = phoneInput.slice(0, -1);
    updatePhoneDisplay();
    return;
  }

  // Digit / symbol key
  if (phoneInput.length >= MAX_PHONE_INPUT) return;
  phoneInput += key;
  updatePhoneDisplay();
  playPhoneKeySfx();
}

// ── Phone-screen mouse/click routing ──────
const phoneScreen = document.getElementById('phone-screen');

// X shift of 63px corrects the translateX(9.10%) CSS offset on .phone-btn-img
const PHONE_BTN_XSHIFT = 63;

phoneScreen.addEventListener('mousemove', e => {
  if (phoneState !== 'dialing') {
    phoneScreen.style.cursor = '';
    return;
  }
  const rect  = phoneScreen.getBoundingClientRect();
  let   found = null;
  for (const pb of phonePixelBtns) {
    if (pb.hitTest(e.clientX, e.clientY, rect, PHONE_BTN_XSHIFT)) { found = pb; break; }
  }
  for (const pb of phonePixelBtns) pb.setHover(pb === found);
  phoneScreen.style.cursor = found ? 'pointer' : '';
});

phoneScreen.addEventListener('mouseleave', () => {
  for (const pb of phonePixelBtns) { pb.setHover(false); pb.setActive(false); }
  phoneScreen.style.cursor = '';
});

phoneScreen.addEventListener('mousedown', e => {
  if (phoneState !== 'dialing') return;
  const rect = phoneScreen.getBoundingClientRect();
  for (const pb of phonePixelBtns) {
    pb.setActive(pb.hitTest(e.clientX, e.clientY, rect, PHONE_BTN_XSHIFT));
  }
});

phoneScreen.addEventListener('mouseup', () => {
  for (const pb of phonePixelBtns) pb.setActive(false);
});

phoneScreen.addEventListener('click', e => {
  if (phoneState !== 'dialing') return;
  const rect = phoneScreen.getBoundingClientRect();
  for (const pb of phonePixelBtns) {
    if (pb.hitTest(e.clientX, e.clientY, rect, PHONE_BTN_XSHIFT)) {
      handlePhoneKey(pb.action);
      break;
    }
  }
});

/* ─────────────────────────────────────────────
   DIALOGUE SYSTEM — phone-call cutscene
   Triggered after the ring sound ends.
   Click the box to skip/advance; after the last
   line the scene fades to black.
───────────────────────────────────────────── */
const DIALOGUE_LINES = [
  "Hello! FoodTruck Company here! If you are calling this number, I assume that you have seen our food truck advertisement.",
  "Now, I'll spare you the boring formalities. Let's get straight to picking out a truck for your dream business!",
];

const TYPEWRITER_MS = 32;   // ms between characters

let _dlgLineIdx  = 0;
let _dlgCharIdx  = 0;
let _dlgTyping   = false;
let _dlgTimer    = null;

function showDialogue() {
  _dlgLineIdx = 0;
  const overlay = document.getElementById('dialogue-overlay');
  overlay.classList.remove('hidden');
  // Clicking anywhere on the box advances / skips
  document.getElementById('dialogue-box-wrap')
    .addEventListener('click', advanceDialogue);
  // Cursor should show as "point" over the box — tell the screen element
  phoneScreen.style.cursor = 'pointer';
  _typeDialogueLine(DIALOGUE_LINES[0]);
}

function _typeDialogueLine(text) {
  const el = document.getElementById('dialogue-text');
  el.textContent = '';
  _dlgCharIdx = 0;
  _dlgTyping  = true;

  (function tick() {
    if (_dlgCharIdx < text.length) {
      el.textContent += text[_dlgCharIdx++];
      _dlgTimer = setTimeout(tick, TYPEWRITER_MS);
    } else {
      _dlgTyping = false;
      _dlgTimer  = null;
    }
  }());
}

function advanceDialogue() {
  if (_dlgTyping) {
    // Skip to end of current line instantly
    clearTimeout(_dlgTimer);
    _dlgTimer  = null;
    _dlgTyping = false;
    document.getElementById('dialogue-text').textContent =
      DIALOGUE_LINES[_dlgLineIdx];
    return;
  }

  _dlgLineIdx++;
  if (_dlgLineIdx < DIALOGUE_LINES.length) {
    _typeDialogueLine(DIALOGUE_LINES[_dlgLineIdx]);
  } else {
    // All lines done — hide box, fade to truck selection
    document.getElementById('dialogue-overlay').classList.add('hidden');
    document.getElementById('dialogue-box-wrap')
      .removeEventListener('click', advanceDialogue);
    phoneScreen.style.cursor = '';
    fadeToScene('truck-select-screen', initTruckSelection);
  }
}

/* ─────────────────────────────────────────────
   AUDIO — music + SFX
───────────────────────────────────────────── */

// ── Music tracks ────────────────────────────
const menuMusic   = document.getElementById('menu-music');
const scene2Music = document.getElementById('scene2-music');

const SCREEN_MUSIC = {
  'menu-screen':        menuMusic,
  'scene2-screen':      scene2Music,
  'phone-screen':       scene2Music,
  'truck-select-screen': scene2Music,  // continues from phone scene uninterrupted
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
// Skips restarting the track if the same one is already playing
// (e.g. scene2 → phone-screen both use scene2Music).
function showScreen(id) { // eslint-disable-line no-redeclare
  _setActiveScreen(id);
  const newTrack = SCREEN_MUSIC[id] || null;
  if (newTrack !== _currentTrack) {
    stopAllMusic();
    if (newTrack) playTrack(newTrack);
  }
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
   CUSTOM CURSOR
   neutral → default, point → hovering something
   clickable, grab → briefly on mousedown.
───────────────────────────────────────────── */
(function () {
  const cursorEl      = document.getElementById('custom-cursor');
  const cursorImg     = document.getElementById('cursor-img');
  const gameContainer = document.getElementById('game-container');

  const CURSORS = {
    neutral: 'assets/pointer/neutral.png',
    point:   'assets/pointer/point.png',
    grab:    'assets/pointer/grab.png',
  };

  // Preload all three so swaps are instant
  Object.values(CURSORS).forEach(src => { const img = new Image(); img.src = src; });

  let _state     = 'neutral';
  let _grabTimer = null;
  let _lastX     = 0;
  let _lastY     = 0;

  function setState(s) {
    if (_state === s) return;
    _state = s;
    cursorImg.src = CURSORS[s];
  }

  /** Returns true if the element (or any ancestor) would normally show a pointer. */
  function isPointerTarget(el) {
    // cursor:none !important is forced everywhere, so getComputedStyle always
    // returns 'none'. Check element types, classes, and id patterns instead.
    while (el && el !== document.documentElement) {
      const tag = el.tagName;
      if (tag === 'BUTTON' || tag === 'A' || tag === 'SELECT' ||
          tag === 'INPUT'  || tag === 'LABEL') return true;
      const cl = el.classList;
      if (cl.contains('menu-hit')    || cl.contains('close-btn')  ||
          cl.contains('tab-btn')     || cl.contains('footer-btn') ||
          cl.contains('save-slot')   || cl.contains('slot-btn')   ||
          cl.contains('toggle-switch')) return true;
      // Catch all invisible hit-area divs (hit-phone, hit-truck, hit-title, …)
      if (el.id && el.id.startsWith('hit-')) return true;
      // Dialogue box is clickable when visible
      if (el.id === 'dialogue-box-wrap') return true;
      el = el.parentElement;
    }
    return false;
  }

  /** Returns true if any modal overlay is currently visible. */
  function isModalOpen() {
    return !!document.querySelector('.modal-overlay:not(.hidden)');
  }

  /** True when the mouse is inside the game container rect. */
  function isOverGame(cx, cy) {
    const r = gameContainer.getBoundingClientRect();
    return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  }

  /** Decide neutral vs point for the current mouse position. */
  function resolveHoverState(clientX, clientY) {
    // Pixel buttons set an inline style on the active screen element
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen && activeScreen.style.cursor === 'pointer') return 'point';

    const el = document.elementFromPoint(clientX, clientY);
    if (el && isPointerTarget(el)) return 'point';

    return 'neutral';
  }

  document.addEventListener('mousemove', e => {
    _lastX = e.clientX;
    _lastY = e.clientY;

    // Show cursor only over the game window or an open modal
    if (!isOverGame(e.clientX, e.clientY) && !isModalOpen()) {
      cursorEl.style.display = 'none';
      return;
    }

    // Position: fixed element — clientX/Y map directly to viewport coords
    cursorEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    cursorEl.style.display   = 'block';

    if (_grabTimer) return;
    setState(resolveHoverState(e.clientX, e.clientY));
  });

  document.addEventListener('mouseleave', () => {
    cursorEl.style.display = 'none';
  });

  // Flash grab on any click inside game or modal
  document.addEventListener('mousedown', e => {
    if (!isOverGame(e.clientX, e.clientY) && !isModalOpen()) return;
    if (_grabTimer) clearTimeout(_grabTimer);
    setState('grab');
    _grabTimer = setTimeout(() => {
      _grabTimer = null;
      setState(resolveHoverState(_lastX, _lastY));
    }, 140);
  });
}());

/* ─────────────────────────────────────────────
   TRUCK SELECTION SCENE
───────────────────────────────────────────── */
const TS_TEXTS = {
  eco:    'Electric vehicles eliminate loud generator noise and toxic exhaust fumes, enabling food trucks to operate quietly and cleanly right next to customers.',
  diesel: 'Diesel-powered food trucks emit high levels of toxic particulate matter and create constant loud engine noise, which can drive customers away and further pollute the environment.',
};

let _tsTruck     = 'eco';   // 'eco' | 'diesel'
let _tsSwitching = false;
let _tsTyping    = false;
let _tsTimer     = null;
let _tsCharIdx   = 0;

// ── Hit-area position tables ────────────────
const TS_HITS = {
  eco:    { textLeft: '4%',  textWidth: '40%', arrowLeft: '44%', arrowWidth: '6%'  },
  diesel: { textLeft: '5%',  textWidth: '40%', arrowLeft: '1%',  arrowWidth: '5%'  },
};

function _tsUpdateHits() {
  const h = TS_HITS[_tsTruck];
  const th = document.getElementById('hit-ts-text');
  const ah = document.getElementById('hit-ts-arrow');
  th.style.left  = h.textLeft;   th.style.width  = h.textWidth;
  ah.style.left  = h.arrowLeft;  ah.style.width  = h.arrowWidth;
}

// ── Clipboard typewriter ─────────────────────
function _tsType(text) {
  if (_tsTimer) { clearTimeout(_tsTimer); _tsTimer = null; }
  _tsTyping  = false;
  _tsCharIdx = 0;
  const el = document.getElementById('ts-clipboard-text');
  el.textContent = '';
  _tsTyping = true;
  (function tick() {
    if (_tsCharIdx < text.length) {
      el.textContent += text[_tsCharIdx++];
      _tsTimer = setTimeout(tick, 28);
    } else {
      _tsTyping = false;
      _tsTimer  = null;
    }
  }());
}

// ── Slide animation ──────────────────────────
function tsSwitchTruck() {
  if (_tsSwitching) return;
  _tsSwitching = true;

  const ecoEl    = document.getElementById('ts-eco-truck');
  const dieselEl = document.getElementById('ts-diesel-truck');
  const nameImg  = document.getElementById('ts-name-img');
  const label    = document.getElementById('ts-truck-label');

  const toDiesel = _tsTruck === 'eco';
  const outEl    = toDiesel ? ecoEl    : dieselEl;
  const inEl     = toDiesel ? dieselEl : ecoEl;
  const exitX    = toDiesel ? '-30%'   : '30%';
  const enterX   = toDiesel ? '30%'    : '-30%';

  // Slide out current truck
  outEl.style.transform = `translateX(${exitX})`;
  outEl.style.opacity   = '0';

  // Place incoming truck off-screen instantly (no transition)
  inEl.style.transition = 'none';
  inEl.style.transform  = `translateX(${enterX})`;
  inEl.style.opacity    = '0';
  inEl.style.display    = 'block';   // must be explicit — CSS default is 'none' for diesel
  // Force reflow, then re-enable transition and animate in
  inEl.getBoundingClientRect();
  inEl.style.transition = '';
  inEl.style.transform  = '';
  inEl.style.opacity    = '1';

  setTimeout(() => {
    outEl.style.display   = 'none';
    outEl.style.transform = '';
    outEl.style.opacity   = '1';
    _tsTruck = toDiesel ? 'diesel' : 'eco';
    nameImg.src             = `assets/truck_selection/${_tsTruck === 'eco' ? 'eco' : 'diesel'}truck_name.png`;
    label.textContent       = _tsTruck === 'eco' ? 'Electric' : 'Diesel';
    _tsUpdateHits();
    _tsType(TS_TEXTS[_tsTruck]);
    _tsSwitching = false;
  }, 450);
}

// ── Initialise the scene ─────────────────────
function initTruckSelection() {
  _tsTruck     = 'eco';
  _tsSwitching = false;

  const ecoEl    = document.getElementById('ts-eco-truck');
  const dieselEl = document.getElementById('ts-diesel-truck');

  // Reset eco truck to visible, diesel hidden
  [ecoEl, dieselEl].forEach(el => {
    el.style.transition = 'none';
    el.style.transform  = '';
    el.style.opacity    = '1';
  });
  ecoEl.style.display    = '';
  dieselEl.style.display = 'none';
  // Re-enable transitions after reset
  ecoEl.getBoundingClientRect();
  ecoEl.style.transition    = '';
  dieselEl.style.transition = '';

  document.getElementById('ts-name-img').src      = 'assets/truck_selection/ecotruck_name.png';
  document.getElementById('ts-truck-label').textContent = 'Electric';
  _tsUpdateHits();
  _tsType(TS_TEXTS.eco);
}

// ── Select / confirm truck ───────────────────
function tsSelectTruck() {
  playUiSfx('click');
  const modal = document.getElementById('truck-confirm-modal');
  const msg   = document.getElementById('truck-confirm-msg');
  const btns  = document.getElementById('truck-confirm-btns');

  btns.innerHTML = '';
  btns.style.justifyContent = '';

  if (_tsTruck === 'eco') {
    msg.textContent = "Great choice! You've helped reduce your food truck's carbon footprint!";

    const noBtn  = document.createElement('button');
    noBtn.className  = 'footer-btn';
    noBtn.textContent = 'No';
    noBtn.addEventListener('click', () => { playUiSfx('close'); hideModal('truck-confirm-modal'); });

    const yesBtn = document.createElement('button');
    yesBtn.className  = 'footer-btn primary';
    yesBtn.textContent = 'Yes';
    yesBtn.addEventListener('click', () => {
      playUiSfx('click');
      hideModal('truck-confirm-modal');
      // Fade to black — end of selection
      const overlay = document.getElementById('scene-transition');
      overlay.classList.add('fading');
    });

    btns.append(noBtn, yesBtn);
  } else {
    msg.textContent = "Hmm, that doesn't seem like a good option. Why not try choosing the more eco-friendly truck?";
    btns.style.justifyContent = 'center';

    const okBtn = document.createElement('button');
    okBtn.className   = 'footer-btn primary';
    okBtn.textContent = 'OK';
    okBtn.addEventListener('click', () => { playUiSfx('close'); hideModal('truck-confirm-modal'); });

    btns.append(okBtn);
  }

  showModal('truck-confirm-modal');
}

// ── Event listeners ──────────────────────────
document.getElementById('hit-ts-text').addEventListener('click',  () => tsSelectTruck());
document.getElementById('hit-ts-arrow').addEventListener('click', () => { playUiSfx('click'); tsSwitchTruck(); });

// Hover feedback — brighten/dim the name image
(function () {
  const nameImg = document.getElementById('ts-name-img');
  ['hit-ts-text', 'hit-ts-arrow'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('mouseenter', () => { nameImg.style.filter = 'brightness(0.82)'; });
    el.addEventListener('mouseleave', () => { nameImg.style.filter = ''; });
    el.addEventListener('mousedown',  () => { nameImg.style.filter = 'brightness(0.6)'; });
    el.addEventListener('mouseup',    () => { nameImg.style.filter = 'brightness(0.82)'; });
  });
}());

/* ─────────────────────────────────────────────
   INITIALISE
───────────────────────────────────────────── */
loadSettings();
