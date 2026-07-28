/**
 * DM Soundboard - script.js
 *
 * Audio files are loaded from the device via the file picker and stored
 * permanently in IndexedDB (as ArrayBuffers). No server needed.
 * Blob URLs are created on-demand for playback and released on stop.
 */

// ─────────────────────────────────────────────
//  IndexedDB helpers
// ─────────────────────────────────────────────

const DB_NAME    = 'dm_soundboard_v1';
const DB_VERSION = 1;
let   db         = null;

function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('categories')) {
        d.createObjectStore('categories', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('sounds')) {
        const s = d.createObjectStore('sounds', { keyPath: 'id' });
        s.createIndex('categoryId', 'categoryId', { unique: false });
      }
    };

    req.onsuccess = e => { db = e.target.result; resolve(); };
    req.onerror   = ()  => reject(req.error);
  });
}

function dbGetAll(store) {
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

function dbGetByIndex(store, index, value) {
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readonly')
                  .objectStore(store).index(index).getAll(value);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

function dbPut(store, item) {
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).put(item);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

function dbDelete(store, key) {
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).delete(key);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

// ─────────────────────────────────────────────
//  App state
// ─────────────────────────────────────────────

let categories      = [];     // [{id, name, order}, ...]
let activeCategoryId = null;
let editMode        = false;

// soundId → { audio: HTMLAudioElement, name, blobUrl }
const activeAudio = {};

// ─────────────────────────────────────────────
//  DOM refs
// ─────────────────────────────────────────────

const tabsEl           = document.getElementById('tabs');
const addTabBtn        = document.getElementById('addTabBtn');
const categoryActionsEl= document.getElementById('categoryActions');
const addSoundsBtn     = document.getElementById('addSoundsBtn');
const renameCatBtn     = document.getElementById('renameCatBtn');
const deleteCatBtn     = document.getElementById('deleteCatBtn');
const fileInput        = document.getElementById('fileInput');
const boardEl          = document.getElementById('board');
const stopAllBtn       = document.getElementById('stopAllBtn');
const editModeBtn      = document.getElementById('editModeBtn');
const nowPlayingLabel  = document.getElementById('nowPlayingLabel');

// ─────────────────────────────────────────────
//  Render: tabs
// ─────────────────────────────────────────────

function renderTabs() {
  tabsEl.innerHTML = '';
  categories.forEach(cat => {
    const btn  = document.createElement('button');
    btn.className = 'tab-btn' + (cat.id === activeCategoryId ? ' active' : '');
    btn.textContent = cat.name;
    btn.addEventListener('click', () => {
      activeCategoryId = cat.id;
      renderTabs();
      renderBoard();
    });
    tabsEl.appendChild(btn);
  });

  // Category action bar visibility
  if (activeCategoryId) {
    categoryActionsEl.classList.remove('hidden');
  } else {
    categoryActionsEl.classList.add('hidden');
  }

  // Rename / delete tab buttons only show in edit mode
  renameCatBtn.classList.toggle('hidden', !editMode);
  deleteCatBtn.classList.toggle('hidden', !editMode);
}

// ─────────────────────────────────────────────
//  Render: sound pads
// ─────────────────────────────────────────────

async function renderBoard() {
  boardEl.innerHTML = '';

  if (!activeCategoryId) {
    boardEl.innerHTML = '<p class="empty-state">Tap <strong>＋ Tab</strong> to create your first category,<br>then tap <strong>＋ Add Sounds</strong> to load audio files.</p>';
    return;
  }

  const sounds = await dbGetByIndex('sounds', 'categoryId', activeCategoryId);

  if (sounds.length === 0) {
    boardEl.innerHTML = '<p class="empty-state">Tap <strong>＋ Add Sounds</strong> to load audio files into this tab.</p>';
  }

  sounds.forEach(sound => {
    const playing = !!activeAudio[sound.id];
    const looping = activeAudio[sound.id]?.audio?.loop ?? false;

    // Outer card
    const pad = document.createElement('div');
    pad.className = 'pad' + (playing ? ' playing' : '');
    pad.dataset.soundId = sound.id;

    // Main play/stop button
    const playBtn = document.createElement('button');
    playBtn.className = 'pad-btn';
    playBtn.textContent = sound.name;
    playBtn.addEventListener('click', () => handlePadTap(sound));

    // Controls row
    const controls = document.createElement('div');
    controls.className = 'pad-controls';

    const status = document.createElement('span');
    status.className = 'pad-status';
    status.textContent = playing ? (looping ? '🔁' : '▶') : '—';

    const loopBtn = document.createElement('button');
    loopBtn.className = 'loop-btn' + (looping ? ' active' : '');
    loopBtn.textContent = '🔁';
    loopBtn.title = 'Loop';
    loopBtn.addEventListener('click', e => {
      e.stopPropagation();
      handleLoop(sound.id);
    });

    const volSlider = document.createElement('input');
    volSlider.type  = 'range';
    volSlider.min   = '0';
    volSlider.max   = '1';
    volSlider.step  = '0.05';
    volSlider.value = activeAudio[sound.id]?.audio?.volume ?? '0.8';
    volSlider.addEventListener('input', () => {
      if (activeAudio[sound.id]) {
        activeAudio[sound.id].audio.volume = parseFloat(volSlider.value);
      }
    });

    controls.append(status, loopBtn, volSlider);
    pad.append(playBtn, controls);

    // Edit-mode controls
    if (editMode) {
      const editRow = document.createElement('div');
      editRow.className = 'edit-row';

      const renameBtn = document.createElement('button');
      renameBtn.className = 'rename-sound-btn';
      renameBtn.textContent = '✏️ Rename';
      renameBtn.addEventListener('click', async e => {
        e.stopPropagation();
        const newName = prompt('Rename sound:', sound.name);
        if (newName?.trim()) {
          sound.name = newName.trim();
          await dbPut('sounds', sound);
          renderBoard();
        }
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-sound-btn';
      deleteBtn.textContent = '🗑 Delete';
      deleteBtn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm(`Delete "${sound.name}"?`)) return;
        stopSound(sound.id);
        await dbDelete('sounds', sound.id);
        renderBoard();
        updateNowPlaying();
      });

      editRow.append(renameBtn, deleteBtn);
      pad.appendChild(editRow);
    }

    boardEl.appendChild(pad);
  });
}

// ─────────────────────────────────────────────
//  Playback
// ─────────────────────────────────────────────

async function handlePadTap(sound) {
  if (activeAudio[sound.id]) {
    stopSound(sound.id);
    updateNowPlaying();
    renderBoard();
    return;
  }

  // Build a blob URL from the stored ArrayBuffer
  const blob    = new Blob([sound.data], { type: sound.mimeType || 'audio/*' });
  const blobUrl = URL.createObjectURL(blob);
  const audio   = new Audio(blobUrl);
  audio.volume  = 0.8;
  audio.loop    = false;

  audio.addEventListener('ended', () => {
    if (!audio.loop) {
      // Audio finished (not looping) — clean up
      URL.revokeObjectURL(blobUrl);
      delete activeAudio[sound.id];
      updateNowPlaying();
      // Update just this pad without full re-render
      const padEl = boardEl.querySelector(`[data-sound-id="${sound.id}"]`);
      if (padEl) padEl.classList.remove('playing');
    }
  });

  audio.play().catch(err => {
    console.error('Playback failed:', err);
    URL.revokeObjectURL(blobUrl);
  });

  activeAudio[sound.id] = { audio, blobUrl, name: sound.name };
  updateNowPlaying();
  renderBoard();
}

function stopSound(id) {
  const entry = activeAudio[id];
  if (!entry) return;
  entry.audio.pause();
  entry.audio.currentTime = 0;
  URL.revokeObjectURL(entry.blobUrl);
  delete activeAudio[id];
}

function handleLoop(soundId) {
  const entry = activeAudio[soundId];
  if (!entry) return;
  entry.audio.loop = !entry.audio.loop;
  // Refresh just the pad
  renderBoard();
}

function stopAll() {
  Object.keys(activeAudio).forEach(stopSound);
  updateNowPlaying();
  renderBoard();
}

function updateNowPlaying() {
  const names = Object.values(activeAudio).map(e => e.name);
  nowPlayingLabel.textContent = names.length
    ? 'Playing: ' + names.join('  •  ')
    : 'Nothing playing';
}

// ─────────────────────────────────────────────
//  Event handlers
// ─────────────────────────────────────────────

// Add category tab
addTabBtn.addEventListener('click', async () => {
  const name = prompt('New tab name:');
  if (!name?.trim()) return;
  const cat = { id: `cat_${Date.now()}`, name: name.trim(), order: categories.length };
  await dbPut('categories', cat);
  categories.push(cat);
  activeCategoryId = cat.id;
  renderTabs();
  renderBoard();
});

// Add sounds via file picker
addSoundsBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const files = Array.from(fileInput.files);
  if (!files.length) return;

  for (const file of files) {
    const data  = await file.arrayBuffer();
    const sound = {
      id:         `snd_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      categoryId: activeCategoryId,
      name:       file.name.replace(/\.[^.]+$/, '').replace(/[_\-]/g, ' ').trim(),
      mimeType:   file.type || 'audio/mpeg',
      data
    };
    await dbPut('sounds', sound);
  }

  fileInput.value = '';
  renderBoard();
});

// Rename current tab
renameCatBtn.addEventListener('click', async () => {
  const cat = categories.find(c => c.id === activeCategoryId);
  if (!cat) return;
  const newName = prompt('Rename tab:', cat.name);
  if (!newName?.trim()) return;
  cat.name = newName.trim();
  await dbPut('categories', cat);
  renderTabs();
});

// Delete current tab and all its sounds
deleteCatBtn.addEventListener('click', async () => {
  const cat = categories.find(c => c.id === activeCategoryId);
  if (!cat) return;
  if (!confirm(`Delete tab "${cat.name}" and ALL its sounds? This cannot be undone.`)) return;

  const sounds = await dbGetByIndex('sounds', 'categoryId', activeCategoryId);
  for (const s of sounds) {
    stopSound(s.id);
    await dbDelete('sounds', s.id);
  }
  await dbDelete('categories', activeCategoryId);

  categories = categories.filter(c => c.id !== activeCategoryId);
  activeCategoryId = categories[0]?.id ?? null;

  updateNowPlaying();
  renderTabs();
  renderBoard();
});

// Stop all
stopAllBtn.addEventListener('click', stopAll);

// Edit mode toggle
editModeBtn.addEventListener('click', () => {
  editMode = !editMode;
  editModeBtn.textContent = editMode ? '✅ Done' : '✏️ Edit';
  editModeBtn.classList.toggle('active', editMode);
  renderTabs();
  renderBoard();
});

// ─────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────

async function init() {
  await initDB();
  const stored = await dbGetAll('categories');
  categories = stored.sort((a, b) => a.order - b.order);
  activeCategoryId = categories[0]?.id ?? null;
  renderTabs();
  await renderBoard();
}

init().catch(console.error);
