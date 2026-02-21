const audio = document.getElementById('audio');

// ── Icons ─────────────────────────────────────────────────────────────────────

const ICON_PLAY  = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

// State
let currentAlbum = null;
let currentTrackIndex = -1;
let isPlaying = false;
let progressHovered = false;
let isShuffle = false;
let repeatMode = 'none'; // 'none' | 'one' | 'album'
let userAlbums = [];

// Elements
const viewAlbums = document.getElementById('view-albums');
const viewTracks = document.getElementById('view-tracks');
const albumsGrid = document.getElementById('albums-grid');
const trackList = document.getElementById('track-list');
const player = document.getElementById('player');

const btnPlay = document.getElementById('btn-play');
const btnMiniPlay = document.getElementById('btn-mini-play');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnBack = document.getElementById('btn-back');
const btnShuffle = document.getElementById('btn-shuffle');
const btnRepeat = document.getElementById('btn-repeat');

const progressBar = document.getElementById('progress-bar');
const volumeBar = document.getElementById('volume-bar');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');

const playerCover = document.getElementById('player-cover');
const playerTrack = document.getElementById('player-track');
const playerArtist = document.getElementById('player-artist');

// Fullscreen player elements
const playerFullscreen = document.getElementById('player-fullscreen');
const pfCover = document.getElementById('pf-cover');
const pfTrack = document.getElementById('pf-track');
const pfArtist = document.getElementById('pf-artist');
const pfProgress = document.getElementById('pf-progress');
const pfTimeCurrent = document.getElementById('pf-time-current');
const pfTimeTotal = document.getElementById('pf-time-total');
const pfBtnPlay = document.getElementById('pf-play');
const pfBtnPrev = document.getElementById('pf-prev');
const pfBtnNext = document.getElementById('pf-next');
const pfBtnShuffle = document.getElementById('pf-shuffle');
const pfBtnRepeat = document.getElementById('pf-repeat');

// ── Supabase ──────────────────────────────────────────────────────────────────

const _sb     = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET  = 'music';

function _publicUrl(path) {
  return _sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function loadUserAlbums() {
  const { data, error } = await _sb
    .from('albums')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('Supabase load error:', error); return; }

  userAlbums = (data || []).map(row => ({
    id:          row.id,
    title:       row.title,
    artist:      row.artist,
    year:        row.year,
    cover:       row.cover_path ? _publicUrl(row.cover_path) : '',
    tracks:      row.tracks.map(t => ({ title: t.title, file: _publicUrl(t.file_path) })),
    _userAlbum:  true,
    _coverPath:  row.cover_path,
    _trackPaths: row.tracks.map(t => t.file_path),
  }));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Smooth color interpolation: 0 = white, 1 = yellow
let colorT = 0;

function lerpColor(t) {
  // white #e8e8e8 → purple #A855F7
  const r = Math.round(232 + (168 - 232) * t);
  const g = Math.round(232 + ( 85 - 232) * t);
  const b = Math.round(232 + (247 - 232) * t);
  return `rgb(${r},${g},${b})`;
}

function updateProgressFill(overridePct) {
  const pct = overridePct ?? (audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
  const color = lerpColor(colorT);
  progressBar.style.background =
    `linear-gradient(to right, ${color} ${pct}%, var(--border) ${pct}%)`;
  timeCurrent.style.left = `calc(6px + ${pct}% - ${pct * 0.12}px)`;
  pfProgress.style.background =
    `linear-gradient(to right, #A855F7 ${pct}%, var(--border) ${pct}%)`;
}

// ── Fullscreen player ──────────────────────────────────────────────────────────

function openFullscreenPlayer() {
  playerFullscreen.classList.add('open');
}

function closeFullscreenPlayer() {
  playerFullscreen.classList.remove('open');
}

function updateFullscreenPlayerUI() {
  if (!currentAlbum || currentTrackIndex === -1) return;
  const track = currentAlbum.tracks[currentTrackIndex];
  pfCover.src = currentAlbum.cover;
  pfTrack.textContent = track.title;
  pfArtist.textContent = currentAlbum.artist;
  pfBtnPlay.innerHTML = ICON_PAUSE;
  pfProgress.value = progressBar.value;
  pfTimeCurrent.textContent = timeCurrent.textContent;
  pfTimeTotal.textContent = timeTotal.textContent;
  updatePfShuffleRepeat();
}

function updatePfShuffleRepeat() {
  pfBtnShuffle.classList.toggle('mode-active', isShuffle);
  pfBtnRepeat.classList.remove('mode-active', 'mode-active-one');
  if (repeatMode === 'album') pfBtnRepeat.classList.add('mode-active');
  if (repeatMode === 'one') pfBtnRepeat.classList.add('mode-active-one');
}

function setView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
}

// ── Render albums ─────────────────────────────────────────────────────────────

function renderAlbums() {
  albumsGrid.innerHTML = '';
  userAlbums.forEach((album, index) => {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.innerHTML = `
      <img src="${album.cover}" alt="${album.title}" loading="lazy" />
      <div class="album-card-info">
        <span class="album-card-title">${album.title}</span>
        <span class="album-card-artist">${album.artist}</span>
      </div>
    `;
    card.addEventListener('click', () => openAlbum(index));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete-album';
    delBtn.title = 'Удалить';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteUserAlbum(album);
    });
    card.appendChild(delBtn);

    albumsGrid.appendChild(card);
  });
}

// ── Open album ────────────────────────────────────────────────────────────────

function openAlbum(index) {
  currentAlbum = userAlbums[index];

  document.getElementById('album-cover-big').src = currentAlbum.cover;
  document.getElementById('album-title').textContent = currentAlbum.title;
  document.getElementById('album-artist').textContent = currentAlbum.artist;
  document.getElementById('album-year').textContent = currentAlbum.year ?? '';

  renderTracks();
  setView('tracks');
}

function renderTracks() {
  trackList.innerHTML = '';
  currentAlbum.tracks.forEach((track, i) => {
    const li = document.createElement('li');
    li.className = 'track-item';
    li.dataset.index = i;
    li.innerHTML = `
      <span class="track-num">${i + 1}</span>
      <span class="track-name">${track.title}</span>
      <span class="track-duration" id="dur-${i}">—</span>
      <button class="btn-delete-track" title="Удалить трек">×</button>
    `;
    li.addEventListener('click', () => playTrack(i));
    li.querySelector('.track-name').addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startRenameTrack(li.querySelector('.track-name'), i);
    });
    li.querySelector('.btn-delete-track').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTrack(i);
    });
    trackList.appendChild(li);

    // Preload duration without downloading the full file
    const tmp = new Audio();
    tmp.src = track.file;
    tmp.addEventListener('loadedmetadata', () => {
      const el = document.getElementById(`dur-${i}`);
      if (el) el.textContent = formatTime(tmp.duration);
    });
  });

  const addBtn = document.createElement('li');
  addBtn.className = 'track-add-btn';
  addBtn.id = 'track-add-btn';
  addBtn.textContent = '+ Добавить треки';
  addBtn.addEventListener('click', () => addTracksInput.click());
  trackList.appendChild(addBtn);
}

// ── Playback ──────────────────────────────────────────────────────────────────

function playTrack(index) {
  if (!currentAlbum) return;

  currentTrackIndex = index;
  const track = currentAlbum.tracks[index];

  audio.src = track.file;
  audio.volume = volumeBar.value;
  audio.play();
  isPlaying = true;

  updatePlayerUI();
  highlightActiveTrack();
}

function updatePlayerUI() {
  const track = currentAlbum.tracks[currentTrackIndex];
  playerTrack.textContent = track.title;
  playerArtist.textContent = currentAlbum.artist;
  playerCover.src = currentAlbum.cover;
  btnPlay.innerHTML = ICON_PAUSE;
  btnMiniPlay.innerHTML = ICON_PAUSE;
  player.classList.remove('hidden');
  progressBar.value = 0;
  pfProgress.value = 0;
  updateProgressFill();
  updateFullscreenPlayerUI();
}

function highlightActiveTrack() {
  document.querySelectorAll('.track-item').forEach(el => {
    el.classList.toggle('active', Number(el.dataset.index) === currentTrackIndex);
  });
}

function togglePlay() {
  if (!currentAlbum || currentTrackIndex === -1) return;
  if (audio.paused) {
    audio.play();
    isPlaying = true;
    btnPlay.innerHTML = ICON_PAUSE;
    btnMiniPlay.innerHTML = ICON_PAUSE;
    pfBtnPlay.innerHTML = ICON_PAUSE;
  } else {
    audio.pause();
    isPlaying = false;
    btnPlay.innerHTML = ICON_PLAY;
    btnMiniPlay.innerHTML = ICON_PLAY;
    pfBtnPlay.innerHTML = ICON_PLAY;
  }
}

function playNext() {
  if (!currentAlbum) return;
  let next;
  if (isShuffle) {
    const len = currentAlbum.tracks.length;
    if (len <= 1) {
      next = 0;
    } else {
      do { next = Math.floor(Math.random() * len); } while (next === currentTrackIndex);
    }
  } else {
    const nextIndex = currentTrackIndex + 1;
    if (nextIndex >= currentAlbum.tracks.length) {
      if (repeatMode === 'album') {
        next = 0;
      } else {
        audio.pause();
        isPlaying = false;
        btnPlay.innerHTML = ICON_PLAY;
        return;
      }
    } else {
      next = nextIndex;
    }
  }
  playTrack(next);
}

function playPrev() {
  if (!currentAlbum) return;
  // Restart if more than 3 seconds in, else go to previous track
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  const prev = (currentTrackIndex - 1 + currentAlbum.tracks.length) % currentAlbum.tracks.length;
  playTrack(prev);
}

// ── Audio events ──────────────────────────────────────────────────────────────

let rafId = null;
let isScrubbing = false;

function tickProgress() {
  // Smoothly lerp color toward target (0 = white, 1 = yellow)
  const target = progressHovered ? 1 : 0;
  const colorDone = Math.abs(target - colorT) < 0.001;
  if (!colorDone) {
    colorT += (target - colorT) * 0.12;
    if (Math.abs(target - colorT) < 0.001) colorT = target;
  }

  if (audio.duration && !isScrubbing) {
    const val = (audio.currentTime / audio.duration) * 1000;
    progressBar.value = val;
    pfProgress.value = val;
  }
  if (audio.duration) {
    updateProgressFill();
    const cur = formatTime(audio.currentTime);
    timeCurrent.textContent = cur;
    pfTimeCurrent.textContent = cur;
  }

  // Keep looping if playing or color is still animating
  if (!audio.paused || !colorDone) {
    rafId = requestAnimationFrame(tickProgress);
  } else {
    rafId = null;
  }
}

audio.addEventListener('loadedmetadata', () => {
  const dur = formatTime(audio.duration);
  timeTotal.textContent = dur;
  pfTimeTotal.textContent = dur;
});

audio.addEventListener('ended', playNext);

audio.addEventListener('pause', () => {
  btnPlay.innerHTML = ICON_PLAY;
  btnMiniPlay.innerHTML = ICON_PLAY;
  pfBtnPlay.innerHTML = ICON_PLAY;
  // rAF loop self-terminates when paused and color animation is done
});

audio.addEventListener('play', () => {
  btnPlay.innerHTML = ICON_PAUSE;
  btnMiniPlay.innerHTML = ICON_PAUSE;
  pfBtnPlay.innerHTML = ICON_PAUSE;
  if (!rafId) rafId = requestAnimationFrame(tickProgress);
});

// ── Controls ──────────────────────────────────────────────────────────────────

btnPlay.addEventListener('click', togglePlay);
btnMiniPlay.addEventListener('click', togglePlay);
btnNext.addEventListener('click', playNext);
btnPrev.addEventListener('click', playPrev);

function toggleShuffle() {
  isShuffle = !isShuffle;
  btnShuffle.classList.toggle('mode-active', isShuffle);
  pfBtnShuffle.classList.toggle('mode-active', isShuffle);
}

function toggleRepeat() {
  if (repeatMode === 'none') {
    repeatMode = 'album';
    audio.loop = false;
    btnRepeat.classList.add('mode-active');
    pfBtnRepeat.classList.add('mode-active');
  } else if (repeatMode === 'album') {
    repeatMode = 'one';
    audio.loop = true;
    btnRepeat.classList.remove('mode-active');
    btnRepeat.classList.add('mode-active-one');
    pfBtnRepeat.classList.remove('mode-active');
    pfBtnRepeat.classList.add('mode-active-one');
  } else {
    repeatMode = 'none';
    audio.loop = false;
    btnRepeat.classList.remove('mode-active-one');
    pfBtnRepeat.classList.remove('mode-active-one');
  }
}

btnShuffle.addEventListener('click', toggleShuffle);
btnRepeat.addEventListener('click', toggleRepeat);

const progressWrapper = document.querySelector('.player-progress-wrapper');
progressWrapper.addEventListener('mouseenter', () => {
  progressHovered = true;
  if (!rafId) rafId = requestAnimationFrame(tickProgress);
});
progressWrapper.addEventListener('mouseleave', () => {
  progressHovered = false;
  if (!rafId) rafId = requestAnimationFrame(tickProgress);
});

progressBar.addEventListener('mousedown', () => { isScrubbing = true; });
progressBar.addEventListener('touchstart', () => { isScrubbing = true; }, { passive: true });

progressBar.addEventListener('input', () => {
  if (audio.duration) {
    const pct = (progressBar.value / 1000) * 100;
    updateProgressFill(pct);
    timeCurrent.textContent = formatTime((progressBar.value / 1000) * audio.duration);
  }
});

progressBar.addEventListener('change', () => {
  if (audio.duration) {
    audio.currentTime = (progressBar.value / 1000) * audio.duration;
  }
  isScrubbing = false;
});

volumeBar.addEventListener('input', () => {
  audio.volume = volumeBar.value;
});

btnBack.addEventListener('click', () => {
  setView('albums');
});

// ── Fullscreen player controls ─────────────────────────────────────────────────

pfBtnPlay.addEventListener('click', togglePlay);
pfBtnPrev.addEventListener('click', playPrev);
pfBtnNext.addEventListener('click', playNext);
pfBtnShuffle.addEventListener('click', toggleShuffle);
pfBtnRepeat.addEventListener('click', toggleRepeat);

// Open fullscreen by tapping player-info area (mobile)
document.querySelector('.player-info').addEventListener('click', () => {
  if (currentAlbum && currentTrackIndex !== -1) openFullscreenPlayer();
});

// Close fullscreen by tapping handle bar
document.querySelector('.pf-handle-bar').addEventListener('click', closeFullscreenPlayer);

// Close fullscreen by swipe down
let pfTouchStartY = 0;
playerFullscreen.addEventListener('touchstart', (e) => {
  pfTouchStartY = e.touches[0].clientY;
}, { passive: true });
playerFullscreen.addEventListener('touchend', (e) => {
  if (e.changedTouches[0].clientY - pfTouchStartY > 80) closeFullscreenPlayer();
}, { passive: true });

// Fullscreen progress bar scrubbing
pfProgress.addEventListener('touchstart', () => { isScrubbing = true; }, { passive: true });
pfProgress.addEventListener('mousedown', () => { isScrubbing = true; });
pfProgress.addEventListener('input', () => {
  if (audio.duration) {
    const pct = (pfProgress.value / 1000) * 100;
    pfProgress.style.background =
      `linear-gradient(to right, #A855F7 ${pct}%, var(--border) ${pct}%)`;
    progressBar.value = pfProgress.value;
    progressBar.style.background = pfProgress.style.background;
    pfTimeCurrent.textContent = formatTime((pfProgress.value / 1000) * audio.duration);
  }
});
pfProgress.addEventListener('change', () => {
  if (audio.duration) {
    audio.currentTime = (pfProgress.value / 1000) * audio.duration;
  }
  isScrubbing = false;
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if (e.code === 'ArrowRight') playNext();
  if (e.code === 'ArrowLeft') playPrev();
});

// ── Upload Modal ───────────────────────────────────────────────────────────────

const uploadModal    = document.getElementById('upload-modal');
const uploadTitleEl  = document.getElementById('upload-title');
const uploadArtistEl = document.getElementById('upload-artist');
const uploadYearEl   = document.getElementById('upload-year');
const coverDropZone  = document.getElementById('cover-drop-zone');
const coverInput     = document.getElementById('upload-cover');
const tracksDropZone = document.getElementById('tracks-drop-zone');
const tracksInput    = document.getElementById('upload-tracks');
const modalTrackList = document.getElementById('modal-track-list');

let pendingCoverFile  = null;
let pendingTrackFiles = []; // [{file, title}]

document.getElementById('btn-add-album').addEventListener('click', openUploadModal);
document.getElementById('upload-cancel').addEventListener('click', closeUploadModal);
document.getElementById('upload-save').addEventListener('click', saveUploadedAlbum);

uploadModal.addEventListener('click', (e) => {
  if (e.target === uploadModal) closeUploadModal();
});

function openUploadModal() {
  pendingCoverFile = null;
  pendingTrackFiles = [];
  uploadTitleEl.value = '';
  uploadArtistEl.value = '';
  uploadYearEl.value = '';
  uploadTitleEl.classList.remove('input-error');
  uploadArtistEl.classList.remove('input-error');
  document.getElementById('cover-drop-hint').textContent = 'Перетащи или кликни для выбора изображения';
  coverDropZone.querySelector('.cover-preview')?.remove();
  document.getElementById('tracks-drop-hint').textContent = 'Перетащи или кликни для выбора аудио';
  modalTrackList.innerHTML = '';
  uploadModal.classList.remove('hidden');
}

function closeUploadModal() {
  uploadModal.classList.add('hidden');
}

// Cover
coverDropZone.addEventListener('click', () => coverInput.click());
coverDropZone.addEventListener('dragover', (e) => { e.preventDefault(); coverDropZone.classList.add('drag-over'); });
coverDropZone.addEventListener('dragleave', () => coverDropZone.classList.remove('drag-over'));
coverDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  coverDropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) setCoverFile(file);
});
coverInput.addEventListener('change', () => {
  if (coverInput.files[0]) setCoverFile(coverInput.files[0]);
  coverInput.value = '';
});

function setCoverFile(file) {
  pendingCoverFile = file;
  document.getElementById('cover-drop-hint').textContent = file.name;
  let img = coverDropZone.querySelector('.cover-preview');
  if (!img) {
    img = document.createElement('img');
    img.className = 'cover-preview';
    coverDropZone.prepend(img);
  }
  img.src = URL.createObjectURL(file);
}

// Tracks
tracksDropZone.addEventListener('click', () => tracksInput.click());
tracksDropZone.addEventListener('dragover', (e) => { e.preventDefault(); tracksDropZone.classList.add('drag-over'); });
tracksDropZone.addEventListener('dragleave', () => tracksDropZone.classList.remove('drag-over'));
tracksDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  tracksDropZone.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
  if (files.length) setTrackFiles(files);
});
tracksInput.addEventListener('change', () => {
  if (tracksInput.files.length) setTrackFiles(Array.from(tracksInput.files));
  tracksInput.value = '';
});

function parseTrackTitle(filename) {
  let name = filename.replace(/\.[^.]+$/, '');          // strip extension
  name = name.replace(/^\d+[\s\-\.]+/, '');             // strip leading "01 - "
  name = name.replace(/[-_]/g, ' ').trim();
  return name || filename;
}

function setTrackFiles(files) {
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  pendingTrackFiles = files.map(f => ({ file: f, title: parseTrackTitle(f.name) }));
  const n = files.length;
  document.getElementById('tracks-drop-hint').textContent =
    `${n} ${n === 1 ? 'файл' : n < 5 ? 'файла' : 'файлов'} выбрано`;
  renderModalTrackList();
}

function renderModalTrackList() {
  modalTrackList.innerHTML = '';
  pendingTrackFiles.forEach((t, i) => {
    const li = document.createElement('li');
    li.className = 'modal-track-item';
    const span = document.createElement('span');
    span.className = 'track-order';
    span.textContent = i + 1;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = t.title;
    inp.placeholder = 'Название трека';
    inp.addEventListener('input', (e) => { pendingTrackFiles[i].title = e.target.value; });
    li.append(span, inp);
    modalTrackList.appendChild(li);
  });
}

async function saveUploadedAlbum() {
  const title  = uploadTitleEl.value.trim();
  const artist = uploadArtistEl.value.trim();

  let valid = true;
  uploadTitleEl.classList.toggle('input-error', !title);
  uploadArtistEl.classList.toggle('input-error', !artist);
  if (!title || !artist) valid = false;
  if (!pendingTrackFiles.length) { tracksDropZone.classList.add('drag-over'); valid = false; }
  if (!valid) return;

  tracksDropZone.classList.remove('drag-over');

  const saveBtn = document.getElementById('upload-save');
  saveBtn.disabled = true;

  const albumId = crypto.randomUUID();

  try {
    // Upload cover
    let coverPath = null;
    if (pendingCoverFile) {
      const ext = pendingCoverFile.name.split('.').pop();
      coverPath = `${albumId}/cover.${ext}`;
      saveBtn.textContent = 'Загрузка обложки…';
      const { error } = await _sb.storage.from(BUCKET).upload(coverPath, pendingCoverFile);
      if (error) throw error;
    }

    // Upload tracks
    const tracksMeta = [];
    for (let i = 0; i < pendingTrackFiles.length; i++) {
      const { file, title: trackTitle } = pendingTrackFiles[i];
      const ext = file.name.split('.').pop();
      const filePath = `${albumId}/${i}.${ext}`;
      saveBtn.textContent = `Загрузка треков (${i + 1}/${pendingTrackFiles.length})…`;
      const { error } = await _sb.storage.from(BUCKET).upload(filePath, file);
      if (error) throw error;
      tracksMeta.push({ title: trackTitle, file_path: filePath, order: i });
    }

    // Insert album row
    saveBtn.textContent = 'Сохранение…';
    const { data, error } = await _sb
      .from('albums')
      .insert({ title, artist, year: parseInt(uploadYearEl.value) || null, cover_path: coverPath, tracks: tracksMeta })
      .select()
      .single();
    if (error) throw error;

    userAlbums.unshift({
      id:          data.id,
      title:       data.title,
      artist:      data.artist,
      year:        data.year,
      cover:       coverPath ? _publicUrl(coverPath) : '',
      tracks:      tracksMeta.map(t => ({ title: t.title, file: _publicUrl(t.file_path) })),
      _userAlbum:  true,
      _coverPath:  coverPath,
      _trackPaths: tracksMeta.map(t => t.file_path),
    });

    renderAlbums();
    closeUploadModal();
  } catch (err) {
    console.error('Ошибка загрузки:', err);
    alert('Ошибка при загрузке. Проверь консоль.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Сохранить';
  }
}

async function deleteUserAlbum(album) {
  if (!confirm('Удалить альбом?')) return;

  const { error } = await _sb.from('albums').delete().eq('id', album.id);
  if (error) { console.error(error); return; }

  const paths = [...(album._trackPaths || [])];
  if (album._coverPath) paths.push(album._coverPath);
  if (paths.length) await _sb.storage.from(BUCKET).remove(paths);

  userAlbums = userAlbums.filter(a => a.id !== album.id);
  renderAlbums();
}

// ── Change album cover ────────────────────────────────────────────────────────

const changeCoverInput = document.getElementById('change-cover-input');
document.getElementById('album-cover-wrapper').addEventListener('click', () => changeCoverInput.click());

changeCoverInput.addEventListener('change', () => {
  if (changeCoverInput.files[0]) changeCover(changeCoverInput.files[0]);
  changeCoverInput.value = '';
});

async function changeCover(file) {
  const localUrl = URL.createObjectURL(file);
  document.getElementById('album-cover-big').src = localUrl;
  playerCover.src = localUrl;

  const ext = file.name.split('.').pop();
  const coverPath = `${currentAlbum.id}/cover.${ext}`;

  if (currentAlbum._coverPath && currentAlbum._coverPath !== coverPath) {
    await _sb.storage.from(BUCKET).remove([currentAlbum._coverPath]);
  }

  const { error: upErr } = await _sb.storage.from(BUCKET).upload(coverPath, file, { upsert: true });
  if (upErr) { console.error('Ошибка загрузки обложки:', upErr); return; }

  const { error: dbErr } = await _sb.from('albums').update({ cover_path: coverPath }).eq('id', currentAlbum.id);
  if (dbErr) { console.error('Ошибка обновления обложки:', dbErr); return; }

  const newUrl = _publicUrl(coverPath);
  currentAlbum.cover = newUrl;
  currentAlbum._coverPath = coverPath;
  document.getElementById('album-cover-big').src = newUrl;
  playerCover.src = newUrl;

  const inList = userAlbums.find(a => a.id === currentAlbum.id);
  if (inList) { inList.cover = newUrl; inList._coverPath = coverPath; }
  renderAlbums();
}

// ── Rename track ──────────────────────────────────────────────────────────────

function startRenameTrack(span, trackIndex) {
  const oldTitle = span.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'track-rename-input';
  input.value = oldTitle;
  span.replaceWith(input);
  input.focus();
  input.select();

  async function commit() {
    const newTitle = input.value.trim() || oldTitle;
    input.replaceWith(span);
    span.textContent = newTitle;
    if (newTitle !== oldTitle) {
      currentAlbum.tracks[trackIndex].title = newTitle;
      if (currentAlbum._userAlbum) await saveTrackRename(trackIndex);
      if (currentTrackIndex === trackIndex) playerTrack.textContent = newTitle;
    }
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = oldTitle; input.blur(); }
  });
}

async function saveTrackRename(trackIndex) {
  const rawTracks = currentAlbum._trackPaths.map((fp, i) => ({
    title: currentAlbum.tracks[i].title,
    file_path: fp,
    order: i,
  }));
  const { error } = await _sb.from('albums').update({ tracks: rawTracks }).eq('id', currentAlbum.id);
  if (error) console.error('Ошибка переименования:', error);
  const inList = userAlbums.find(a => a.id === currentAlbum.id);
  if (inList) inList.tracks[trackIndex].title = currentAlbum.tracks[trackIndex].title;
}

async function deleteTrack(trackIndex) {
  if (!currentAlbum) return;

  currentAlbum.tracks.splice(trackIndex, 1);

  if (currentAlbum._userAlbum) {
    const removedPath = currentAlbum._trackPaths.splice(trackIndex, 1)[0];

    const rawTracks = currentAlbum._trackPaths.map((fp, i) => ({
      title: currentAlbum.tracks[i].title,
      file_path: fp,
      order: i,
    }));
    const { error } = await _sb.from('albums').update({ tracks: rawTracks }).eq('id', currentAlbum.id);
    if (error) { console.error('Ошибка удаления трека:', error); return; }

    if (removedPath) {
      await _sb.storage.from(BUCKET).remove([removedPath]);
    }

    const inList = userAlbums.find(a => a.id === currentAlbum.id);
    if (inList) { inList.tracks = [...currentAlbum.tracks]; inList._trackPaths = [...currentAlbum._trackPaths]; }
  }

  if (currentTrackIndex === trackIndex) {
    audio.pause();
    audio.src = '';
    isPlaying = false;
    currentTrackIndex = -1;
    player.classList.add('hidden');
  } else if (currentTrackIndex > trackIndex) {
    currentTrackIndex--;
  }

  renderTracks();
  if (currentTrackIndex >= 0) highlightActiveTrack();
}

// ── Add tracks to existing album ──────────────────────────────────────────────

const addTracksInput = document.getElementById('add-tracks-input');

addTracksInput.addEventListener('change', () => {
  if (addTracksInput.files.length) addTracksToAlbum(Array.from(addTracksInput.files));
  addTracksInput.value = '';
});

async function addTracksToAlbum(files) {
  if (!currentAlbum) return;

  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const addBtn = document.getElementById('track-add-btn');
  if (addBtn) { addBtn.classList.add('loading'); addBtn.textContent = 'Подготовка…'; }

  if (addBtn) addBtn.textContent = 'Загрузка…';

  const albumId    = currentAlbum.id;
  const startIndex = currentAlbum._trackPaths.length;
  const newMeta    = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext  = file.name.split('.').pop();
      const filePath = `${albumId}/${startIndex + i}.${ext}`;
      if (addBtn) addBtn.textContent = `Загрузка (${i + 1}/${files.length})…`;
      const { error } = await _sb.storage.from(BUCKET).upload(filePath, file);
      if (error) throw error;
      newMeta.push({ title: parseTrackTitle(file.name), file_path: filePath, order: startIndex + i });
    }

    // Rebuild full tracks array for DB (raw format)
    const rawTracks = currentAlbum._trackPaths.map((fp, i) => ({
      title: currentAlbum.tracks[i].title,
      file_path: fp,
      order: i,
    }));
    const updatedTracks = [...rawTracks, ...newMeta];

    const { error } = await _sb.from('albums').update({ tracks: updatedTracks }).eq('id', albumId);
    if (error) throw error;

    // Update local state
    currentAlbum.tracks      = [...currentAlbum.tracks,      ...newMeta.map(t => ({ title: t.title, file: _publicUrl(t.file_path) }))];
    currentAlbum._trackPaths = [...currentAlbum._trackPaths, ...newMeta.map(t => t.file_path)];

    const inList = userAlbums.find(a => a.id === albumId);
    if (inList) { inList.tracks = currentAlbum.tracks; inList._trackPaths = currentAlbum._trackPaths; }

    renderTracks();
  } catch (err) {
    console.error('Ошибка добавления треков:', err);
    alert('Ошибка при загрузке. Проверь консоль.');
    if (addBtn) { addBtn.classList.remove('loading'); addBtn.textContent = '+ Добавить треки'; }
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  await loadUserAlbums();
  renderAlbums();
}

init();
