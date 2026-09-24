const STORAGE_KEY = 'ender_downloader_media';

const searchInput = document.getElementById('search-input');
const mediaList = document.getElementById('media-list');
const emptyState = document.getElementById('empty-state');
const fabAdd = document.getElementById('fab-add');
const addModal = document.getElementById('add-modal');
const modalTitle = document.getElementById('modal-title');
const modalUrl = document.getElementById('modal-url');
const modalType = document.getElementById('modal-type');
const modalSave = document.getElementById('modal-save');
const modalCancel = document.getElementById('modal-cancel');
const btnAddFirst = document.getElementById('btn-add-first');
const statusText = document.getElementById('status-text');

const btnMinimize = document.getElementById('btn-minimize');
const btnMaximize = document.getElementById('btn-maximize');
const btnClose = document.getElementById('btn-close');
const tabBtns = document.querySelectorAll('.tab-btn');

let media = loadMedia();
let activeTab = 'myt';

btnMinimize.addEventListener('click', () => window.electronAPI.minimize());
btnMaximize.addEventListener('click', () => window.electronAPI.maximize());
btnClose.addEventListener('click', () => window.electronAPI.close());

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    renderMedia();
  });
});

searchInput.addEventListener('input', () => renderMedia());

fabAdd.addEventListener('click', () => addModal.classList.remove('hidden'));
btnAddFirst.addEventListener('click', () => addModal.classList.remove('hidden'));
modalCancel.addEventListener('click', () => addModal.classList.add('hidden'));
addModal.addEventListener('click', (e) => {
  if (e.target === addModal) addModal.classList.add('hidden');
});

modalSave.addEventListener('click', () => {
  const title = modalTitle.value.trim();
  const url = modalUrl.value.trim();
  const type = modalType.value;

  if (!title) {
    statusText.textContent = 'Başlık gerekli';
    return;
  }

  const newItem = {
    id: Date.now(),
    url,
    title,
    type,
    thumbnail: extractThumbnail(url),
    date: new Date().toISOString(),
  };

  media.unshift(newItem);
  saveMedia();
  renderMedia();

  modalTitle.value = '';
  modalUrl.value = '';
  addModal.classList.add('hidden');
  statusText.textContent = 'İçerik eklendi';
});

function loadMedia() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveMedia() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(media));
}

function extractThumbnail(url) {
  if (!url) return '';
  const match = url.match(/(?:v=|\/)([\w-]{11})/);
  return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : '';
}

function renderMedia() {
  const query = searchInput.value.toLowerCase();
  const filtered = media.filter(item => {
    const matchesSearch = !query ||
      item.title.toLowerCase().includes(query) ||
      (item.url && item.url.toLowerCase().includes(query));

    if (activeTab === 'videos') return matchesSearch && item.type === 'video';
    if (activeTab === 'music') return matchesSearch && item.type === 'music';
    if (activeTab === 'myt') return matchesSearch;
    return matchesSearch;
  });

  if (filtered.length === 0) {
    mediaList.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  mediaList.innerHTML = filtered.map(item => createMediaCard(item)).join('');

  mediaList.querySelectorAll('.media-card').forEach(card => {
    const id = parseInt(card.dataset.id);

    card.querySelector('.btn-music')?.addEventListener('click', (e) => {
      e.stopPropagation();
      startDownload(id, 'music');
    });

    card.querySelector('.btn-video')?.addEventListener('click', (e) => {
      e.stopPropagation();
      startDownload(id, 'video');
    });

    card.querySelector('.btn-play')?.addEventListener('click', (e) => {
      e.stopPropagation();
      statusText.textContent = 'Oynatma yakında eklenecek';
    });

    card.querySelector('.btn-add-list')?.addEventListener('click', (e) => {
      e.stopPropagation();
      statusText.textContent = 'Listeye eklendi';
    });

    card.querySelector('.btn-delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      media = media.filter(m => m.id !== id);
      saveMedia();
      renderMedia();
      statusText.textContent = 'Silindi';
    });
  });
}

function createMediaCard(item) {
  const thumbHtml = item.thumbnail
    ? `<img src="${item.thumbnail}" alt="${item.title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'placeholder\\'>${item.type === 'music' ? '♫' : '▶'}</div>'">`
    : `<div class="placeholder">${item.type === 'music' ? '♫' : '▶'}</div>`;

  return `
    <div class="media-card" data-id="${item.id}">
      <div class="media-thumb">${thumbHtml}</div>
      <div class="media-info">
        <div class="media-title">${item.title}</div>
        <div class="media-sub">${item.type === 'music' ? 'Müzik' : 'Video'}</div>
      </div>
      <div class="media-buttons">
        <button class="btn-music" title="Müzik olarak indir">♫</button>
        <button class="btn-video" title="Video olarak indir">▶</button>
        <button class="btn-play" title="Oynat">▶</button>
        <button class="btn-add-list" title="Listeye ekle">+</button>
      </div>
      <button class="btn-delete" title="Sil">×</button>
    </div>
  `;
}

function startDownload(id, type) {
  const item = media.find(m => m.id === id);
  if (!item || !item.url) {
    statusText.textContent = 'URL yok';
    return;
  }
  statusText.textContent = `${type === 'music' ? 'Müzik' : 'Video'} indiriliyor...`;
  window.electronAPI.startDownload && window.electronAPI.startDownload({
    id: item.id,
    url: item.url,
    format: type === 'music' ? 'mp3' : 'mp4',
    quality: 'best',
    mode: type,
  });
}

window.electronAPI.onAction((action) => {
  if (action === 'new-download') {
    searchInput.focus();
  }
});

renderMedia();
