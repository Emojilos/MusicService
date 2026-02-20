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

function getAllAlbums() {
  return [...ALBUMS, ...userAlbums];
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
}

function setView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
}

// ── Render albums ─────────────────────────────────────────────────────────────

function renderAlbums() {
  albumsGrid.innerHTML = '';
  getAllAlbums().forEach((album, index) => {
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

    if (album._userAlbum) {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete-album';
      delBtn.title = 'Удалить';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteUserAlbum(album);
      });
      card.appendChild(delBtn);
    }

    albumsGrid.appendChild(card);
  });
}

// ── Open album ────────────────────────────────────────────────────────────────

function openAlbum(index) {
  currentAlbum = getAllAlbums()[index];

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
    `;
    li.addEventListener('click', () => playTrack(i));
    trackList.appendChild(li);

    // Preload duration without downloading the full file
    const tmp = new Audio();
    tmp.src = track.file;
    tmp.addEventListener('loadedmetadata', () => {
      const el = document.getElementById(`dur-${i}`);
      if (el) el.textContent = formatTime(tmp.duration);
    });
  });
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
  player.classList.remove('hidden');
  progressBar.value = 0;
  updateProgressFill();
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
  } else {
    audio.pause();
    isPlaying = false;
    btnPlay.innerHTML = ICON_PLAY;
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
    progressBar.value = (audio.currentTime / audio.duration) * 1000;
  }
  if (audio.duration) {
    updateProgressFill();
    timeCurrent.textContent = formatTime(audio.currentTime);
  }

  // Keep looping if playing or color is still animating
  if (!audio.paused || !colorDone) {
    rafId = requestAnimationFrame(tickProgress);
  } else {
    rafId = null;
  }
}

audio.addEventListener('loadedmetadata', () => {
  timeTotal.textContent = formatTime(audio.duration);
});

audio.addEventListener('ended', playNext);

audio.addEventListener('pause', () => {
  btnPlay.innerHTML = ICON_PLAY;
  // rAF loop self-terminates when paused and color animation is done
});

audio.addEventListener('play', () => {
  btnPlay.innerHTML = ICON_PAUSE;
  if (!rafId) rafId = requestAnimationFrame(tickProgress);
});

// ── Controls ──────────────────────────────────────────────────────────────────

btnPlay.addEventListener('click', togglePlay);
btnNext.addEventListener('click', playNext);
btnPrev.addEventListener('click', playPrev);

btnShuffle.addEventListener('click', () => {
  isShuffle = !isShuffle;
  btnShuffle.classList.toggle('mode-active', isShuffle);
});

btnRepeat.addEventListener('click', () => {
  if (repeatMode === 'none') {
    repeatMode = 'album';
    audio.loop = false;
    btnRepeat.classList.add('mode-active');
  } else if (repeatMode === 'album') {
    repeatMode = 'one';
    audio.loop = true;
    btnRepeat.classList.remove('mode-active');
    btnRepeat.classList.add('mode-active-one');
  } else {
    repeatMode = 'none';
    audio.loop = false;
    btnRepeat.classList.remove('mode-active-one');
  }
});

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

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  await loadUserAlbums();
  renderAlbums();
}

init();
