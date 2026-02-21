const audio = document.getElementById('audio');

// ── Icons ─────────────────────────────────────────────────────────────────────

const ICON_PLAY  = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

// ── Jamendo ────────────────────────────────────────────────────────────────────
const JAMENDO_CLIENT_ID = '6c3dba93';
const JAMENDO_BASE      = 'https://api.jamendo.com/v3.0';

// State
let currentAlbum = null;
let currentTrackIndex = -1;
let isPlaying = false;
let progressHovered = false;
let isShuffle = false;
let repeatMode = 'none'; // 'none' | 'one' | 'album'
let userAlbums = [];
let currentUser = null;

// Favorites & Playlists state
let userFavorites = [];
let userPlaylists = [];
let currentPlaylist = null;
let navInitialized = false;
const LS_LAST_TRACK = 'tl_last_track';

// Jamendo state
let jamendoResults  = [];
let jamendoSelected = null;

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

const btnPlayerHeart = document.getElementById('btn-player-heart');

// Auth elements
const authFormLogin      = document.getElementById('auth-form-login');
const authFormRegister   = document.getElementById('auth-form-register');
const loginEmailEl       = document.getElementById('login-email');
const loginPasswordEl    = document.getElementById('login-password');
const loginErrorEl       = document.getElementById('login-error');
const btnLogin           = document.getElementById('btn-login');
const registerEmailEl    = document.getElementById('register-email');
const registerPasswordEl = document.getElementById('register-password');
const registerConfirmEl  = document.getElementById('register-confirm');
const registerErrorEl    = document.getElementById('register-error');
const btnRegister        = document.getElementById('btn-register');
const btnLogout          = document.getElementById('btn-logout');

// Jamendo elements
const jamendoModal     = document.getElementById('jamendo-modal');
const jamendoQueryEl   = document.getElementById('jamendo-query');
const jamendoSearchBtn = document.getElementById('jamendo-search-btn');
const jamendoResultsEl = document.getElementById('jamendo-results');
const jamendoStatusEl  = document.getElementById('jamendo-status');
const jamendoImportBtn = document.getElementById('jamendo-import');
const jamendoCancelBtn = document.getElementById('jamendo-cancel');

// ── Supabase ──────────────────────────────────────────────────────────────────

const _sb     = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET  = 'music';

function _publicUrl(path) {
  if (path && path.startsWith('http')) return path;
  return _sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function loadUserAlbums() {
  if (!currentUser) return;

  const { data, error } = await _sb
    .from('albums')
    .select('*')
    .eq('user_id', currentUser.id)
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

  const navViews = ['home', 'albums', 'favorites'];
  document.getElementById('bottom-nav').classList.toggle('hidden', !navViews.includes(name));
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === name);
  });
}

function initBottomNav() {
  if (navInitialized) return;
  navInitialized = true;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'home') renderHomeView();
      if (view === 'favorites') renderFavoritesView();
      setView(view);
    });
  });
  document.getElementById('btn-logout-home').addEventListener('click', handleLogout);
  document.getElementById('btn-back-playlist').addEventListener('click', () => setView('favorites'));
  document.getElementById('btn-create-playlist').addEventListener('click', openCreatePlaylistModal);
  document.getElementById('create-playlist-cancel').addEventListener('click', () =>
    document.getElementById('create-playlist-modal').classList.add('hidden'));
  document.getElementById('create-playlist-save').addEventListener('click', async () => {
    const name = document.getElementById('playlist-name-input').value.trim();
    if (!name) return;
    await createPlaylist(name);
    document.getElementById('playlist-name-input').value = '';
    document.getElementById('create-playlist-modal').classList.add('hidden');
  });
  document.getElementById('add-to-playlist-cancel').addEventListener('click', () =>
    document.getElementById('add-to-playlist-modal').classList.add('hidden'));

  btnPlayerHeart.addEventListener('click', async () => {
    if (!currentAlbum || currentTrackIndex === -1) return;
    await toggleFavorite(currentAlbum.id, currentTrackIndex);
  });
}

// ── LocalStorage: last played track ───────────────────────────────────────────

function saveLastTrack() {
  if (!currentAlbum || currentTrackIndex === -1) return;
  const track = currentAlbum.tracks[currentTrackIndex];
  const data = {
    albumId:    currentAlbum.id,
    trackIndex: currentTrackIndex,
    title:      track.title,
    artist:     currentAlbum.artist,
    cover:      currentAlbum.cover,
    file:       track.file,
  };
  localStorage.setItem(LS_LAST_TRACK, JSON.stringify(data));
}

function loadLastTrack() {
  try {
    const raw = localStorage.getItem(LS_LAST_TRACK);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
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
    const isFav = isTrackFavorited(currentAlbum.id, i);
    li.innerHTML = `
      <span class="track-num">${i + 1}</span>
      <span class="track-name">${track.title}</span>
      <span class="track-duration" id="dur-${i}">—</span>
      <button class="btn-heart ${isFav ? 'btn-heart--active' : ''}" data-track="${i}" title="В избранное">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      </button>
      <button class="btn-add-to-playlist" data-track="${i}" title="Добавить в плейлист">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </button>
      <button class="btn-delete-track" title="Удалить трек">×</button>
    `;
    li.addEventListener('click', () => playTrack(i));
    li.querySelector('.track-name').addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startRenameTrack(li.querySelector('.track-name'), i);
    });
    li.querySelector('.btn-heart').addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleFavorite(currentAlbum.id, i);
    });
    li.querySelector('.btn-add-to-playlist').addEventListener('click', (e) => {
      e.stopPropagation();
      openAddToPlaylistModal(currentAlbum.id, i);
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

// ── Favorites ─────────────────────────────────────────────────────────────────

function isTrackFavorited(albumId, trackIndex) {
  return userFavorites.some(f => f.album_id === albumId && f.track_index === trackIndex);
}

async function toggleFavorite(albumId, trackIndex) {
  if (!currentUser || !currentAlbum) return;
  const existing = userFavorites.find(
    f => f.album_id === albumId && f.track_index === trackIndex
  );
  if (existing) {
    await _sb.from('favorites').delete().eq('id', existing.id);
    userFavorites = userFavorites.filter(f => f.id !== existing.id);
  } else {
    const track = currentAlbum.tracks[trackIndex];
    const { data, error } = await _sb.from('favorites').insert({
      user_id:      currentUser.id,
      album_id:     albumId,
      track_index:  trackIndex,
      track_title:  track.title,
      album_title:  currentAlbum.title,
      album_artist: currentAlbum.artist,
      album_cover:  currentAlbum.cover,
      file_path:    track.file,
    }).select().single();
    if (error) { console.error('favorites insert:', error.message); return; }
    userFavorites.unshift(data);
  }
  updateHeartIcon(trackIndex);
}

function updateHeartIcon(trackIndex) {
  if (!currentAlbum) return;
  const isFav = isTrackFavorited(currentAlbum.id, trackIndex);
  // Кнопка в треклисте
  const btn = document.querySelector(`.btn-heart[data-track="${trackIndex}"]`);
  if (btn) btn.classList.toggle('btn-heart--active', isFav);
  // Кнопка в плеере (если играет именно этот трек)
  if (trackIndex === currentTrackIndex) {
    btnPlayerHeart.classList.toggle('btn-heart--active', isFav);
  }
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
  saveLastTrack();
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
  // Обновить кнопку сердца в плеере
  const isFav = isTrackFavorited(currentAlbum.id, currentTrackIndex);
  btnPlayerHeart.classList.toggle('btn-heart--active', isFav);
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

// ── Home View ─────────────────────────────────────────────────────────────────

function renderHomeView() {
  const lastTrack = loadLastTrack();
  const lastSection = document.getElementById('home-last-played-section');
  const lastEl = document.getElementById('home-last-played');

  if (lastTrack) {
    lastSection.style.display = '';
    lastEl.innerHTML = `
      <div class="home-last-card">
        <img src="${lastTrack.cover || ''}" alt="${lastTrack.title}" class="home-last-cover" />
        <div class="home-last-info">
          <span class="home-last-title">${lastTrack.title}</span>
          <span class="home-last-artist">${lastTrack.artist}</span>
        </div>
        <button class="btn-modal-save home-last-play" id="btn-resume-play">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 5v14l11-7z"/></svg>
          Слушать
        </button>
      </div>`;
    document.getElementById('btn-resume-play').addEventListener('click', () => {
      const album = userAlbums.find(a => a.id === lastTrack.albumId);
      if (album) {
        currentAlbum = album;
        playTrack(lastTrack.trackIndex);
      }
    });
  } else {
    lastSection.style.display = 'none';
  }

  const recentGrid = document.getElementById('home-recent-albums');
  recentGrid.innerHTML = '';
  userAlbums.slice(0, 6).forEach((album, index) => {
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
    recentGrid.appendChild(card);
  });
}

// ── Favorites View ────────────────────────────────────────────────────────────

function renderFavoritesView() {
  renderFavoritesList();
  renderPlaylistsSection();
}

function renderFavoritesList() {
  const list = document.getElementById('favorites-list');
  list.innerHTML = '';

  if (!userFavorites.length) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'Нет любимых треков. Нажми ♥ на треке в альбоме';
    list.appendChild(li);
    return;
  }

  userFavorites.forEach((fav, i) => {
    const li = document.createElement('li');
    li.className = 'track-item';
    li.dataset.index = i;
    li.innerHTML = `
      <img src="${fav.album_cover || ''}" class="fav-track-cover" alt="" />
      <div class="fav-track-info">
        <span class="track-name">${fav.track_title}</span>
        <span class="fav-track-artist">${fav.album_artist} — ${fav.album_title}</span>
      </div>
      <button class="btn-heart btn-heart--active" data-fav="${fav.id}" title="Убрать из избранного">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      </button>
    `;
    li.addEventListener('click', (e) => {
      if (e.target.closest('.btn-heart')) return;
      playFavoriteFromIndex(i);
    });
    li.querySelector('.btn-heart').addEventListener('click', async (e) => {
      e.stopPropagation();
      await _sb.from('favorites').delete().eq('id', fav.id);
      userFavorites = userFavorites.filter(f => f.id !== fav.id);
      renderFavoritesList();
    });
    list.appendChild(li);
  });
}

function playFavoriteFromIndex(startIndex) {
  const virtualAlbum = {
    id:     'favorites',
    title:  'Любимые треки',
    artist: '',
    cover:  userFavorites[startIndex]?.album_cover || '',
    tracks: userFavorites.map(f => ({ title: f.track_title, file: f.file_path })),
  };
  currentAlbum = virtualAlbum;
  playTrack(startIndex);
}

// ── Playlists ─────────────────────────────────────────────────────────────────

function renderPlaylistsSection() {
  const grid = document.getElementById('playlists-grid');
  grid.innerHTML = '';

  if (!userPlaylists.length) {
    const msg = document.createElement('p');
    msg.className = 'empty-state';
    msg.textContent = 'Нет плейлистов. Нажми "+ Создать"';
    grid.appendChild(msg);
    return;
  }

  userPlaylists.forEach(pl => {
    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.innerHTML = `
      <div class="playlist-card-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>
      </div>
      <span class="playlist-card-name">${pl.name}</span>
    `;
    card.addEventListener('click', () => openPlaylist(pl.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete-album';
    delBtn.title = 'Удалить плейлист';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Удалить плейлист "${pl.name}"?`)) return;
      await _sb.from('playlists').delete().eq('id', pl.id);
      userPlaylists = userPlaylists.filter(p => p.id !== pl.id);
      renderPlaylistsSection();
    });
    card.appendChild(delBtn);
    grid.appendChild(card);
  });
}

function openCreatePlaylistModal() {
  document.getElementById('playlist-name-input').value = '';
  document.getElementById('create-playlist-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('playlist-name-input').focus(), 50);
}

async function createPlaylist(name) {
  const { data, error } = await _sb.from('playlists').insert({
    user_id: currentUser.id,
    name: name,
  }).select().single();
  if (!error) {
    userPlaylists.unshift(data);
    renderPlaylistsSection();
  }
}

async function openPlaylist(playlistId) {
  const pl = userPlaylists.find(p => p.id === playlistId);
  if (!pl) return;

  const { data } = await _sb
    .from('playlist_tracks')
    .select('*')
    .eq('playlist_id', playlistId)
    .order('track_order', { ascending: true });

  currentPlaylist = { ...pl, tracks: data || [] };
  document.getElementById('playlist-title').textContent = pl.name;
  document.getElementById('playlist-track-count').textContent =
    `${currentPlaylist.tracks.length} ${pluralTracks(currentPlaylist.tracks.length)}`;

  renderPlaylistTracks();
  setView('playlist');
}

function pluralTracks(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'трек';
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'трека';
  return 'треков';
}

function renderPlaylistTracks() {
  const list = document.getElementById('playlist-track-list');
  list.innerHTML = '';

  if (!currentPlaylist || !currentPlaylist.tracks.length) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'Нет треков. Добавь треки через "+" в альбоме';
    list.appendChild(li);
    return;
  }

  currentPlaylist.tracks.forEach((t, i) => {
    const li = document.createElement('li');
    li.className = 'track-item';
    li.dataset.index = i;
    li.innerHTML = `
      <span class="track-num">${i + 1}</span>
      <span class="track-name">${t.track_title}</span>
      <span style="font-size:12px;color:var(--muted);padding:0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.album_artist}</span>
      <button class="btn-delete-track" title="Убрать из плейлиста">×</button>
    `;
    li.addEventListener('click', (e) => {
      if (e.target.closest('.btn-delete-track')) return;
      playPlaylist(i);
    });
    li.querySelector('.btn-delete-track').addEventListener('click', async (e) => {
      e.stopPropagation();
      await _sb.from('playlist_tracks').delete().eq('id', t.id);
      currentPlaylist.tracks.splice(i, 1);
      document.getElementById('playlist-track-count').textContent =
        `${currentPlaylist.tracks.length} ${pluralTracks(currentPlaylist.tracks.length)}`;
      renderPlaylistTracks();
    });
    list.appendChild(li);
  });
}

function playPlaylist(startIndex = 0) {
  if (!currentPlaylist || !currentPlaylist.tracks.length) return;
  const virtualAlbum = {
    id:     currentPlaylist.id,
    title:  currentPlaylist.name,
    artist: 'Плейлист',
    cover:  currentPlaylist.tracks[0]?.album_cover || '',
    tracks: currentPlaylist.tracks.map(t => ({ title: t.track_title, file: t.file_path })),
  };
  currentAlbum = virtualAlbum;
  playTrack(startIndex);
}

async function addTrackToPlaylist(playlistId, albumId, trackIndex) {
  if (!currentAlbum) return;
  const track = currentAlbum.tracks[trackIndex];

  const { data: existing } = await _sb
    .from('playlist_tracks')
    .select('track_order')
    .eq('playlist_id', playlistId)
    .order('track_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing[0] ? existing[0].track_order + 1 : 0;

  await _sb.from('playlist_tracks').insert({
    playlist_id:  playlistId,
    track_order:  nextOrder,
    album_id:     albumId,
    track_index:  trackIndex,
    track_title:  track.title,
    album_title:  currentAlbum.title,
    album_artist: currentAlbum.artist,
    album_cover:  currentAlbum.cover,
    file_path:    track.file,
  });
}

function openAddToPlaylistModal(albumId, trackIndex) {
  const modal = document.getElementById('add-to-playlist-modal');
  const list = document.getElementById('add-to-playlist-list');
  list.innerHTML = '';

  if (!userPlaylists.length) {
    const msg = document.createElement('p');
    msg.style.cssText = 'color:var(--muted);font-size:13px;padding:8px 0;';
    msg.textContent = 'Нет плейлистов. Создайте первый на странице "Любимые"!';
    list.appendChild(msg);
  } else {
    userPlaylists.forEach(pl => {
      const btn = document.createElement('button');
      btn.className = 'add-to-playlist-item';
      btn.textContent = pl.name;
      btn.addEventListener('click', async () => {
        await addTrackToPlaylist(pl.id, albumId, trackIndex);
        modal.classList.add('hidden');
      });
      list.appendChild(btn);
    });
  }

  modal.classList.remove('hidden');
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); }, { once: true });
}

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
      .insert({ title, artist, year: parseInt(uploadYearEl.value) || null, cover_path: coverPath, tracks: tracksMeta, user_id: currentUser.id })
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

  const paths = [...(album._trackPaths || []), ...(album._coverPath ? [album._coverPath] : [])]
    .filter(p => p && !p.startsWith('http'));
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

  const albumId = currentAlbum.id;
  const newMeta = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext  = file.name.split('.').pop();
      const filePath = `${albumId}/${crypto.randomUUID()}.${ext}`;
      if (addBtn) addBtn.textContent = `Загрузка (${i + 1}/${files.length})…`;
      const { error } = await _sb.storage.from(BUCKET).upload(filePath, file);
      if (error) throw error;
      newMeta.push({ title: parseTrackTitle(file.name), file_path: filePath, order: currentAlbum._trackPaths.length + i });
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

// ── Auth ──────────────────────────────────────────────────────────────────────

async function initAuth() {
  const { data: { session } } = await _sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    await showApp();
  } else {
    setView('auth');
  }

  _sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION') return;
    if (session) {
      currentUser = session.user;
      await showApp();
    } else {
      currentUser = null;
      showAuthScreen();
    }
  });

  document.getElementById('btn-show-register').addEventListener('click', () => {
    authFormLogin.classList.add('hidden');
    authFormRegister.classList.remove('hidden');
    registerErrorEl.textContent = '';
  });
  document.getElementById('btn-show-login').addEventListener('click', () => {
    authFormRegister.classList.add('hidden');
    authFormLogin.classList.remove('hidden');
    loginErrorEl.textContent = '';
  });

  btnLogin.addEventListener('click', handleLogin);
  btnRegister.addEventListener('click', handleRegister);
  btnLogout.addEventListener('click', handleLogout);

  loginPasswordEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
  registerConfirmEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleRegister(); });
}

async function loadFavorites() {
  if (!currentUser) return;
  const { data, error } = await _sb
    .from('favorites')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });
  if (!error) userFavorites = data || [];
}

async function loadPlaylists() {
  if (!currentUser) return;
  const { data, error } = await _sb
    .from('playlists')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });
  if (!error) userPlaylists = data || [];
}

async function showApp() {
  await init();
  await loadFavorites();
  await loadPlaylists();
  initBottomNav();
  renderHomeView();
  setView('home');
}

function showAuthScreen() {
  audio.pause();
  audio.src = '';
  player.classList.add('hidden');
  userAlbums = [];
  currentAlbum = null;
  currentTrackIndex = -1;
  isPlaying = false;
  albumsGrid.innerHTML = '';
  userFavorites = [];
  userPlaylists = [];
  currentPlaylist = null;
  // Сбросить форму регистрации на логин
  authFormRegister.classList.add('hidden');
  authFormLogin.classList.remove('hidden');
  loginErrorEl.textContent = '';
  setView('auth');
}

async function handleLogin() {
  const email    = loginEmailEl.value.trim();
  const password = loginPasswordEl.value;
  loginErrorEl.textContent = '';

  if (!email || !password) {
    loginErrorEl.textContent = 'Введите email и пароль.';
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = 'Входим…';

  const { error } = await _sb.auth.signInWithPassword({ email, password });

  btnLogin.disabled = false;
  btnLogin.textContent = 'Войти';

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      loginErrorEl.textContent = 'Неверный email или пароль.';
    } else if (error.message.includes('Email not confirmed')) {
      loginErrorEl.textContent = 'Подтвердите email перед входом.';
    } else {
      loginErrorEl.textContent = error.message;
    }
  }
}

async function handleRegister() {
  const email    = registerEmailEl.value.trim();
  const password = registerPasswordEl.value;
  const confirm  = registerConfirmEl.value;
  registerErrorEl.textContent = '';
  registerErrorEl.style.color = '#ff5555';

  if (!email || !password || !confirm) {
    registerErrorEl.textContent = 'Заполните все поля.';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    registerErrorEl.textContent = 'Введите корректный email.';
    return;
  }
  if (password.length < 6) {
    registerErrorEl.textContent = 'Пароль должен быть не менее 6 символов.';
    return;
  }
  if (password !== confirm) {
    registerErrorEl.textContent = 'Пароли не совпадают.';
    return;
  }

  btnRegister.disabled = true;
  btnRegister.textContent = 'Создаём аккаунт…';

  const { data, error } = await _sb.auth.signUp({ email, password });

  btnRegister.disabled = false;
  btnRegister.textContent = 'Создать аккаунт';

  if (error) {
    if (error.message.includes('already registered') || error.message.includes('already been registered')) {
      registerErrorEl.textContent = 'Аккаунт с таким email уже существует.';
    } else if (error.message.toLowerCase().includes('email rate limit') || error.message.toLowerCase().includes('rate limit')) {
      registerErrorEl.textContent = 'Слишком много попыток. Попробуйте позже (лимит: ~2 письма в час).';
    } else if (error.message.toLowerCase().includes('sending confirmation email') || error.message.toLowerCase().includes('error sending')) {
      registerErrorEl.textContent = 'Не удалось отправить письмо. Попробуйте позже или обратитесь к администратору.';
    } else {
      registerErrorEl.textContent = error.message;
    }
    return;
  }

  if (!data.session) {
    registerErrorEl.style.color = '#A855F7';
    registerErrorEl.textContent = 'Проверьте email — мы отправили ссылку для подтверждения.';
  }
  // Если session есть — onAuthStateChange сам вызовет showApp()
}

async function handleLogout() {
  await _sb.auth.signOut();
  // onAuthStateChange вызовет showAuthScreen()
}

// ── Jamendo ───────────────────────────────────────────────────────────────────

function openJamendoModal() {
  jamendoResults  = [];
  jamendoSelected = null;
  jamendoQueryEl.value            = '';
  jamendoStatusEl.textContent     = '';
  jamendoResultsEl.innerHTML      = '';
  jamendoResultsEl.appendChild(jamendoStatusEl);
  jamendoImportBtn.disabled       = true;
  jamendoModal.classList.remove('hidden');
  jamendoQueryEl.focus();
}

function closeJamendoModal() {
  jamendoModal.classList.add('hidden');
}

async function searchJamendo() {
  const query = jamendoQueryEl.value.trim();
  if (!query) return;

  jamendoResults  = [];
  jamendoSelected = null;
  jamendoImportBtn.disabled    = true;
  jamendoResultsEl.innerHTML   = '';
  jamendoStatusEl.textContent  = 'Поиск…';
  jamendoResultsEl.appendChild(jamendoStatusEl);
  jamendoSearchBtn.disabled    = true;

  try {
    const url = `${JAMENDO_BASE}/albums/?client_id=${JAMENDO_CLIENT_ID}` +
                `&format=json&limit=10&namesearch=${encodeURIComponent(query)}&include=tracks`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    jamendoResults = data.results || [];

    if (!jamendoResults.length) {
      jamendoStatusEl.textContent = 'Ничего не найдено. Попробуйте другой запрос.';
      return;
    }

    jamendoStatusEl.textContent = '';
    renderJamendoResults();
  } catch (err) {
    console.error('Jamendo search error:', err);
    jamendoStatusEl.textContent = 'Ошибка поиска. Проверьте соединение.';
  } finally {
    jamendoSearchBtn.disabled = false;
  }
}

function renderJamendoResults() {
  Array.from(jamendoResultsEl.children).forEach(el => {
    if (el !== jamendoStatusEl) el.remove();
  });

  jamendoResults.forEach((album, index) => {
    const item = document.createElement('div');
    item.className    = 'jamendo-result-item';
    item.dataset.index = index;

    const trackCount = album.tracks ? album.tracks.length : 0;

    item.innerHTML = `
      <img src="${album.image}" class="jamendo-result-cover" alt="${album.name}" loading="lazy" />
      <div class="jamendo-result-info">
        <span class="jamendo-result-title">${album.name}</span>
        <span class="jamendo-result-artist">${album.artist_name}</span>
        <span class="jamendo-result-meta">${trackCount} треков</span>
      </div>`;

    item.addEventListener('click', () => selectJamendoResult(index));
    jamendoResultsEl.appendChild(item);
  });
}

function selectJamendoResult(index) {
  jamendoSelected = jamendoResults[index];
  jamendoResultsEl.querySelectorAll('.jamendo-result-item').forEach((el, i) => {
    el.classList.toggle('selected', i === index);
  });
  jamendoImportBtn.disabled = false;
}

async function importJamendoAlbum() {
  if (!jamendoSelected || !currentUser) return;

  const album = jamendoSelected;
  jamendoImportBtn.disabled      = true;
  jamendoImportBtn.textContent   = 'Добавление…';

  try {
    const tracksUrl = `${JAMENDO_BASE}/tracks/?client_id=${JAMENDO_CLIENT_ID}` +
                      `&format=json&album_id=${album.id}&limit=50&audioformat=mp32`;
    const tracksRes  = await fetch(tracksUrl);
    const tracksData = await tracksRes.json();
    const tracks     = tracksData.results || [];

    if (!tracks.length) {
      alert('Не удалось получить треки альбома.');
      return;
    }

    const tracksMeta = tracks.map((t, i) => ({
      title:     t.name,
      file_path: t.audio,
      order:     i,
    }));

    const { data: row, error } = await _sb
      .from('albums')
      .insert({
        title:      album.name,
        artist:     album.artist_name,
        year:       album.releasedate ? parseInt(album.releasedate.slice(0, 4)) : null,
        cover_path: album.image,
        tracks:     tracksMeta,
        user_id:    currentUser.id,
      })
      .select()
      .single();

    if (error) throw error;

    userAlbums.unshift({
      id:          row.id,
      title:       row.title,
      artist:      row.artist,
      year:        row.year,
      cover:       album.image,
      tracks:      tracksMeta.map(t => ({ title: t.title, file: t.file_path })),
      _userAlbum:  true,
      _coverPath:  album.image,
      _trackPaths: tracksMeta.map(t => t.file_path),
    });

    renderAlbums();
    closeJamendoModal();
  } catch (err) {
    console.error('Jamendo import error:', err);
    alert('Ошибка при добавлении альбома. Проверь консоль.');
  } finally {
    jamendoImportBtn.disabled    = false;
    jamendoImportBtn.textContent = 'Добавить в библиотеку';
  }
}

document.getElementById('btn-jamendo-search').addEventListener('click', openJamendoModal);
jamendoCancelBtn.addEventListener('click', closeJamendoModal);
jamendoImportBtn.addEventListener('click', importJamendoAlbum);
jamendoSearchBtn.addEventListener('click', searchJamendo);
jamendoModal.addEventListener('click', e => { if (e.target === jamendoModal) closeJamendoModal(); });
jamendoQueryEl.addEventListener('keydown', e => { if (e.key === 'Enter') searchJamendo(); });

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  await loadUserAlbums();
  renderAlbums();
}

initAuth();
