/* ═══════════════════════════════════════════════
   Roads Along Reefs — Main Script
   Screens: main-menu → cutscene → (game)
═══════════════════════════════════════════════ */

"use strict";

/* ─────────────────────────────────────────────
   SCREEN HELPERS
───────────────────────────────────────────── */
function _setActiveScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => {
    s.classList.toggle("active", s.id === id);
    s.classList.toggle("hidden", s.id !== id);
  });
}

// showScreen is defined once below, after SCREEN_MUSIC is declared,
// so it can also manage music. Forward-declare a stub so early callers work.
function showScreen(id) {
  _setActiveScreen(id);
}

function showModal(id) {
  document.getElementById(id).classList.remove("hidden");
}

function hideModal(id) {
  document.getElementById(id).classList.add("hidden");
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
    this.imgEl = imgEl;
    this.action = action;
    this.oc = document.createElement("canvas");
    this.oc.width = CANVAS_W;
    this.oc.height = CANVAS_H;
    this.ctx = this.oc.getContext("2d", { willReadFrequently: true });
    this.ready = false;
    this._isHover = false;
    this._isActive = false;

    if (imgEl.complete && imgEl.naturalWidth > 0) {
      this._draw();
    } else {
      imgEl.addEventListener("load", () => this._draw());
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
    const ix = Math.floor((clientX - containerRect.left) * scaleX) - xShift;
    const iy = Math.floor((clientY - containerRect.top) * scaleY) - yShift;
    if (ix < 0 || iy < 0 || ix >= CANVAS_W || iy >= CANVAS_H) return false;
    const alpha = this.ctx.getImageData(ix, iy, 1, 1).data[3];
    return alpha > 30;
  }

  setHover(on) {
    if (this._isHover === on) return;
    this._isHover = on;
    this.imgEl.classList.toggle("btn-hover", on);
    if (!on) this.setActive(false);
  }

  setActive(on) {
    if (this._isActive === on) return;
    this._isActive = on;
    this.imgEl.classList.toggle("btn-active", on);
  }
}

/* ─────────────────────────────────────────────
   TRUCK & TITLE HOVER  (rectangular hit divs)
───────────────────────────────────────────── */
[
  { hitId: "hit-truck", imgId: "menu-truck" },
  { hitId: "hit-title", imgId: "menu-title" },
].forEach(({ hitId, imgId }) => {
  const hit = document.getElementById(hitId);
  const img = document.getElementById(imgId);
  if (!hit || !img) return;
  hit.addEventListener("mouseenter", () => img.classList.add("btn-hover"));
  hit.addEventListener("mouseleave", () => {
    img.classList.remove("btn-hover");
    img.classList.remove("btn-active");
  });
  hit.addEventListener("mousedown", () => img.classList.add("btn-active"));
  hit.addEventListener("mouseup", () => img.classList.remove("btn-active"));
});

const menuScreen = document.getElementById("menu-screen");

const pixelButtons = [
  new PixelButton(document.getElementById("playbtn"), "play"),
  new PixelButton(document.getElementById("settingsbtn"), "settings"),
  new PixelButton(document.getElementById("loadbtn"), "load"),
];

// Shared state: which button is currently the hit target
let hitBtn = null;

menuScreen.addEventListener("mousemove", (e) => {
  const rect = menuScreen.getBoundingClientRect();
  let found = null;
  for (const pb of pixelButtons) {
    if (pb.hitTest(e.clientX, e.clientY, rect)) {
      found = pb;
      break;
    }
  }

  // Update hover states
  for (const pb of pixelButtons) {
    pb.setHover(pb === found);
  }

  menuScreen.style.cursor = found ? "pointer" : "";
  hitBtn = found;
});

menuScreen.addEventListener("mouseleave", () => {
  for (const pb of pixelButtons) {
    pb.setHover(false);
    pb.setActive(false);
  }
  menuScreen.style.cursor = "";
  hitBtn = null;
});

menuScreen.addEventListener("mousedown", (e) => {
  const rect = menuScreen.getBoundingClientRect();
  for (const pb of pixelButtons) {
    pb.setActive(pb.hitTest(e.clientX, e.clientY, rect));
  }
});

menuScreen.addEventListener("mouseup", () => {
  for (const pb of pixelButtons) pb.setActive(false);
});

menuScreen.addEventListener("click", (e) => {
  const rect = menuScreen.getBoundingClientRect();
  for (const pb of pixelButtons) {
    if (pb.hitTest(e.clientX, e.clientY, rect)) {
      playUiSfx("click");
      if (pb.action === "play") startCutscene();
      if (pb.action === "settings") showModal("settings-modal");
      if (pb.action === "load") {
        renderSaveSlots();
        showModal("load-modal");
      }
      break;
    }
  }
});

/* ─────────────────────────────────────────────
   SETTINGS MODAL
───────────────────────────────────────────── */
document.getElementById("settings-close").addEventListener("click", () => {
  playUiSfx("close");
  hideModal("settings-modal");
});

// Close on backdrop click
document
  .getElementById("settings-modal")
  .addEventListener("click", function (e) {
    if (e.target === this) {
      playUiSfx("close");
      hideModal("settings-modal");
    }
  });

// Tab switching — play click sfx
document.querySelectorAll("#settings-modal .tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    playUiSfx("click");
    const tab = btn.dataset.tab;
    document
      .querySelectorAll("#settings-modal .tab-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll("#settings-modal .tab-content").forEach((c) => {
      c.classList.toggle("hidden", c.id !== `tab-${tab}`);
    });
  });
});

// Range sliders → live value display + live apply
document
  .querySelectorAll('.setting-row input[type="range"]')
  .forEach((slider) => {
    const valEl = document.getElementById(`${slider.id}-val`);
    slider.addEventListener("input", () => {
      if (valEl) valEl.textContent = slider.value;
      applySettings();
    });
  });

// Toggles + selects → live apply
document
  .querySelectorAll('.setting-row input[type="checkbox"], .setting-row select')
  .forEach((el) => {
    el.addEventListener("change", () => applySettings());
  });

// Reset defaults
const SETTING_DEFAULTS = {
  "master-vol": 80,
  "music-vol": 70,
  "sfx-vol": 90,
};

document.getElementById("settings-reset").addEventListener("click", () => {
  playUiSfx("click");
  Object.entries(SETTING_DEFAULTS).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = val;
      const valEl = document.getElementById(`${id}-val`);
      if (valEl) valEl.textContent = val;
    }
  });
  // Reset toggles
  ["mute-toggle", "high-contrast", "autosave-toggle"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = id === "autosave-toggle";
  });
  // Reset selects
  const textSize = document.getElementById("text-size");
  if (textSize) textSize.value = "medium";
  const colorblind = document.getElementById("colorblind");
  if (colorblind) colorblind.value = "none";
  const lang = document.getElementById("lang");
  if (lang) lang.value = "en";
  applySettings();
  saveSettings();
});

document.getElementById("settings-apply").addEventListener("click", () => {
  playUiSfx("close");
  saveSettings();
  hideModal("settings-modal");
});

/* ─────────────────────────────────────────────
   TRANSLATIONS
───────────────────────────────────────────── */
const TRANSLATIONS = {
  en: {
    "settings-title": "⚙️ Settings",
    "tab-audio": "🔊 Audio",
    "tab-accessibility": "♿ Access.",
    "tab-game": "🐱 Game",
    "lbl-master-vol": "Master Volume",
    "lbl-music-vol": "Music",
    "lbl-sfx-vol": "Sound Effects",
    "lbl-mute-toggle": "Mute All",
    "lbl-text-size": "Text Size",
    "lbl-colorblind": "Colour-Blind Mode",
    "lbl-high-contrast": "High Contrast UI",
    "lbl-lang": "Language",
    "lbl-autosave": "Auto-Save",
    "btn-reset": "Reset Defaults",
    "btn-apply": "Apply",
    "load-title": "💾 Save / Load",
    "btn-load-close": "Close",
    "opt-small": "Small",
    "opt-medium": "Medium",
    "opt-large": "Large",
    "opt-cb-none": "None",
    "opt-cb-prot": "Protanopia",
    "opt-cb-deut": "Deuteranopia",
    "opt-cb-trit": "Tritanopia",
    "opt-cb-grey": "Greyscale",
  },
  ms: {
    "settings-title": "⚙️ Tetapan",
    "tab-audio": "🔊 Audio",
    "tab-accessibility": "♿ Akses.",
    "tab-game": "🐱 Permainan",
    "lbl-master-vol": "Kelantangan Utama",
    "lbl-music-vol": "Muzik",
    "lbl-sfx-vol": "Kesan Bunyi",
    "lbl-mute-toggle": "Redam Semua",
    "lbl-text-size": "Saiz Teks",
    "lbl-colorblind": "Mod Buta Warna",
    "lbl-high-contrast": "UI Kontras Tinggi",
    "lbl-lang": "Bahasa",
    "lbl-autosave": "Simpan Auto",
    "btn-reset": "Set Semula",
    "btn-apply": "Guna",
    "load-title": "💾 Simpan / Muatkan",
    "btn-load-close": "Tutup",
    "opt-small": "Kecil",
    "opt-medium": "Sederhana",
    "opt-large": "Besar",
    "opt-cb-none": "Tiada",
    "opt-cb-prot": "Protanopia",
    "opt-cb-deut": "Deuteranopia",
    "opt-cb-trit": "Tritanopia",
    "opt-cb-grey": "Skala Kelabu",
  },
  zh: {
    "settings-title": "⚙️ 设置",
    "tab-audio": "🔊 音频",
    "tab-accessibility": "♿ 辅助",
    "tab-game": "🐱 游戏",
    "lbl-master-vol": "主音量",
    "lbl-music-vol": "音乐",
    "lbl-sfx-vol": "音效",
    "lbl-mute-toggle": "静音",
    "lbl-text-size": "文字大小",
    "lbl-colorblind": "色盲模式",
    "lbl-high-contrast": "高对比界面",
    "lbl-lang": "语言",
    "lbl-autosave": "自动存档",
    "btn-reset": "恢复默认",
    "btn-apply": "应用",
    "load-title": "💾 存档 / 读档",
    "btn-load-close": "关闭",
    "opt-small": "小",
    "opt-medium": "中",
    "opt-large": "大",
    "opt-cb-none": "无",
    "opt-cb-prot": "红色盲",
    "opt-cb-deut": "绿色盲",
    "opt-cb-trit": "蓝色盲",
    "opt-cb-grey": "灰度",
  },
  ta: {
    "settings-title": "⚙️ அமைப்புகள்",
    "tab-audio": "🔊 ஆடியோ",
    "tab-accessibility": "♿ அணுகல்",
    "tab-game": "🐱 விளையாட்டு",
    "lbl-master-vol": "மாஸ்டர் ஒலி",
    "lbl-music-vol": "இசை",
    "lbl-sfx-vol": "ஒலி விளைவுகள்",
    "lbl-mute-toggle": "முழு நிசப்தம்",
    "lbl-text-size": "உரை அளவு",
    "lbl-colorblind": "வண்ண குருட்டு பயன்முறை",
    "lbl-high-contrast": "உயர் கான்ட்ராஸ்ட் UI",
    "lbl-lang": "மொழி",
    "lbl-autosave": "தன்னியக்க சேமிப்பு",
    "btn-reset": "இயல்புநிலை மீட்டமை",
    "btn-apply": "பயன்படுத்து",
    "load-title": "💾 சேமி / ஏற்று",
    "btn-load-close": "மூடு",
    "opt-small": "சிறிய",
    "opt-medium": "நடுத்தர",
    "opt-large": "பெரிய",
    "opt-cb-none": "இல்லை",
    "opt-cb-prot": "புரோட்டனோபியா",
    "opt-cb-deut": "டியூட்ரனோபியா",
    "opt-cb-trit": "ட்ரைட்டனோபியா",
    "opt-cb-grey": "சாம்பல் நிறம்",
  },
};

function applyLanguage(lang) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  document.documentElement.lang = lang;

  // Translate all data-i18n elements
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (t[key] !== undefined) el.textContent = t[key];
  });

  // Translate select options with data-i18n-opt
  document.querySelectorAll("[data-i18n-opt]").forEach((opt) => {
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
  const masterVol =
    parseFloat(document.getElementById("master-vol")?.value ?? 80) / 100;
  const musicVol =
    parseFloat(document.getElementById("music-vol")?.value ?? 70) / 100;
  const sfxVol =
    parseFloat(document.getElementById("sfx-vol")?.value ?? 90) / 100;
  const muted = document.getElementById("mute-toggle")?.checked ?? false;

  // Music tracks
  Object.values(SCREEN_MUSIC).forEach((track) => {
    if (!track) return;
    track.volume = muted ? 0 : masterVol * musicVol;
  });

  // All SFX elements (both ui sfx and cutscene sfx)
  document.querySelectorAll('audio[id^="sfx-"]').forEach((el) => {
    el.volume = muted ? 0 : masterVol * sfxVol;
  });

  // ── Language ────────────────────────────────
  const lang = document.getElementById("lang")?.value ?? "en";
  applyLanguage(lang);

  // ── Text size ───────────────────────────────
  const textSize = document.getElementById("text-size")?.value ?? "medium";
  document.body.classList.remove("text-small", "text-medium", "text-large");
  document.body.classList.add(`text-${textSize}`);

  // ── Colour-blind filter ─────────────────────
  const cb = document.getElementById("colorblind")?.value ?? "none";
  const cbFilters = {
    none: "",
    protanopia: "url(#cb-protanopia)",
    deuteranopia: "url(#cb-deuteranopia)",
    tritanopia: "url(#cb-tritanopia)",
    achromatopsia: "grayscale(1)",
  };
  document.getElementById("game-container").style.filter = cbFilters[cb] ?? "";

  // ── High contrast ───────────────────────────
  const hiContrast = document.getElementById("high-contrast")?.checked ?? false;
  document.body.classList.toggle("high-contrast", hiContrast);
}

function saveSettings() {
  const data = {};
  document
    .querySelectorAll("#settings-modal input, #settings-modal select")
    .forEach((el) => {
      data[el.id] = el.type === "checkbox" ? el.checked : el.value;
    });
  try {
    localStorage.setItem("rar_settings", JSON.stringify(data));
  } catch (_) {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem("rar_settings");
    if (!raw) return;
    const data = JSON.parse(raw);
    Object.entries(data).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === "checkbox") {
        el.checked = val;
      } else {
        el.value = val;
      }
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
    return JSON.parse(localStorage.getItem("rar_saves") || "[]");
  } catch (_) {
    return [];
  }
}

function writeSaveSlots(slots) {
  try {
    localStorage.setItem("rar_saves", JSON.stringify(slots));
  } catch (_) {}
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getGameSaveSnapshot(dayOverride = dayNumber, overrides = {}) {
  return {
    day: dayOverride,
    savedAt: new Date().toISOString(),
    money,
    ingredients: { ...ingredientStock },
    totalCustomersServed,
    totalSatisfied,
    totalAngry,
    totalEarned,
    dayEarned: overrides.dayEarned ?? dayEarned,
    daySpent: overrides.daySpent ?? daySpent,
    supplierChosen,
  };
}

function saveGameToSlot(slotIndex, dayOverride = dayNumber, overrides = {}) {
  const slots = getSaveSlots();
  slots[slotIndex] = getGameSaveSnapshot(dayOverride, overrides);
  writeSaveSlots(slots);
  return slots[slotIndex];
}

function loadGameFromSlot(slot) {
  if (!slot) return;
  money = Number(slot.money) || 0;
  totalCustomersServed = Number(slot.totalCustomersServed) || 0;
  totalSatisfied = Number(slot.totalSatisfied) || 0;
  totalAngry = Number(slot.totalAngry) || 0;
  totalEarned = Number(slot.totalEarned) || 0;
  supplierChosen = slot.supplierChosen !== false;
  initIngredientStock();
  Object.assign(ingredientStock, slot.ingredients || {});
  updateMoneyHud();
  updateEggSprite();
  dayNumber = Math.max(1, Number(slot.day) || 1);
  hideModal("load-modal");
  startDayIntro(dayNumber);
}

function renderSaveSlots() {
  const slots = getSaveSlots();
  const container = document.getElementById("save-slots-container");
  container.innerHTML = "";

  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot = slots[i] || null;
    const div = document.createElement("div");
    div.className = "save-slot";

    const numEl = document.createElement("div");
    numEl.className = "slot-number";
    numEl.textContent = `Slot ${i + 1}`;

    const infoEl = document.createElement("div");
    infoEl.className = "slot-info";
    infoEl.textContent = slot
      ? `Day ${slot.day || 1} · ${formatDate(slot.savedAt)}`
      : "Empty";

    const btnsEl = document.createElement("div");
    btnsEl.className = "slot-btns";

    const saveBtn = document.createElement("button");
    saveBtn.className = "slot-btn";
    saveBtn.textContent = "💾 Save";
    saveBtn.addEventListener("click", () => {
      playUiSfx("click");
      saveGameToSlot(i);
      renderSaveSlots();
    });

    const loadBtn = document.createElement("button");
    loadBtn.className = "slot-btn";
    loadBtn.textContent = "▶ Load";
    loadBtn.disabled = !slot;
    loadBtn.addEventListener("click", () => {
      if (!slot) return;
      playUiSfx("click");
      loadGameFromSlot(slot);
    });

    const delBtn = document.createElement("button");
    delBtn.className = "slot-btn danger";
    delBtn.textContent = "🗑";
    delBtn.disabled = !slot;
    delBtn.addEventListener("click", () => {
      if (!slot) return;
      playUiSfx("click");
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

document.getElementById("day-save-button").addEventListener("click", () => {
  playUiSfx("click");
  renderSaveSlots();
  showModal("load-modal");
});

document.getElementById("load-close").addEventListener("click", () => {
  playUiSfx("close");
  hideModal("load-modal");
});
document.getElementById("load-close-btn").addEventListener("click", () => {
  playUiSfx("close");
  hideModal("load-modal");
});
document.getElementById("load-modal").addEventListener("click", function (e) {
  if (e.target === this) {
    playUiSfx("close");
    hideModal("load-modal");
  }
});

/* ─────────────────────────────────────────────
   CUTSCENE ENGINE
   Sequence: cutscene1 → getajob → flyerpapers → cutscene2 → cutscene5
───────────────────────────────────────────── */
const CUTSCENE_ORDER = [
  "cs-cutscene1",
  "cs-getajob",
  "cs-flyerpapers",
  "cs-cutscene2",
  "cs-cutscene3",
];

let csIndex = -1;
let csAdvancing = false;

function startCutscene() {
  csIndex = -1;
  csAdvancing = false;

  CUTSCENE_ORDER.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("visible");
  });

  showScreen("cutscene-screen");
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
    next.classList.add("visible");
    if (CUTSCENE_SFX[frameId]) playSfx(CUTSCENE_SFX[frameId]);
  } else {
    csAdvancing = false;
    advanceCutscene();
    return;
  }

  setTimeout(() => {
    csAdvancing = false;
  }, 500);
}

function endCutscene() {
  fadeToScene("scene2-screen", () => {
    CUTSCENE_ORDER.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.remove("visible");
    });
  });
}

/* ─────────────────────────────────────────────
   SCENE TRANSITION HELPER
───────────────────────────────────────────── */
function fadeToScene(targetScreenId, swapFn) {
  const overlay = document.getElementById("scene-transition");
  overlay.classList.add("fading");
  setTimeout(() => {
    if (swapFn) swapFn();
    showScreen(targetScreenId);
    setTimeout(() => overlay.classList.remove("fading"), 80);
  }, 780);
}

// Click / keyboard advances the cutscene
document
  .getElementById("cutscene-screen")
  .addEventListener("click", advanceCutscene);
document.addEventListener("keydown", (e) => {
  const csActive = document
    .getElementById("cutscene-screen")
    .classList.contains("active");
  if (!csActive) return;
  if (e.code === "Space" || e.code === "Enter") {
    e.preventDefault();
    advanceCutscene();
  }
});

/* ─────────────────────────────────────────────
   SCENE 2 — desk scene  (phone on table)
───────────────────────────────────────────── */
const phoneHit = document.getElementById("hit-phone");
const phoneImg = document.getElementById("scene2-phone");

phoneHit.addEventListener("mouseenter", () =>
  phoneImg.classList.add("btn-hover"),
);
phoneHit.addEventListener("mouseleave", () => {
  phoneImg.classList.remove("btn-hover");
  phoneImg.classList.remove("btn-active");
});
phoneHit.addEventListener("mousedown", () =>
  phoneImg.classList.add("btn-active"),
);
phoneHit.addEventListener("mouseup", () =>
  phoneImg.classList.remove("btn-active"),
);

phoneHit.addEventListener("click", () => {
  playUiSfx("click");
  resetPhoneScene();
  fadeToScene("phone-screen");
});

/* ─────────────────────────────────────────────
   PHONE SCENE — dial-pad state machine
───────────────────────────────────────────── */
const CORRECT_NUMBER = "01167023154"; // 011-6702-3154
const PHONE_SFX_COUNT = 5;
const MAX_PHONE_INPUT = 11; // length of correct number

let phoneState = "dialing"; // 'dialing' | 'calling' | 'ringing'
let phoneInput = "";
let lastPhoneSfxIdx = -1;
let phoneRingTimer = null;

// ── Button definitions ─────────────────────
const PHONE_BTN_DEFS = [
  { key: "1", id: "pbtn-1" },
  { key: "2", id: "pbtn-2" },
  { key: "3", id: "pbtn-3" },
  { key: "4", id: "pbtn-4" },
  { key: "5", id: "pbtn-5" },
  { key: "6", id: "pbtn-6" },
  { key: "7", id: "pbtn-7" },
  { key: "8", id: "pbtn-8" },
  { key: "9", id: "pbtn-9" },
  { key: "backspace", id: "pbtn-star" },
  { key: "0", id: "pbtn-0" },
  { key: "#", id: "pbtn-hash" },
  { key: "call", id: "pbtn-call" },
];

// Build PixelButton instances for every phone button
const phonePixelBtns = PHONE_BTN_DEFS.map((def) => {
  const img = document.getElementById(def.id);
  const pb = new PixelButton(img, def.key);
  return pb;
});

// ── Helpers ────────────────────────────────
function formatPhoneDisplay(digits) {
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return digits.slice(0, 3) + "-" + digits.slice(3);
  return digits.slice(0, 3) + "-" + digits.slice(3, 7) + "-" + digits.slice(7);
}

function updatePhoneDisplay() {
  const el = document.getElementById("phone-display");
  if (el) el.textContent = formatPhoneDisplay(phoneInput);
}

function setPhoneState(state) {
  phoneState = state;
  const dialEl = document.getElementById("phone-dialing");
  const callEl = document.getElementById("phone-calling");
  const ringEl = document.getElementById("phone-ringing");
  const dispEl = document.getElementById("phone-display");
  const inDialing = state === "dialing";

  dialEl.style.display = state === "dialing" ? "" : "none";
  callEl.style.display = state === "calling" ? "" : "none";
  ringEl.style.display = state === "ringing" ? "" : "none";

  document.querySelectorAll(".phone-btn-img").forEach((el) => {
    el.style.display = inDialing ? "" : "none";
  });
  if (dispEl) dispEl.style.display = inDialing ? "" : "none";
}

function resetPhoneScene() {
  if (phoneRingTimer) {
    clearTimeout(phoneRingTimer);
    phoneRingTimer = null;
  }
  phoneInput = "";
  lastPhoneSfxIdx = -1;
  setPhoneState("dialing");
  updatePhoneDisplay();
  // Silence any lingering ring
  const ringSfx = document.getElementById("sfx-phone-ring");
  if (ringSfx) {
    ringSfx.pause();
    ringSfx.currentTime = 0;
  }
}

function playPhoneKeySfx() {
  let idx;
  do {
    idx = Math.floor(Math.random() * PHONE_SFX_COUNT) + 1;
  } while (idx === lastPhoneSfxIdx && PHONE_SFX_COUNT > 1);
  lastPhoneSfxIdx = idx;
  const el = document.getElementById(`sfx-phonesfx${idx}`);
  if (el) {
    el.currentTime = 0;
    el.play().catch(() => {});
  }
}

function handlePhoneKey(key) {
  if (phoneState !== "dialing") return;

  if (key === "call") {
    if (phoneInput !== CORRECT_NUMBER) return; // wrong number — no response
    // Correct! → calling → ringing → fade to black when ring ends
    setPhoneState("calling");
    phoneRingTimer = setTimeout(() => {
      setPhoneState("ringing");
      const ringSfx = document.getElementById("sfx-phone-ring");
      if (ringSfx) {
        ringSfx.currentTime = 0;
        ringSfx.play().catch(() => {});
        // Show dialogue once the ring sound finishes
        ringSfx.addEventListener(
          "ended",
          () => {
            showDialogue();
          },
          { once: true },
        );
      }
    }, 1600);
    return;
  }

  // Backspace key (mapped to * button)
  if (key === "backspace") {
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
const phoneScreen = document.getElementById("phone-screen");

// X shift of 63px corrects the translateX(9.10%) CSS offset on .phone-btn-img
const PHONE_BTN_XSHIFT = 63;

phoneScreen.addEventListener("mousemove", (e) => {
  if (phoneState !== "dialing") {
    phoneScreen.style.cursor = "";
    return;
  }
  const rect = phoneScreen.getBoundingClientRect();
  let found = null;
  for (const pb of phonePixelBtns) {
    if (pb.hitTest(e.clientX, e.clientY, rect, PHONE_BTN_XSHIFT)) {
      found = pb;
      break;
    }
  }
  for (const pb of phonePixelBtns) pb.setHover(pb === found);
  phoneScreen.style.cursor = found ? "pointer" : "";
});

phoneScreen.addEventListener("mouseleave", () => {
  for (const pb of phonePixelBtns) {
    pb.setHover(false);
    pb.setActive(false);
  }
  phoneScreen.style.cursor = "";
});

phoneScreen.addEventListener("mousedown", (e) => {
  if (phoneState !== "dialing") return;
  const rect = phoneScreen.getBoundingClientRect();
  for (const pb of phonePixelBtns) {
    pb.setActive(pb.hitTest(e.clientX, e.clientY, rect, PHONE_BTN_XSHIFT));
  }
});

phoneScreen.addEventListener("mouseup", () => {
  for (const pb of phonePixelBtns) pb.setActive(false);
});

phoneScreen.addEventListener("click", (e) => {
  if (phoneState !== "dialing") return;
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

const TYPEWRITER_MS = 32; // ms between characters

let _dlgLineIdx = 0;
let _dlgCharIdx = 0;
let _dlgTyping = false;
let _dlgTimer = null;

function showDialogue() {
  _dlgLineIdx = 0;
  const overlay = document.getElementById("dialogue-overlay");
  overlay.classList.remove("hidden");
  // Clicking anywhere on the box advances / skips
  document
    .getElementById("dialogue-box-wrap")
    .addEventListener("click", advanceDialogue);
  // Cursor should show as "point" over the box — tell the screen element
  phoneScreen.style.cursor = "pointer";
  _typeDialogueLine(DIALOGUE_LINES[0]);
}

function _typeDialogueLine(text) {
  const el = document.getElementById("dialogue-text");
  el.textContent = "";
  _dlgCharIdx = 0;
  _dlgTyping = true;

  (function tick() {
    if (_dlgCharIdx < text.length) {
      el.textContent += text[_dlgCharIdx++];
      _dlgTimer = setTimeout(tick, TYPEWRITER_MS);
    } else {
      _dlgTyping = false;
      _dlgTimer = null;
    }
  })();
}

function advanceDialogue() {
  if (_dlgTyping) {
    // Skip to end of current line instantly
    clearTimeout(_dlgTimer);
    _dlgTimer = null;
    _dlgTyping = false;
    document.getElementById("dialogue-text").textContent =
      DIALOGUE_LINES[_dlgLineIdx];
    return;
  }

  _dlgLineIdx++;
  if (_dlgLineIdx < DIALOGUE_LINES.length) {
    _typeDialogueLine(DIALOGUE_LINES[_dlgLineIdx]);
  } else {
    // All lines done — hide box, fade to truck selection
    document.getElementById("dialogue-overlay").classList.add("hidden");
    document
      .getElementById("dialogue-box-wrap")
      .removeEventListener("click", advanceDialogue);
    phoneScreen.style.cursor = "";
    fadeToScene("truck-select-screen", initTruckSelection);
  }
}

/* ─────────────────────────────────────────────
   AUDIO — music + SFX
───────────────────────────────────────────── */

// ── Music tracks ────────────────────────────
const menuMusic = document.getElementById("menu-music");
const scene2Music = document.getElementById("scene2-music");

const SCREEN_MUSIC = {
  "menu-screen": menuMusic,
  "scene2-screen": scene2Music,
  "phone-screen": scene2Music,
  "truck-select-screen": scene2Music, // continues from phone scene uninterrupted
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
    document.addEventListener("pointerdown", resume, { once: true });
    document.addEventListener("keydown", resume, { once: true });
  });
}

function stopAllMusic() {
  Object.values(SCREEN_MUSIC).forEach((t) => {
    if (!t) return;
    t.pause();
    t.currentTime = 0;
  });
  _currentTrack = null;
}

// Full showScreen — handles both DOM switching and per-screen music.
// Skips restarting the track if the same one is already playing
// (e.g. scene2 → phone-screen both use scene2Music).
function showScreen(id) {
  // eslint-disable-line no-redeclare
  _setActiveScreen(id);
  const hud = document.getElementById('game-hud');
  if (hud) {
    const hudVisible = ['serving-screen', 'cooking-screen', 'shop-screen', 'purchasing-screen'].includes(id);
    hud.classList.toggle('visible', hudVisible);
    hud.classList.toggle('shop-mode', id === 'shop-screen' || id === 'purchasing-screen');
  }
  const saveButton = document.getElementById('day-save-button');
  if (saveButton) {
    saveButton.classList.toggle(
      'visible',
      dayNumber >= 2 && ['serving-screen', 'cooking-screen'].includes(id),
    );
  }
  const newTrack = SCREEN_MUSIC[id] || null;
  if (newTrack !== _currentTrack) {
    stopAllMusic();
    if (newTrack) playTrack(newTrack);
  }
}

/* ─────────────────────────────────────────────
   SHOP + PURCHASING
───────────────────────────────────────────── */
const SHOP_ITEMS = [
  { key: 'lettuce', stockKey: 'cabbage', source: 'assets/full_ingredients/cabbage.png', price: 1 },
  { key: 'tomato', stockKey: 'tomatoes', source: 'assets/full_ingredients/tomato.png', price: 1 },
  { key: 'carrot', stockKey: 'carrots', source: 'assets/full_ingredients/carrots.png', price: 1 },
  { key: 'rice', stockKey: 'rice', source: 'assets/full_ingredients/rice.png', price: 2 },
  { key: 'corn', stockKey: 'corn', source: 'assets/full_ingredients/corn.png', price: 2 },
  { key: 'broccoli', stockKey: 'broccoli', source: 'assets/full_ingredients/broccoli.png', price: 2 },
  { key: 'noodles', stockKey: 'noodles', source: 'assets/full_ingredients/noodles.png', price: 3 },
  { key: 'egg', stockKey: 'egg', source: 'assets/full_ingredients/egg.png', price: 3 },
  { key: 'mushroom', stockKey: 'mushrooms', source: 'assets/full_ingredients/mushroom.png', price: 4 },
  { key: 'tofu', stockKey: 'tofu', source: 'assets/full_ingredients/tofu.png', price: 4 },
];

let shopBackground = 'farm';
let purchasingPage = 1;
const purchaseQuantities = Object.fromEntries(SHOP_ITEMS.map(item => [item.key, 0]));
let supplierChosen = localStorage.getItem('rar_supplier_chosen') === 'local-farm';
let shopReturnScreen = 'serving-screen';

function resetPurchaseCart() {
  SHOP_ITEMS.forEach(item => {
    purchaseQuantities[item.key] = 0;
  });
}

function purchaseMaxStock(item) {
  return item.stockKey === 'egg'
    ? 4
    : item.stockKey === 'rice' || item.stockKey === 'noodles'
      ? 12
      : 9;
}

function setShopBackground(kind) {
  if (kind === shopBackground) return;
  const background = document.getElementById('shop-background');
  background.classList.remove('shop-fade-in');
  background.classList.add('shop-fade-out');
  setTimeout(() => {
    shopBackground = kind;
    background.src = kind === 'market'
      ? 'assets/shop/marketbg.png'
      : 'assets/shop/farm.png';
    document.getElementById('shop-info-farm').classList.toggle('hidden', kind !== 'farm');
    document.getElementById('shop-info-market').classList.toggle('hidden', kind !== 'market');
    document.getElementById('hit-shop-info-farm').classList.toggle('hidden', kind !== 'farm');
    document.getElementById('hit-shop-info-market').classList.toggle('hidden', kind !== 'market');
    background.classList.remove('shop-fade-out');
    background.classList.add('shop-fade-in');
  }, 210);
}

function initShopScreen() {
  shopBackground = 'farm';
  const background = document.getElementById('shop-background');
  background.src = 'assets/shop/farm.png';
  background.classList.remove('shop-fade-out', 'shop-fade-in');
  document.getElementById('shop-info-farm').classList.remove('hidden');
  document.getElementById('shop-info-market').classList.add('hidden');
  document.getElementById('hit-shop-info-farm').classList.remove('hidden');
  document.getElementById('hit-shop-info-market').classList.add('hidden');

  const localFarm = document.getElementById('shop-local-farm');
  const hypermarket = document.getElementById('shop-hypermarket');
  const localFarmHit = document.getElementById('hit-shop-local-farm');
  const hypermarketHit = document.getElementById('hit-shop-hypermarket');
  localFarmHit.onmouseenter = () => localFarm.classList.add('shop-choice-hover');
  localFarmHit.onmouseleave = () => localFarm.classList.remove('shop-choice-hover');
  hypermarketHit.onmouseenter = () => hypermarket.classList.add('shop-choice-hover');
  hypermarketHit.onmouseleave = () => hypermarket.classList.remove('shop-choice-hover');

  document.getElementById('hit-shop-local-farm').onclick = () => {
    if (shopBackground === 'farm') {
      showModal('supplier-confirm-modal');
    } else {
      setShopBackground('farm');
    }
  };
  document.getElementById('hit-shop-hypermarket').onclick = () => {
    if (shopBackground === 'market') {
      showModal('supplier-warning-modal');
    } else {
      setShopBackground('market');
    }
  };
  document.getElementById('hit-shop-info-farm').onclick = () => {
    document.getElementById('shop-info-title').textContent = 'Local farms';
    document.getElementById('shop-info-message').textContent =
      'Sourcing from local farms reduces the carbon footprint by cutting down on transport distances and minimizes plastic packaging waste common in hypermarkets.';
    showModal('shop-info-modal');
  };
  document.getElementById('hit-shop-info-market').onclick = () => {
    document.getElementById('shop-info-title').textContent = 'Hypermarkets';
    document.getElementById('shop-info-message').textContent =
      'Sourcing from hypermarkets relies on long-distance logistics that generate high transport emissions and requires excessive chemical preservatives to keep food fresh during transit.';
    showModal('shop-info-modal');
  };
}

function openShop() {
  const activeScreen = document.querySelector('.screen.active');
  if (activeScreen && ['serving-screen', 'cooking-screen'].includes(activeScreen.id)) {
    shopReturnScreen = activeScreen.id;
  }
  const target = supplierChosen ? 'purchasing-screen' : 'shop-screen';
  fadeToScene(target, target === 'shop-screen' ? initShopScreen : initPurchasingScreen);
}

function renderPurchasePage(page) {
  const slots = document.getElementById(`purchase-slots-${page}`);
  const items = page === 1 ? SHOP_ITEMS.slice(0, 8) : SHOP_ITEMS.slice(8);
  slots.innerHTML = '';
  items.forEach((item) => {
    const slot = document.createElement('div');
    slot.className = 'purchase-slot';
    slot.setAttribute('role', 'button');
    slot.setAttribute('aria-label', `Buy ${item.key} for $${item.price}`);
    slot.innerHTML = `
      <img class="purchase-slot-image" src="${item.source}" alt="${item.key}" draggable="false" />
      <span class="purchase-quantity">${purchaseQuantities[item.key]}</span>
      <span class="purchase-price">$${item.price}</span>
    `;
    slot.onclick = () => purchaseItem(item);
    slots.appendChild(slot);
  });
}

function initPurchasingScreen() {
  initIngredientStock();
  resetPurchaseCart();
  purchasingPage = 1;
  document.getElementById('purchase-page-track').classList.remove('purchase-page-two');
  document.getElementById('last_page').classList.add('hidden');
  document.getElementById('next_page').classList.remove('hidden');
  document.getElementById('purchase-exit').classList.remove('hidden');
  document.getElementById('hit-purchase-exit').classList.remove('hidden');
  renderPurchasePage(1);
  renderPurchasePage(2);
}

function purchaseItem(item) {
  // Cart quantities are kept separate from the kitchen inventory until checkout.
  initIngredientStock();
  const currentStock = ingredientStock[item.stockKey] || 0;
  if (currentStock + purchaseQuantities[item.key] >= purchaseMaxStock(item)) return;
  purchaseQuantities[item.key]++;
  renderPurchasePage(purchasingPage);
}

document.getElementById('shop-hud').addEventListener('click', openShop);
document.getElementById('ingame-settings-hud').addEventListener('click', () => showModal('settings-modal'));
document.getElementById('shop-info-ok').addEventListener('click', () => {
  playUiSfx('close');
  hideModal('shop-info-modal');
});
document.getElementById('supplier-no').addEventListener('click', () => {
  playUiSfx('close');
  hideModal('supplier-confirm-modal');
});
document.getElementById('supplier-yes').addEventListener('click', () => {
  playUiSfx('click');
  supplierChosen = true;
  localStorage.setItem('rar_supplier_chosen', 'local-farm');
  hideModal('supplier-confirm-modal');
  fadeToScene('purchasing-screen', initPurchasingScreen);
});
document.getElementById('supplier-warning-ok').addEventListener('click', () => {
  playUiSfx('close');
  hideModal('supplier-warning-modal');
});

function returnFromShop() {
  const target = ['serving-screen', 'cooking-screen'].includes(shopReturnScreen)
    ? shopReturnScreen
    : 'serving-screen';
  fadeToScene(target);
}

function checkoutCart() {
  initIngredientStock();
  let total = 0;
  SHOP_ITEMS.forEach(item => {
    const quantity = purchaseQuantities[item.key];
    if (!quantity) return;
    const available = purchaseMaxStock(item) - (ingredientStock[item.stockKey] || 0);
    const committed = Math.min(quantity, Math.max(0, available));
    ingredientStock[item.stockKey] += committed;
    total += committed * item.price;
  });
  money -= total;
  daySpent += total;
  updateMoneyHud();
  resetPurchaseCart();
  updateIngredientStockUI();
  returnFromShop();
}

function clearPurchaseCart() {
  resetPurchaseCart();
  renderPurchasePage(1);
  renderPurchasePage(2);
}

document.getElementById('hit-purchase-checkout').addEventListener('click', checkoutCart);
document.getElementById('hit-purchase-clearcart').addEventListener('click', clearPurchaseCart);
document.getElementById('hit-purchase-exit').addEventListener('click', returnFromShop);
document.getElementById('next_page').addEventListener('click', () => {
  if (purchasingPage === 2) return;
  purchasingPage = 2;
  document.getElementById('purchase-page-track').classList.add('purchase-page-two');
  document.getElementById('next_page').classList.add('hidden');
  document.getElementById('last_page').classList.remove('hidden');
  document.getElementById('purchase-exit').classList.add('hidden');
  document.getElementById('hit-purchase-exit').classList.add('hidden');
});
document.getElementById('last_page').addEventListener('click', () => {
  if (purchasingPage === 1) return;
  purchasingPage = 1;
  document.getElementById('purchase-page-track').classList.remove('purchase-page-two');
  document.getElementById('last_page').classList.add('hidden');
  document.getElementById('next_page').classList.remove('hidden');
  document.getElementById('purchase-exit').classList.remove('hidden');
  document.getElementById('hit-purchase-exit').classList.remove('hidden');
});

// Start menu music immediately on load
playTrack(menuMusic);

// ── SFX (cutscene frames) ────────────────────
const CUTSCENE_SFX = {
  "cs-cutscene1": "sfx-angry-meow",
  "cs-flyerpapers": "sfx-paperslam",
  "cs-cutscene3": "sfx-angry-meow2",
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
  const cursorEl = document.getElementById("custom-cursor");
  const cursorImg = document.getElementById("cursor-img");
  const gameContainer = document.getElementById("game-container");

  const CURSORS = {
    neutral: "assets/pointer/neutral.png",
    point: "assets/pointer/point.png",
    grab: "assets/pointer/grab.png",
  };

  // Preload all three so swaps are instant
  Object.values(CURSORS).forEach((src) => {
    const img = new Image();
    img.src = src;
  });

  let _state = "neutral";
  let _grabTimer = null;
  let _holding = false;
  let _lastX = 0;
  let _lastY = 0;

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
      if (
        tag === "BUTTON" ||
        tag === "A" ||
        tag === "SELECT" ||
        tag === "INPUT" ||
        tag === "LABEL"
      )
        return true;
      const cl = el.classList;
      if (
        cl.contains("menu-hit") ||
        cl.contains("close-btn") ||
        cl.contains("tab-btn") ||
        cl.contains("footer-btn") ||
        cl.contains("save-slot") ||
        cl.contains("slot-btn") ||
        cl.contains("toggle-switch")
      )
        return true;
      // Catch all invisible hit-area divs (hit-phone, hit-truck, hit-title, …)
      if (el.id && el.id.startsWith("hit-")) return true;
      // Dialogue box is clickable when visible
      if (el.id === "dialogue-box-wrap") return true;
      el = el.parentElement;
    }
    return false;
  }

  /** Returns true if any modal overlay is currently visible. */
  function isModalOpen() {
    return !!document.querySelector(".modal-overlay:not(.hidden)");
  }

  /** True when the mouse is inside the game container rect. */
  function isOverGame(cx, cy) {
    const r = gameContainer.getBoundingClientRect();
    return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  }

  /** Decide neutral vs point for the current mouse position. */
  function resolveHoverState(clientX, clientY) {
    // Pixel buttons set an inline style on the active screen element
    const activeScreen = document.querySelector(".screen.active");
    if (activeScreen && activeScreen.style.cursor === "pointer") return "point";

    const el = document.elementFromPoint(clientX, clientY);
    if (el && isPointerTarget(el)) return "point";

    return "neutral";
  }

  document.addEventListener("mousemove", (e) => {
    _lastX = e.clientX;
    _lastY = e.clientY;

    // Show cursor only over the game window or an open modal
    if (!isOverGame(e.clientX, e.clientY) && !isModalOpen()) {
      cursorEl.style.display = "none";
      return;
    }

    // Position: fixed element — clientX/Y map directly to viewport coords
    cursorEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    cursorEl.style.display = "block";

    if (_holding || _grabTimer) return;
    setState(resolveHoverState(e.clientX, e.clientY));
  });

  document.addEventListener("mouseleave", () => {
    cursorEl.style.display = "none";
  });

  // Flash grab on any click inside game or modal
  document.addEventListener("mousedown", (e) => {
    if (!isOverGame(e.clientX, e.clientY) && !isModalOpen()) return;
    _holding = true;
    if (_grabTimer) clearTimeout(_grabTimer);
    _grabTimer = null;
    setState("grab");
  });

  document.addEventListener("mouseup", () => {
    if (!_holding) return;
    _holding = false;
    setState(resolveHoverState(_lastX, _lastY));
  });
})();

/* ─────────────────────────────────────────────
   TRUCK SELECTION SCENE
───────────────────────────────────────────── */
const TS_TEXTS = {
  eco: "Electric vehicles eliminate loud generator noise and toxic exhaust fumes, enabling food trucks to operate quietly and cleanly right next to customers.",
  diesel:
    "Diesel-powered food trucks emit high levels of toxic particulate matter and create constant loud engine noise, which can drive customers away and further pollute the environment.",
};

let _tsTruck = "eco"; // 'eco' | 'diesel'
let _tsSwitching = false;
let _tsTyping = false;
let _tsTimer = null;
let _tsCharIdx = 0;

// ── Hit-area position tables ────────────────
const TS_HITS = {
  eco: { textLeft: "4%", textWidth: "40%", arrowLeft: "44%", arrowWidth: "6%" },
  diesel: {
    textLeft: "5%",
    textWidth: "40%",
    arrowLeft: "1%",
    arrowWidth: "5%",
  },
};

function _tsUpdateHits() {
  const h = TS_HITS[_tsTruck];
  const th = document.getElementById("hit-ts-text");
  const ah = document.getElementById("hit-ts-arrow");
  th.style.left = h.textLeft;
  th.style.width = h.textWidth;
  ah.style.left = h.arrowLeft;
  ah.style.width = h.arrowWidth;
}

// ── Clipboard typewriter ─────────────────────
function _tsType(text) {
  if (_tsTimer) {
    clearTimeout(_tsTimer);
    _tsTimer = null;
  }
  _tsTyping = false;
  _tsCharIdx = 0;
  const el = document.getElementById("ts-clipboard-text");
  el.textContent = "";
  _tsTyping = true;
  (function tick() {
    if (_tsCharIdx < text.length) {
      el.textContent += text[_tsCharIdx++];
      _tsTimer = setTimeout(tick, 28);
    } else {
      _tsTyping = false;
      _tsTimer = null;
    }
  })();
}

// ── Slide animation ──────────────────────────
function tsSwitchTruck() {
  if (_tsSwitching) return;
  _tsSwitching = true;

  const ecoEl = document.getElementById("ts-eco-truck");
  const dieselEl = document.getElementById("ts-diesel-truck");
  const nameImg = document.getElementById("ts-name-img");
  const label = document.getElementById("ts-truck-label");

  const toDiesel = _tsTruck === "eco";
  const outEl = toDiesel ? ecoEl : dieselEl;
  const inEl = toDiesel ? dieselEl : ecoEl;
  const exitX = toDiesel ? "-30%" : "30%";
  const enterX = toDiesel ? "30%" : "-30%";

  // Slide out current truck
  outEl.style.transform = `translateX(${exitX})`;
  outEl.style.opacity = "0";

  // Place incoming truck off-screen instantly (no transition)
  inEl.style.transition = "none";
  inEl.style.transform = `translateX(${enterX})`;
  inEl.style.opacity = "0";
  inEl.style.display = "block"; // must be explicit — CSS default is 'none' for diesel
  // Force reflow, then re-enable transition and animate in
  inEl.getBoundingClientRect();
  inEl.style.transition = "";
  inEl.style.transform = "";
  inEl.style.opacity = "1";

  setTimeout(() => {
    outEl.style.display = "none";
    outEl.style.transform = "";
    outEl.style.opacity = "1";
    _tsTruck = toDiesel ? "diesel" : "eco";
    nameImg.src = `assets/truck_selection/${_tsTruck === "eco" ? "eco" : "diesel"}truck_name.png`;
    label.textContent = _tsTruck === "eco" ? "Electric" : "Diesel";
    _tsUpdateHits();
    _tsType(TS_TEXTS[_tsTruck]);
    _tsSwitching = false;
  }, 450);
}

// ── Initialise the scene ─────────────────────
function initTruckSelection() {
  _tsTruck = "eco";
  _tsSwitching = false;

  const ecoEl = document.getElementById("ts-eco-truck");
  const dieselEl = document.getElementById("ts-diesel-truck");

  // Reset eco truck to visible, diesel hidden
  [ecoEl, dieselEl].forEach((el) => {
    el.style.transition = "none";
    el.style.transform = "";
    el.style.opacity = "1";
  });
  ecoEl.style.display = "";
  dieselEl.style.display = "none";
  // Re-enable transitions after reset
  ecoEl.getBoundingClientRect();
  ecoEl.style.transition = "";
  dieselEl.style.transition = "";

  document.getElementById("ts-name-img").src =
    "assets/truck_selection/ecotruck_name.png";
  document.getElementById("ts-truck-label").textContent = "Electric";
  _tsUpdateHits();
  _tsType(TS_TEXTS.eco);
}

// ── Select / confirm truck ───────────────────
function tsSelectTruck() {
  playUiSfx("click");
  const modal = document.getElementById("truck-confirm-modal");
  const msg = document.getElementById("truck-confirm-msg");
  const btns = document.getElementById("truck-confirm-btns");

  btns.innerHTML = "";
  btns.style.justifyContent = "";

  if (_tsTruck === "eco") {
    msg.textContent =
      "Great choice! You've helped reduce your food truck's carbon footprint!";

    const noBtn = document.createElement("button");
    noBtn.className = "footer-btn";
    noBtn.textContent = "No";
    noBtn.addEventListener("click", () => {
      playUiSfx("close");
      hideModal("truck-confirm-modal");
    });

    const yesBtn = document.createElement("button");
    yesBtn.className = "footer-btn primary";
    yesBtn.textContent = "Yes";
    yesBtn.addEventListener("click", () => {
      playUiSfx("click");
      hideModal("truck-confirm-modal");
      fadeToScene("serving-screen", initServingScene);
    });

    btns.append(noBtn, yesBtn);
  } else {
    msg.textContent =
      "Hmm, that doesn't seem like a good option. Why not try choosing the more eco-friendly truck?";
    btns.style.justifyContent = "center";

    const okBtn = document.createElement("button");
    okBtn.className = "footer-btn primary";
    okBtn.textContent = "OK";
    okBtn.addEventListener("click", () => {
      playUiSfx("close");
      hideModal("truck-confirm-modal");
    });

    btns.append(okBtn);
  }

  showModal("truck-confirm-modal");
}

// ── Event listeners ──────────────────────────
document
  .getElementById("hit-ts-text")
  .addEventListener("click", () => tsSelectTruck());
document.getElementById("hit-ts-arrow").addEventListener("click", () => {
  playUiSfx("click");
  tsSwitchTruck();
});

// Hover feedback — brighten/dim the name image
(function () {
  const nameImg = document.getElementById("ts-name-img");
  ["hit-ts-text", "hit-ts-arrow"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("mouseenter", () => {
      nameImg.style.filter = "brightness(0.82)";
    });
    el.addEventListener("mouseleave", () => {
      nameImg.style.filter = "";
    });
    el.addEventListener("mousedown", () => {
      nameImg.style.filter = "brightness(0.6)";
    });
    el.addEventListener("mouseup", () => {
      nameImg.style.filter = "brightness(0.82)";
    });
  });
})();

/* ─────────────────────────────────────────────
   SERVING SCREEN — TUTORIAL DIALOGUE
───────────────────────────────────────────── */
const SERVING_TUT_LINES = [
  "This is the inside of your truck. Take a look around.",
  "What do you think? Well, either way, you best get used to it. You're working here now.",
  "Here's the counter. Your customers will be walking up to this window and placing an order.",
  "Look, you've got your first customer already! Lucky you.",
  "Don't keep them waiting! Let's take a look at what they want to order...",
];

let _stLineIdx = 0;
let _stCharIdx = 0;
let _stTyping = false;
let _stTimer = null;

function initServingScene() {
  _stLineIdx = 0;
  _stTyping = false;
  _stTimer = null;
  _stCharIdx = 0;

  document.getElementById("serving-tut-text").textContent = "";

  const wrap = document.getElementById("serving-tutorial-wrap");
  wrap.addEventListener("click", _stAdvance);

  _stTypeServingLine(SERVING_TUT_LINES[0]);
}

function _stTypeServingLine(text) {
  const el = document.getElementById("serving-tut-text");
  el.textContent = "";
  _stCharIdx = 0;
  _stTyping = true;

  (function tick() {
    if (_stCharIdx < text.length) {
      el.textContent += text[_stCharIdx++];
      _stTimer = setTimeout(tick, TYPEWRITER_MS);
    } else {
      _stTyping = false;
      _stTimer = null;
    }
  })();
}

function _stAdvance() {
  if (_stTyping) {
    clearTimeout(_stTimer);
    _stTimer = null;
    _stTyping = false;
    document.getElementById("serving-tut-text").textContent =
      SERVING_TUT_LINES[_stLineIdx];
    return;
  }

  // After "Lucky you" (line 3), spawn the first customer
  if (_stLineIdx === 3) {
    document.dispatchEvent(new CustomEvent("newCustomer"));
  }

  _stLineIdx++;
  if (_stLineIdx < SERVING_TUT_LINES.length) {
    _stTypeServingLine(SERVING_TUT_LINES[_stLineIdx]);
  } else {
    // Tutorial done — hide bubble, show order box
    const tutWrap = document.getElementById("serving-tutorial-wrap");
    tutWrap.classList.add("hidden");
    tutWrap.style.display = "none";
    tutWrap.removeEventListener("click", _stAdvance);
    showOrderBox(_activeCustomerType);
  }
}

/* ─────────────────────────────────────────────
   CUSTOMER SPAWNING
───────────────────────────────────────────── */
const CUSTOMER_TYPES = [
  "calico",
  "siamese",
  "tabby",
  "tuxedo",
  "brownbunny",
  "greybunny",
  "spotbunny",
  "whitebunny",
  "shrimp",
];
const _spriteTimers = [];
let _activeCustomerType = 'calico';

// Diet per customer type (all current cats are omnivore)
const CUSTOMER_DIET = {
  calico: 'omnivore', siamese: 'omnivore', tabby: 'omnivore', tuxedo: 'omnivore',
  brownbunny: 'herbivore',
  greybunny: 'herbivore',
  spotbunny: 'herbivore',
  whitebunny: 'herbivore',
  shrimp: 'omnivore',
};

const DISH_RECIPES = [
  { key: 'broccoli_tofu_egg_rice', category: 'omnivore', price: 18, ingredients: ['broccoli', 'tofu', 'egg'], base: 'rice' },
  { key: 'egg_corn_rice', category: 'omnivore', price: 13, ingredients: ['egg', 'corn'], base: 'rice' },
  { key: 'mushroom_broccoli_rice', category: 'herbivore', price: 14, ingredients: ['mushroom', 'broccoli'], base: 'rice' },
  { key: 'cabbage_carrot_tomato_rice', category: 'herbivore', price: 10, ingredients: ['cabbage', 'carrot', 'tomato'], base: 'rice' },
  { key: 'broccoli_carrot_corn_rice', category: 'herbivore', price: 13, ingredients: ['broccoli', 'carrot', 'corn'], base: 'rice' },
  { key: 'broccoli_carrot_noodles', category: 'herbivore', price: 11, ingredients: ['broccoli', 'carrot'], base: 'noodles' },
  { key: 'mushroom_corn_noodles', category: 'herbivore', price: 13, ingredients: ['mushroom', 'corn'], base: 'noodles' },
  { key: 'cabbage_egg_tomato_noodles', category: 'herbivore', price: 14, ingredients: ['cabbage', 'egg', 'tomato'], base: 'noodles' },
];

const ORDER_BOX_INGREDIENT_SOURCES = {
  broccoli: 'assets/full_ingredients/broccoli.png',
  cabbage: 'assets/full_ingredients/cabbage.png',
  carrot: 'assets/full_ingredients/carrots.png',
  corn: 'assets/full_ingredients/corn.png',
  egg: 'assets/full_ingredients/egg.png',
  mushroom: 'assets/full_ingredients/mushroom.png',
  noodles: 'assets/full_ingredients/noodles.png',
  rice: 'assets/full_ingredients/rice.png',
  tofu: 'assets/full_ingredients/tofu.png',
  tomato: 'assets/full_ingredients/tomato.png',
};

function _randomDish(customerType) {
  const category = CUSTOMER_DIET[customerType] || 'omnivore';
  const availableDishes = DISH_RECIPES.filter(dish =>
    dish.category === category &&
    (category !== 'herbivore' || !dish.ingredients.includes('egg'))
  );
  return availableDishes[Math.floor(Math.random() * availableDishes.length)];
}

let money = 0;
let dayNumber = 1;
let dayEarned = 0;
let daySpent = 0;
let totalEarned = 0;
let totalCustomersServed = 0;
let totalSatisfied = 0;
let totalAngry = 0;

function customersPerDay() {
  return dayNumber === 1 ? 5 : 6;
}

function updateMoneyHud() {
  const amount = document.getElementById('money-amount');
  if (!amount) return;
  amount.textContent = money < 0 ? `-$${Math.abs(money)}` : `$${money}`;
  amount.classList.toggle('negative', money < 0);
}

function dayStarCount() {
  const served = Math.max(1, customersPerDay());
  const angry = Math.max(0, wrongDishesServed);
  const satisfiedThisDay = Math.max(0, served - angry);
  const ratio = satisfiedThisDay / served;
  if (ratio >= 0.8) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

function renderDaySummary() {
  const earned = document.getElementById('day-summary-earned');
  const spent = document.getElementById('day-summary-spent');
  const total = document.getElementById('day-summary-total');
  earned.textContent = `$${dayEarned}`;
  spent.textContent = `$${daySpent}`;
  total.textContent = `$${totalEarned}`;

  const left = document.getElementById('day-summary-left-star');
  const middle = document.getElementById('day-summary-middle-star');
  const right = document.getElementById('day-summary-right-star');
  [left, middle, right].forEach(star => {
    star.classList.remove('visible');
    star.classList.add('hidden');
  });

  const stars = dayStarCount();
  left.classList.remove('hidden');
  right.classList.toggle('hidden', stars < 2);
  requestAnimationFrame(() => {
    left.classList.add('visible');
    if (stars >= 2) right.classList.add('visible');
  });
  if (stars === 3) {
    setTimeout(() => {
      middle.classList.remove('hidden');
      middle.classList.add('visible');
    }, 1000);
  }

  const nextDay = dayNumber + 1;
  if (document.getElementById('autosave-toggle')?.checked) {
    saveGameToSlot(0, nextDay, {
      dayEarned: 0,
      daySpent: 0,
    });
  }
}

function resetDayState() {
  customersServed = 0;
  wrongDishesServed = 0;
  dayEarned = 0;
  daySpent = 0;
  dayEnded = false;
  servingInProgress = false;
  successfulDishReady = false;
  preparedDishKey = null;
  potIngredients = [];
}

function startDayIntro(day) {
  dayNumber = Math.max(1, Number(day) || 1);
  resetDayState();
  const overlay = document.getElementById('day-intro-overlay');
  const label = document.getElementById('day-intro-label');
  label.textContent = `DAY ${dayNumber}`;
  overlay.classList.remove('hidden', 'label-visible', 'label-fading');
  overlay.classList.add('visible');

  setTimeout(() => {
    overlay.classList.add('label-visible');
  }, 700);

  setTimeout(() => {
    overlay.classList.remove('label-visible');
    overlay.classList.add('label-fading');
    setTimeout(() => {
      overlay.classList.remove('visible', 'label-fading');
      overlay.classList.add('hidden');
    }, 700);
  }, 2400);

  showScreen('serving-screen');
  const tutWrap = document.getElementById('serving-tutorial-wrap');
  tutWrap.classList.add('hidden');
  tutWrap.style.display = 'none';
  document.getElementById('customer-reaction').classList.add('hidden');
  document.getElementById('to-kitchen-arrow').classList.add('hidden');
  document.dispatchEvent(new CustomEvent('newCustomer'));
  showOrderBox(_activeCustomerType, false);
}

document.getElementById('day-summary-screen').addEventListener('click', () => {
  const nextDay = dayNumber + 1;
  dayNumber = nextDay;
  startDayIntro(nextDay);
});

function showOrderBox(customerType, withTutorial = true) {
  const dish  = _randomDish(customerType);
  currentOrderDish = dish;
  const slots = [...dish.ingredients, dish.base]; // e.g. ['egg','corn','rice'] = 3 boxes

  const wrap    = document.getElementById('order-box-wrap');
  const boxImg  = document.getElementById('order-box-img');
  const slotsEl = document.getElementById('order-box-slots');

  boxImg.src = slots.length <= 3
    ? 'assets/serving/three_order_box.png'
    : 'assets/serving/four_order_box.png';

  slotsEl.innerHTML = slots.map(slot => {
    const source = ORDER_BOX_INGREDIENT_SOURCES[slot];
    return `<div class="ob-slot"><img src="${source}" alt="${slot}" draggable="false" /></div>`;
  }).join('');

  wrap.classList.remove('hidden', 'fade-in');
  void wrap.offsetWidth;
  wrap.classList.add('fade-in');
  wrap.style.pointerEvents = 'auto';
  wrap.style.cursor = 'pointer';
  wrap.removeEventListener('click', startOrderBoxTutorial);
  wrap.onclick = null;
  if (withTutorial) {
    wrap.addEventListener('click', startOrderBoxTutorial, { once: true });
  } else {
    wrap.onclick = showKitchenArrow;
  }
}

/* ─────────────────────────────────────────────
   ORDER BOX TUTORIAL + KITCHEN ARROW
───────────────────────────────────────────── */
const OB_TUT_LINES = [
  "In these few boxes, the ingredients your customer wants in their food is shown. ",
  "Let's whip them up something nice, shall we?",
];
const KITCHEN_TUT_LINES = [
  "Click that triangular button down there, and let's get to cooking!",
];
const COOKING_TUT_LINES = [
  "Considering how you're still new to this, I've thrown in a little something for free.",
  "Your truck is filled with ingredients for your first day on the job, you're welcome.",
  "In case you're not familiar with how this works...",
  "Start by memorizing your customer's order ingredients.",
  "Then, you can go ahead and drag the ingredients into the pot over there.",
  "When you've got everything, press the red button on the stove to start cooking.",
  "Of course, if you put something in there by mistake, you can always click the white button next to it to clear your pot.",
  "While cooking, be sure to click the meter when it's green!.",
  "Unless... well... unless you're just really bad at cooking in general.",
  "Anyways, once your ingredients run out, you can always click the shop icon to buy more.",
  "You'll be using your own money though, of course. Be sure to make the right choice on who to buy from!",
  "Oh, would you look at the time... I'm running late for a meeting.",
  "All the best on your food truck business! Farewell, my friend.",
];

let _obTutLineIdx = 0;
let _obTutCharIdx = 0;
let _obTutTyping = false;
let _obTutTimer = null;
let _obTutLines = OB_TUT_LINES;
let _obTutOnDone = null;
let cookingTutorialShown = false;
let cookingTutorialLineIdx = 0;
let cookingTutorialCharIdx = 0;
let cookingTutorialTyping = false;
let cookingTutorialTimer = null;

function _showServingTutWrap() {
  const wrap = document.getElementById('serving-tutorial-wrap');
  wrap.classList.remove('hidden');
  wrap.style.display = '';
}

function _hideServingTutWrap() {
  const wrap = document.getElementById('serving-tutorial-wrap');
  wrap.classList.add('hidden');
  wrap.style.display = 'none';
  wrap.removeEventListener('click', _obTutAdvance);
}

function _obTutType(text) {
  const el = document.getElementById('serving-tut-text');
  el.textContent = '';
  _obTutCharIdx = 0;
  _obTutTyping = true;
  (function tick() {
    if (_obTutCharIdx < text.length) {
      el.textContent += text[_obTutCharIdx++];
      _obTutTimer = setTimeout(tick, TYPEWRITER_MS);
    } else {
      _obTutTyping = false;
      _obTutTimer = null;
    }
  })();
}

function _obTutAdvance() {
  if (_obTutTyping) {
    clearTimeout(_obTutTimer);
    _obTutTimer = null;
    _obTutTyping = false;
    document.getElementById('serving-tut-text').textContent = _obTutLines[_obTutLineIdx];
    return;
  }
  _obTutLineIdx++;
  if (_obTutLineIdx < _obTutLines.length) {
    _obTutType(_obTutLines[_obTutLineIdx]);
  } else {
    _hideServingTutWrap();
    if (_obTutOnDone) { const cb = _obTutOnDone; _obTutOnDone = null; cb(); }
  }
}

function _startTutDialogue(lines, onDone) {
  _obTutLines = lines;
  _obTutLineIdx = 0;
  _obTutOnDone = onDone;
  _showServingTutWrap();
  const wrap = document.getElementById('serving-tutorial-wrap');
  wrap.addEventListener('click', _obTutAdvance);
  _obTutType(lines[0]);
}

function startOrderBoxTutorial() {
  _startTutDialogue(OB_TUT_LINES, showKitchenArrow);
}

function showKitchenArrow() {
  const arrow = document.getElementById('to-kitchen-arrow');
  arrow.classList.remove('hidden');
  arrow.classList.add('bob-anim');
  arrow.addEventListener('click', goToKitchen, { once: true });

  // Delay so the dismissal click doesn't immediately fire the new listener
  setTimeout(() => _startTutDialogue(KITCHEN_TUT_LINES, null), 50);
}

function goToKitchen() {
  const servingScreen = document.getElementById('serving-screen');
  servingScreen.classList.add('slide-up-out');
  setTimeout(() => {
    servingScreen.classList.remove('slide-up-out');
    showScreen('cooking-screen');
    initCookingScreen();
    if (!cookingTutorialShown) startCookingTutorial();
  }, 620);
}

function startCookingTutorial() {
  cookingTutorialShown = true;
  cookingTutorialLineIdx = 0;
  cookingTutorialTyping = false;
  const overlay = document.getElementById('cooking-tutorial-overlay');
  const speech = document.getElementById('cooking-tutorial-speech');
  overlay.classList.remove('hidden');
  speech.addEventListener('click', advanceCookingTutorial);
  typeCookingTutorialLine(COOKING_TUT_LINES[0]);
}

function typeCookingTutorialLine(text) {
  const textEl = document.getElementById('cooking-tutorial-text');
  textEl.textContent = '';
  cookingTutorialCharIdx = 0;
  cookingTutorialTyping = true;
  (function tick() {
    if (cookingTutorialCharIdx < text.length) {
      textEl.textContent += text[cookingTutorialCharIdx++];
      cookingTutorialTimer = setTimeout(tick, TYPEWRITER_MS);
    } else {
      cookingTutorialTyping = false;
      cookingTutorialTimer = null;
    }
  })();
}

function advanceCookingTutorial() {
  if (cookingTutorialTyping) {
    clearTimeout(cookingTutorialTimer);
    cookingTutorialTimer = null;
    cookingTutorialTyping = false;
    document.getElementById('cooking-tutorial-text').textContent =
      COOKING_TUT_LINES[cookingTutorialLineIdx];
    return;
  }

  cookingTutorialLineIdx++;
  if (cookingTutorialLineIdx < COOKING_TUT_LINES.length) {
    typeCookingTutorialLine(COOKING_TUT_LINES[cookingTutorialLineIdx]);
    return;
  }

  document.getElementById('cooking-tutorial-speech')
    .removeEventListener('click', advanceCookingTutorial);
  document.getElementById('cooking-tutorial-overlay').classList.add('hidden');
}

/* ─────────────────────────────────────────────
   COOKING SCREEN
───────────────────────────────────────────── */
function initCookingScreen() {
  initIngredientStock();
  setCookingSlide(1);

  document.getElementById('hit-cooking-next1').onclick = () => setCookingSlide(2);
  document.getElementById('hit-cooking-next2').onclick = () => setCookingSlide(3);
  document.getElementById('hit-cooking-last1').onclick = () => setCookingSlide(1);
  document.getElementById('hit-cooking-last2').onclick = () => setCookingSlide(2);
  const goToCounter = () => {
    fadeToScene('serving-screen', () => {
      const arrow = document.getElementById('to-kitchen-arrow');
      arrow.classList.remove('hidden');
      arrow.classList.add('bob-anim');
      arrow.addEventListener('click', goToKitchen, { once: true });
      if (successfulDishReady) {
        const orderBox = document.getElementById('order-box-wrap');
        orderBox.style.pointerEvents = 'auto';
        orderBox.style.cursor = 'pointer';
        orderBox.onclick = serveSuccessfulDish;
      } else {
        const orderBox = document.getElementById('order-box-wrap');
        orderBox.style.pointerEvents = 'auto';
        orderBox.style.cursor = 'pointer';
        orderBox.onclick = showKitchenArrow;
      }
    });
  };
  document.getElementById('hit-cooking-to-counter').onclick = goToCounter;
  document.getElementById('cooking-to-counter').onclick = goToCounter;

  ['hit-ing-slot1', 'hit-ing-slot2', 'hit-ing-slot3'].forEach((id, index) => {
    document.getElementById(id).onmousedown = (e) => startIngredientDrag(currentCookingIngredients()[index], e);
  });
  document.getElementById('hit-rice').onmousedown = (e) => startIngredientDrag('rice', e);
  document.getElementById('hit-noodles').onmousedown = (e) => {
    if (!noodlesOpened) {
      noodlesOpened = true;
      document.getElementById('ing-noodles').src = 'assets/cooking/noodles_opened.png';
      return;
    }
    startIngredientDrag('noodles', e);
  };
  document.getElementById('hit-egg').onmousedown = (e) => startIngredientDrag('egg', e);
  resetCookingPot();
  document.getElementById('hit-cooking-cook').onclick = cookPot;
  document.getElementById('hit-cooking-clear').onclick = clearPot;
  document.getElementById('hit-cooking-meter').onclick = finishCooking;
  document.getElementById('cooking-result-ok').onclick = closeCookingResult;
}

let cookingSlide = 1;
const ingredientStock = {};
let noodlesOpened = false;
let potStartStock = null;
let potStartSprites = null;
let cookingFailures = 0;
let successfulDishReady = false;
let cookingMeterFrame = null;
let cookingMeterActive = false;
let cookingMeterStartedAt = 0;
let cookingMeterPosition = 0;
let cookingResultKind = null;
let currentOrderDish = null;
let preparedDishKey = null;
let potIngredients = [];
let wrongDishesServed = 0;
let customersServed = 0;
let customersSpawned = 0;
let nextCustomerType = null;
let servingInProgress = false;
let dayEnded = false;
const COOKING_INGREDIENTS = [
  ['mushrooms', 'broccoli', 'tofu'],
  ['tomatoes', 'cabbage', 'corn'],
  ['carrots'],
];
const FULL_INGREDIENT_SOURCES = {
  mushrooms: 'assets/full_ingredients/mushroom.png',
  tomatoes: 'assets/full_ingredients/tomato.png',
  carrots: 'assets/full_ingredients/carrots.png',
  egg: 'assets/full_ingredients/egg.png',
  noodles: 'assets/full_ingredients/noodles.png',
};

function canonicalIngredient(name) {
  return ({ mushrooms: 'mushroom', tomatoes: 'tomato', carrots: 'carrot' }[name] || name);
}

function initIngredientStock() {
  [...COOKING_INGREDIENTS.flat(), 'rice', 'noodles', 'egg'].forEach(name => {
    if (ingredientStock[name] === undefined) {
      ingredientStock[name] = name === 'egg' ? 4 : name === 'rice' || name === 'noodles' ? 12 : 9;
    }
  });
  updateEggSprite();
  updateIngredientStockUI();
}

function currentCookingIngredients() {
  return COOKING_INGREDIENTS[cookingSlide - 1];
}

function useIngredient(name) {
  if (!name || !ingredientStock[name]) return;
  ingredientStock[name]--;
  updateIngredientStockUI();

  if (name === 'noodles' && ingredientStock[name] === 11) {
    document.getElementById('ing-noodles').src = 'assets/cooking/noodles_opened.png';
  }
  if (name === 'rice' && ingredientStock[name] === 0) {
    document.getElementById('ing-rice').src = 'assets/cooking/rice_empty.png';
  }
  if (name === 'noodles' && ingredientStock[name] === 0) {
    document.getElementById('ing-noodles').src = 'assets/cooking/noodles_trash.png';
  }
  if (name === 'egg') {
    updateEggSprite();
  }
  if (ingredientStock[name] === 0 && !['rice', 'noodles', 'egg'].includes(name)) {
    document.getElementById(`ing-${name}`).style.display = 'none';
  }
}

function updateEggSprite() {
  const eggSprites = {
    4: 'assets/cooking/egg_full.png',
    3: 'assets/cooking/egg_3.png',
    2: 'assets/cooking/egg_2.png',
    1: 'assets/cooking/egg_1.png',
    0: 'assets/cooking/eggs_empty.png',
  };
  const egg = document.getElementById('ing-egg');
  if (egg) egg.src = eggSprites[ingredientStock.egg] || eggSprites[0];
}

let activeIngredientDrag = null;

function startIngredientDrag(name, event) {
  if (!name || !ingredientStock[name]) return;
  if (name === 'noodles' && !noodlesOpened) return;
  event.preventDefault();

  const source = document.getElementById(`ing-${name}`);
  const hit = document.getElementById(
    name === 'rice' ? 'hit-rice'
      : name === 'noodles' ? 'hit-noodles'
        : name === 'egg' ? 'hit-egg'
          : `hit-ing-slot${currentCookingIngredients().indexOf(name) + 1}`,
  );
  const copy = document.createElement('img');
  copy.src = name === 'rice'
    ? source.src
    : (FULL_INGREDIENT_SOURCES[name] || `assets/full_ingredients/${canonicalIngredient(name)}.png`);
  // Rice keeps its full-scene cooking sprite. Egg and noodles use their
  // standalone full_ingredients sprites like the regular ingredients.
  const isFullSceneIngredient = ['rice'].includes(name);
  copy.className = `dragged-ingredient dragged-${name}${isFullSceneIngredient ? '' : ' dragged-full-ingredient'}`;
  copy.draggable = false;
  document.getElementById('pot-contents').appendChild(copy);

  activeIngredientDrag = {
    name,
    copy,
    sourceRect: hit.getBoundingClientRect(),
    startX: event.clientX,
    startY: event.clientY,
    grabOffsetX: event.clientX - hit.getBoundingClientRect().left,
    grabOffsetY: event.clientY - hit.getBoundingClientRect().top,
    isFullIngredient: !isFullSceneIngredient,
  };
  moveIngredientDrag(event);
  document.addEventListener('mousemove', moveIngredientDrag);
  document.addEventListener('mouseup', finishIngredientDrag, { once: true });
}

function moveIngredientDrag(event) {
  if (!activeIngredientDrag) return;
  const gameRect = document.getElementById('game-container').getBoundingClientRect();
  // The game layer is already laid out in rendered CSS pixels. Keep the
  // pointer delta in that same coordinate system.
  const dx = event.clientX - activeIngredientDrag.startX;
  const dy = event.clientY - activeIngredientDrag.startY;

  if (activeIngredientDrag.isFullIngredient) {
    // Standalone full_ingredients sprites should start at the source hit area
    // and move with it, instead of being drawn from the pot layer's origin.
    // Preserve the point where the player grabbed the ingredient.
    activeIngredientDrag.copy.style.left =
      `${activeIngredientDrag.sourceRect.left - gameRect.left + dx - activeIngredientDrag.grabOffsetX}px`;
    activeIngredientDrag.copy.style.top =
      `${activeIngredientDrag.sourceRect.top - gameRect.top + dy - activeIngredientDrag.grabOffsetY}px`;
    activeIngredientDrag.copy.style.transform = 'none';
  } else {
    // Full-scene rice and egg sprites retain their existing origin/clip
    // behavior, so the copied image moves as one complete cooking layer.
    activeIngredientDrag.copy.style.left = '0';
    activeIngredientDrag.copy.style.top = '0';
    activeIngredientDrag.copy.style.transform = `translate(${dx}px, ${dy}px)`;
  }
}

function finishIngredientDrag(event) {
  if (!activeIngredientDrag) return;
  document.removeEventListener('mousemove', moveIngredientDrag);
  const pot = document.getElementById('hit-cooking-pot').getBoundingClientRect();
  const dx = event.clientX - activeIngredientDrag.startX;
  const dy = event.clientY - activeIngredientDrag.startY;
  const source = activeIngredientDrag.sourceRect;
  const insidePot =
    source.left + dx >= pot.left &&
    source.top + dy >= pot.top &&
    source.right + dx <= pot.right &&
    source.bottom + dy <= pot.bottom;

  if (insidePot) {
    if (!potStartStock) {
      potStartStock = { ...ingredientStock };
      potStartSprites = {
        rice: document.getElementById('ing-rice').src,
        noodles: document.getElementById('ing-noodles').src,
        egg: document.getElementById('ing-egg').src,
      };
    }
    useIngredient(activeIngredientDrag.name);
    potIngredients.push(activeIngredientDrag.name);
    activeIngredientDrag.copy.style.zIndex = '32';
  } else {
    activeIngredientDrag.copy.remove();
  }
  activeIngredientDrag = null;
}

function resetCookingPot() {
  cookingMeterActive = false;
  if (cookingMeterFrame) cancelAnimationFrame(cookingMeterFrame);
  document.getElementById('cooking-bar-wrap').classList.remove('active');
  document.getElementById('cooking-pot').src = 'assets/cooking/pot_open.png';
  document.getElementById('pot-contents').innerHTML = '';
  document.getElementById('pot-contents').style.display = '';
  potStartStock = null;
  potStartSprites = null;
  potIngredients = [];
}

function cookPot() {
  if (cookingMeterActive) return;
  document.getElementById('pot-contents').style.display = 'none';
  document.getElementById('cooking-pot').src = 'assets/cooking/pot_close.png';
  document.getElementById('cooking-bar-wrap').classList.add('active');
  cookingMeterActive = true;
  cookingMeterStartedAt = performance.now();
  animateCookingMeter(cookingMeterStartedAt);
}

function animateCookingMeter(now) {
  if (!cookingMeterActive) return;
  const cycle = ((now - cookingMeterStartedAt) / 900) % 2;
  cookingMeterPosition = cycle <= 1 ? cycle : 2 - cycle;
  const meter = document.getElementById('cooking-bar-meter');
  meter.style.left = `${20 + cookingMeterPosition * 60}%`;
  cookingMeterFrame = requestAnimationFrame(animateCookingMeter);
}

function finishCooking() {
  if (!cookingMeterActive) return;
  cookingMeterActive = false;
  cancelAnimationFrame(cookingMeterFrame);
  document.getElementById('cooking-bar-wrap').classList.remove('active');

  const result = cookingMeterPosition < 0.18 || cookingMeterPosition > 0.82
    ? 'red'
    : cookingMeterPosition < 0.38 || cookingMeterPosition > 0.62
      ? 'yellow'
      : 'green';

  if (result === 'red') {
    cookingFailures++;
    cookingResultKind = 'red';
    restorePotIngredients();
    successfulDishReady = false;
    showCookingResult('Cooking failed :(', 'Ingredients burnt. Try again?');
  } else if (result === 'yellow') {
    cookingResultKind = 'yellow';
    restorePotIngredients();
    successfulDishReady = false;
    showCookingResult('Cooking questionable :/', 'Ingredients still usable. Try again?');
  } else {
    cookingResultKind = 'green';
    preparedDishKey = findDishKey(potIngredients);
    successfulDishReady = true;
    showCookingResult('Cooking success! :D', 'Serve this dish to your customer.');
  }
}

function showCookingResult(title, message) {
  document.getElementById('cooking-result-title').textContent = title;
  document.getElementById('cooking-result-message').textContent = message;
  showModal('cooking-result-modal');
}

function closeCookingResult() {
  hideModal('cooking-result-modal');
  if (cookingResultKind !== 'green') resetCookingPot();
  cookingResultKind = null;
}

function restorePotIngredients() {
  if (!potStartStock) return;
  Object.assign(ingredientStock, potStartStock);
  if (potStartSprites) {
    document.getElementById('ing-rice').src = potStartSprites.rice;
    document.getElementById('ing-noodles').src = potStartSprites.noodles;
  }
  updateEggSprite();
  updateIngredientStockUI();
  setCookingSlide(cookingSlide);
}

function clearPot() {
  if (potStartStock) {
    Object.assign(ingredientStock, potStartStock);
    document.getElementById('ing-rice').src = potStartSprites.rice;
    document.getElementById('ing-noodles').src = potStartSprites.noodles;
    updateEggSprite();
    updateIngredientStockUI();
    setCookingSlide(cookingSlide);
  }
  document.getElementById('pot-contents').innerHTML = '';
  document.getElementById('pot-contents').style.display = '';
  document.getElementById('cooking-pot').src = 'assets/cooking/pot_open.png';
  document.getElementById('cooking-bar-wrap').classList.remove('active');
  potStartStock = null;
  potStartSprites = null;
  potIngredients = [];
}

function serveSuccessfulDish() {
  if (!successfulDishReady || servingInProgress || dayEnded) return;
  const orderBox = document.getElementById('order-box-wrap');
  orderBox.classList.add('hidden');
  orderBox.style.pointerEvents = 'none';
  orderBox.onclick = null;
  successfulDishReady = false;
  const correct = preparedDishKey && currentOrderDish && preparedDishKey === currentOrderDish.key;
  if (correct) {
    money += currentOrderDish.price;
    dayEarned += currentOrderDish.price;
    totalEarned += currentOrderDish.price;
    totalSatisfied++;
    updateMoneyHud();
  } else {
    wrongDishesServed++;
    totalAngry++;
  }
  totalCustomersServed++;
  showCustomerReaction(correct);
}

function findDishKey(ingredients) {
  const actual = ingredients.map(canonicalIngredient).sort().join('|');
  const match = DISH_RECIPES.find(dish =>
    [...dish.ingredients, dish.base].map(canonicalIngredient).sort().join('|') === actual
  );
  return match ? match.key : null;
}

function showCustomerReaction(correct) {
  servingInProgress = true;
  const bg = document.getElementById('customer-reaction-bg');
  const dish = document.getElementById('customer-reaction-dish');
  bg.src = correct ? 'assets/serving/order_status.png' : 'assets/serving/angry.png';
  dish.src = correct ? `assets/cooking/dishes/${currentOrderDish.key}.png` : '';
  dish.style.display = correct ? '' : 'none';
  document.getElementById('customer-reaction').classList.remove('hidden');
  setTimeout(advanceCustomerQueue, 3000);
}

function advanceCustomerQueue() {
  if (dayEnded) return;
  document.getElementById('customer-reaction').classList.add('hidden');
  const active = document.getElementById('customer-active');
  const next = document.getElementById('customer-next');
  // Do not let the one-time entrance animation compete with the queue
  // transition when this element is reused for a later customer.
  active.classList.remove('slide-in');
  next.classList.remove('slide-in');
  active.classList.add('customer-slide-away');
  next.classList.add('customer-promote');

  setTimeout(() => {
    const promotedType = nextCustomerType;
    active.classList.remove('customer-slide-away');
    clearCustomerSlot(active);
    if (promotedType) {
      _activeCustomerType = promotedType;
      _startToggle(active, promotedType);
    }

    clearCustomerSlot(next);
    next.classList.remove('customer-promote');
    if (customersSpawned < customersPerDay()) {
      nextCustomerType = _randomType();
      customersSpawned++;
      _startToggle(next, nextCustomerType);
    } else {
      nextCustomerType = null;
    }

    customersServed++;
    servingInProgress = false;
    preparedDishKey = null;
    potIngredients = [];
    if (customersServed >= customersPerDay()) {
      dayEnded = true;
      fadeToScene('day-summary-screen', renderDaySummary);
      return;
    }
    showOrderBox(_activeCustomerType, false);
  }, 650);
}

function updateIngredientStockUI() {
  document.querySelectorAll('.ing-hover-hit, .base-hover-hit').forEach(hit => {
    const name = hit.id === 'hit-rice'
      ? 'rice'
      : hit.id === 'hit-noodles'
        ? 'noodles'
        : hit.id === 'hit-egg'
          ? 'egg'
        : currentCookingIngredients()[Number(hit.id.slice(-1)) - 1];
    const count = hit.querySelector('.ingredient-count');
    if (!name) {
      count.style.display = 'none';
      return;
    }
    count.style.display = '';
    count.textContent = ingredientStock[name];
    hit.classList.toggle('depleted', ingredientStock[name] === 0);
  });
}

function setCookingSlide(n) {
  cookingSlide = n;
  // Show/hide slide-2 and slide-3 elements
  document.querySelectorAll('.ing-s2').forEach(el => el.style.display = n === 2 ? 'block' : 'none');
  document.querySelectorAll('.ing-s3').forEach(el => el.style.display = n === 3 ? 'block' : 'none');
  // Slide 1 elements (no class) — hide when not slide 1
  const s1els = ['ing-mushrooms','ing-broccoli','ing-tofu','cooking-next1','hit-cooking-next1'];
  s1els.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = n === 1 ? '' : 'none';
  });
  document.querySelectorAll('.ing-img').forEach(el => {
    if (ingredientStock[el.id.replace('ing-', '')] === 0) el.style.display = 'none';
  });
  updateIngredientStockUI();
}

function _randomType() {
  return CUSTOMER_TYPES[Math.floor(Math.random() * CUSTOMER_TYPES.length)];
}

function _startToggle(slot, type) {
  if (slot._spriteTimer) clearInterval(slot._spriteTimer);
  let f = 1;
  const img = document.createElement("img");
  img.src = `assets/customers/${type}_1.png`;
  img.draggable = false;
  slot.innerHTML = "";
  slot.appendChild(img);
  const t = setInterval(() => {
    f = f === 1 ? 2 : 1;
    img.src = `assets/customers/${type}_${f}.png`;
  }, 400);
  slot._spriteTimer = t;
}

function clearCustomerSlot(slot) {
  if (slot._spriteTimer) {
    clearInterval(slot._spriteTimer);
    slot._spriteTimer = null;
  }
  slot.innerHTML = "";
}

document.addEventListener("newCustomer", () => {
  const active = document.getElementById("customer-active");
  const next = document.getElementById("customer-next");

  customersSpawned = 2;
  customersServed = 0;
  wrongDishesServed = 0;
  dayEnded = false;
  nextCustomerType = _randomType();
  _activeCustomerType = _randomType();
  _startToggle(active, _activeCustomerType);
  active.classList.remove("slide-in");
  void active.offsetWidth; // reflow to restart animation
  active.classList.add("slide-in");
  active.addEventListener("animationend", () => {
    active.classList.remove("slide-in");
  }, { once: true });

  _startToggle(next, nextCustomerType);
});

/* ─────────────────────────────────────────────
   INITIALISE
───────────────────────────────────────────── */
loadSettings();
updateMoneyHud();
