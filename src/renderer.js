const selectFolderBtn = document.getElementById('selectFolderBtn');
const searchInput = document.getElementById('searchInput');
const trackListEl = document.getElementById('trackList');

const albumArt = document.getElementById('albumArt');
const albumArtImg = document.getElementById('albumArtImg');
const tonearm = document.getElementById('tonearm');

let LEMON_FALLBACK = 'assets/lemon.jpg';

function removeWhiteBackground(src, threshold = 235) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > threshold && g > threshold && b > threshold) {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

const nowTitle = document.getElementById('nowTitle');
const nowArtist = document.getElementById('nowArtist');
const nowAlbum = document.getElementById('nowAlbum');

const progressBar = document.getElementById('progressBar');
const currentTimeEl = document.getElementById('currentTime');
const durationTimeEl = document.getElementById('durationTime');

const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

const volumeKnob = document.getElementById('volumeKnob');
const knobArcFill = document.getElementById('knobArcFill');
const knobValue = document.getElementById('knobValue');
const knobDial = document.getElementById('knobDial');

const audio = document.getElementById('audioPlayer');

let allTracks = [];
let filteredTracks = [];
let currentIndex = -1;
let isSeeking = false;

const KNOB_RADIUS = 44;
const KNOB_CIRCUMFERENCE = 2 * Math.PI * KNOB_RADIUS;
const KNOB_ARC_DEG = 360;
const KNOB_ARC_LEN = KNOB_CIRCUMFERENCE * (KNOB_ARC_DEG / 360);

knobArcFill.style.strokeDasharray = `${KNOB_ARC_LEN} ${KNOB_CIRCUMFERENCE}`;

let volume = 80;
const savedVolume = localStorage.getItem('lymo-volume');
if (savedVolume !== null) {
  volume = Math.min(100, Math.max(0, parseFloat(savedVolume)));
}

function volumeIcon(v) {
  if (v === 0) return '🔇';
  if (v < 50) return '🔉';
  return '🔊';
}

let knobShowsPercent = false;
let knobPercentTimer = null;

function setVolume(v, { persist = true } = {}) {
  volume = Math.min(100, Math.max(0, Math.round(v)));
  audio.volume = volume / 100;

  const fillLen = KNOB_ARC_LEN * (volume / 100);
  knobArcFill.style.strokeDasharray = `${fillLen} ${KNOB_CIRCUMFERENCE - fillLen}`;

  const angle = (volume / 100) * KNOB_ARC_DEG;
  knobDial.style.transform = `rotate(${angle}deg)`;

  volumeKnob.setAttribute('aria-valuenow', String(volume));

  knobValue.textContent = knobShowsPercent ? `${volume}%` : volumeIcon(volume);

  if (persist) localStorage.setItem('lymo-volume', String(volume));
}

function flashKnobPercent() {
  knobShowsPercent = true;
  knobValue.textContent = `${volume}%`;
  clearTimeout(knobPercentTimer);
  knobPercentTimer = setTimeout(() => {
    knobShowsPercent = false;
    knobValue.textContent = volumeIcon(volume);
  }, 900);
}

setVolume(volume, { persist: false });

let knobDragging = false;
let knobDragStartY = 0;
let knobDragStartVolume = 0;

volumeKnob.addEventListener('mousedown', (e) => {
  knobDragging = true;
  knobDragStartY = e.clientY;
  knobDragStartVolume = volume;
  volumeKnob.classList.add('dragging');
  volumeKnob.focus();
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (!knobDragging) return;
  const delta = knobDragStartY - e.clientY;
  setVolume(knobDragStartVolume + delta * 0.5);
  flashKnobPercent();
});

window.addEventListener('mouseup', () => {
  if (!knobDragging) return;
  knobDragging = false;
  volumeKnob.classList.remove('dragging');
});

volumeKnob.addEventListener('wheel', (e) => {
  e.preventDefault();
  const step = e.deltaY < 0 ? 2 : -2;
  setVolume(volume + step);
  flashKnobPercent();
}, { passive: false });

volumeKnob.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
    setVolume(volume + 2);
    flashKnobPercent();
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
    setVolume(volume - 2);
    flashKnobPercent();
  }
});

function currentTrackHasCover() {
  return currentIndex >= 0 && allTracks[currentIndex] && !!allTracks[currentIndex].cover;
}

removeWhiteBackground(LEMON_FALLBACK).then((transparentDataUrl) => {
  LEMON_FALLBACK = transparentDataUrl;
  if (!currentTrackHasCover()) {
    albumArtImg.src = LEMON_FALLBACK;
  }
});

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function renderTrackList() {
  trackListEl.innerHTML = '';

  if (filteredTracks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = allTracks.length === 0
      ? 'Select a music folder to get started.'
      : 'No matching songs found.';
    trackListEl.appendChild(empty);
    return;
  }

  filteredTracks.forEach((track) => {
    const realIndex = allTracks.indexOf(track);
    const item = document.createElement('div');
    item.className = 'track-item' + (realIndex === currentIndex ? ' active' : '');

    const thumb = document.createElement('div');
    thumb.className = 'track-thumb';
    if (track.cover) {
      thumb.style.backgroundImage = `url(${track.cover})`;
    }

    const meta = document.createElement('div');
    meta.className = 'track-meta';
    const title = document.createElement('div');
    title.className = 'track-title';
    title.textContent = track.title;
    const artist = document.createElement('div');
    artist.className = 'track-artist';
    artist.textContent = track.artist;
    meta.appendChild(title);
    meta.appendChild(artist);

    item.appendChild(thumb);
    item.appendChild(meta);

    item.addEventListener('click', () => {
      playTrackAt(realIndex);
    });

    trackListEl.appendChild(item);
  });
}

function applyFilter() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    filteredTracks = allTracks.slice();
  } else {
    filteredTracks = allTracks.filter((t) =>
      t.title.toLowerCase().includes(query) ||
      t.artist.toLowerCase().includes(query) ||
      t.album.toLowerCase().includes(query)
    );
  }
  renderTrackList();
}

function updateNowPlayingUI(track) {
  nowTitle.textContent = track.title;
  nowArtist.textContent = track.artist;
  nowAlbum.textContent = track.album;

  albumArtImg.src = track.cover || LEMON_FALLBACK;
}

function playTrackAt(index) {
  if (index < 0 || index >= allTracks.length) return;
  currentIndex = index;
  const track = allTracks[index];

  audio.src = `file://${track.filePath.replace(/\\/g, '/')}`;
  audio.play().catch(() => {});

  updateNowPlayingUI(track);
  renderTrackList();
}

function togglePlayPause() {
  if (currentIndex === -1) {
    if (allTracks.length > 0) playTrackAt(0);
    return;
  }
  if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

audio.addEventListener('play', () => {
  albumArt.classList.add('spinning');
  tonearm.classList.add('playing');
  playIcon.classList.remove('icon-play');
  playIcon.classList.add('icon-pause');
});

audio.addEventListener('pause', () => {
  albumArt.classList.remove('spinning');
  tonearm.classList.remove('playing');
  playIcon.classList.remove('icon-pause');
  playIcon.classList.add('icon-play');
});

audio.addEventListener('ended', () => {
  playNext();
});

audio.addEventListener('timeupdate', () => {
  if (isSeeking) return;
  const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  progressBar.value = pct;
  currentTimeEl.textContent = formatTime(audio.currentTime);
  durationTimeEl.textContent = formatTime(audio.duration);
});

audio.addEventListener('loadedmetadata', () => {
  durationTimeEl.textContent = formatTime(audio.duration);
});

progressBar.addEventListener('input', () => {
  isSeeking = true;
  const pct = progressBar.value;
  currentTimeEl.textContent = formatTime((pct / 100) * (audio.duration || 0));
});

progressBar.addEventListener('change', () => {
  if (audio.duration) {
    audio.currentTime = (progressBar.value / 100) * audio.duration;
  }
  isSeeking = false;
});

function playNext() {
  if (allTracks.length === 0) return;
  const next = (currentIndex + 1) % allTracks.length;
  playTrackAt(next);
}

function playPrev() {
  if (allTracks.length === 0) return;
  const prev = (currentIndex - 1 + allTracks.length) % allTracks.length;
  playTrackAt(prev);
}

playPauseBtn.addEventListener('click', togglePlayPause);
nextBtn.addEventListener('click', playNext);
prevBtn.addEventListener('click', playPrev);
searchInput.addEventListener('input', applyFilter);

async function scanAndLoadFolder(folderPath) {
  trackListEl.innerHTML = '<div class="empty-state">Scanning...</div>';

  const result = await window.lymoAPI.scanFolder(folderPath);
  if (result.error) {
    trackListEl.innerHTML = `<div class="empty-state">Error: ${result.error}</div>`;
    return;
  }

  allTracks = result.tracks;
  currentIndex = -1;
  applyFilter();
}

selectFolderBtn.addEventListener('click', async () => {
  const folderPath = await window.lymoAPI.selectFolder();
  if (!folderPath) return;

  localStorage.setItem('lymo-folder', folderPath);
  await scanAndLoadFolder(folderPath);
});

const savedFolder = localStorage.getItem('lymo-folder');
if (savedFolder) {
  scanAndLoadFolder(savedFolder);
}
