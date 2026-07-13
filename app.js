const fallbackImages = [
  'assets/design/portfolio-1-optimized.webp',
  'assets/design/portfolio-2-optimized.webp',
  'assets/design/portfolio-3-optimized.webp'
];

const btsImages = [
  '452895469_1016606990120479_8996563975133207777_n','724220826_4025087687794696_8108719299838422622_n','724714174_1069435735512725_4564351117593283778_n','725393430_1032101072592813_5313933924234267368_n','726016142_991731423726792_7097684849885605912_n','727641475_1996667004544987_913212530730666871_n','BAO05553','BTS-11','BTS-13','BTS-14','BTS-19','BTS-22','BTS-24','BTS-33','BTS-35','BTS-41','BTS-42','BTS-43','BTS-44','BTS-51','BTS-55','BTS-58','BTS-59','BTS-8','DAT00679','DAT00765','DSC08207','DUY00020','HAI02946','HAI08653','HAI08717','IMG_5497','IMG_6831','IMG_9857','PhuotLuon_0007','RAA07670'
].map(name => `assets/bts/${name}.webp`);

const menuButton = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('.mobile-menu');

function closeMenu() {
  mobileMenu.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Mở menu');
}

menuButton.addEventListener('click', event => {
  event.stopPropagation();
  const willOpen = mobileMenu.hidden;
  mobileMenu.hidden = !willOpen;
  menuButton.setAttribute('aria-expanded', String(willOpen));
  menuButton.setAttribute('aria-label', willOpen ? 'Đóng menu' : 'Mở menu');
});

mobileMenu.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('click', event => {
  if (!mobileMenu.hidden && !mobileMenu.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
});
window.addEventListener('resize', () => { if (window.innerWidth > 834) closeMenu(); });

const tabsElement = document.querySelector('.portfolio-tabs');
const gridElement = document.querySelector('.portfolio-grid');
let portfolioData = null;
let activeCategory = 0;

function categoryLabel(category) {
  return category.slug === 'tvc' ? 'TVC & Commercial' : category.name;
}

function truncateText(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

async function hydrateYoutubeMetadata(category) {
  const cards = [...gridElement.querySelectorAll('.video-card')];
  const ids = category.videos.map(video => video.youtube_id).join(',');
  let metadata = [];
  try {
    const response = await fetch(`/api/youtube-metadata?ids=${encodeURIComponent(ids)}`);
    if (!response.ok) throw new Error('Metadata API unavailable');
    metadata = (await response.json()).videos || [];
  } catch {
    metadata = (await Promise.allSettled(category.videos.map(async video => {
      const watchUrl = `https://www.youtube.com/watch?v=${video.youtube_id}`;
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`);
      if (!response.ok) throw new Error('oEmbed unavailable');
      const result = await response.json();
      return { id: video.youtube_id, title: result.title };
    }))).filter(result => result.status === 'fulfilled').map(result => result.value);
  }

  const byId = new Map(metadata.map(item => [item.id, item]));
  cards.forEach((card, index) => {
    const video = category.videos[index];
    const live = byId.get(video.youtube_id) || {};
    const title = live.title || video.title;
    const client = live.client || video.client;
    if (title) {
      card.dataset.title = title;
      card.querySelector('.card-title').textContent = truncateText(title, 48);
      card.querySelector('img').alt = `Thumbnail ${title}`;
    }
    if (client) card.querySelector('.card-subtitle').textContent = truncateText(`Khách hàng: ${client}`, 44);
  });
}

function renderPortfolio() {
  const category = portfolioData.categories[activeCategory];
  tabsElement.innerHTML = portfolioData.categories.map((item, index) => `
    <button class="portfolio-tab" type="button" role="tab" aria-selected="${index === activeCategory}" data-index="${index}">${categoryLabel(item)}</button>
  `).join('');
  gridElement.classList.toggle('single', category.videos.length === 1);
  gridElement.innerHTML = category.videos.map((video, index) => {
    const fallback = fallbackImages[index % fallbackImages.length];
    const thumb = `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`;
    const title = video.title || category.name;
    const subtitle = video.client ? `Khách hàng: ${video.client}` : 'Đang cập nhật thông tin khách hàng';
    return `<button class="video-card" type="button" data-video="${video.youtube_id}" data-category="${escapeHtml(categoryLabel(category))}" data-title="${escapeHtml(title)}">
      <img src="${thumb}" data-fallback="${fallback}" alt="Thumbnail ${escapeHtml(title)}" loading="lazy">
      <span class="play" aria-hidden="true">▶</span>
      <span class="card-copy"><strong class="card-title" title="${escapeHtml(title)}">${escapeHtml(truncateText(title, 48))}</strong><span class="card-subtitle">${escapeHtml(truncateText(subtitle, 44))}</span></span>
    </button>`;
  }).join('');
  gridElement.querySelectorAll('img').forEach(img => img.addEventListener('error', () => {
    if (img.src !== new URL(img.dataset.fallback, location.href).href) img.src = img.dataset.fallback;
  }, { once: true }));
  hydrateYoutubeMetadata(category);
}

tabsElement.addEventListener('click', event => {
  const tab = event.target.closest('.portfolio-tab');
  if (!tab) return;
  activeCategory = Number(tab.dataset.index);
  renderPortfolio();
});

fetch('assets/data/video-portfolio.json')
  .then(response => { if (!response.ok) throw new Error('Không thể tải dữ liệu portfolio'); return response.json(); })
  .then(data => { portfolioData = data; renderPortfolio(); })
  .catch(() => {
    portfolioData = { categories: [{ name: 'Phim Doanh Nghiệp', slug: 'phim-doanh-nghiep', videos: [{ youtube_id: 'uoMRjj4aIe4' }, { youtube_id: 'ITdxhlvfwUw' }, { youtube_id: 'SBzRm8ycm6U' }] }] };
    renderPortfolio();
  });

const modal = document.querySelector('.video-modal');
const iframe = modal.querySelector('iframe');
const modalCategory = modal.querySelector('.modal-category');
const modalTitle = modal.querySelector('#modal-title');
let lastTrigger = null;

function closeVideo() {
  modal.hidden = true;
  iframe.src = '';
  document.body.classList.remove('modal-open');
  if (lastTrigger) lastTrigger.focus();
}

gridElement.addEventListener('click', event => {
  const card = event.target.closest('.video-card');
  if (!card) return;
  lastTrigger = card;
  iframe.src = `https://www.youtube-nocookie.com/embed/${card.dataset.video}?autoplay=1&rel=0`;
  modalCategory.textContent = card.dataset.category;
  modalTitle.textContent = card.dataset.title;
  modal.hidden = false;
  document.body.classList.add('modal-open');
  modal.querySelector('.modal-close').focus();
});
modal.querySelector('.modal-close').addEventListener('click', closeVideo);
modal.querySelector('.modal-backdrop').addEventListener('click', closeVideo);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { if (!modal.hidden) closeVideo(); else closeMenu(); }
});

const galleryMain = document.querySelector('#gallery-main');
const galleryThumbs = document.querySelector('.gallery-thumbs');
const galleryCounter = document.querySelector('.gallery-counter');
let galleryIndex = 0;

galleryThumbs.innerHTML = btsImages.map((src, index) => `<button class="gallery-thumb${index === 0 ? ' active' : ''}" type="button" data-index="${index}" aria-label="Xem ảnh ${index + 1}"><img src="${src}" alt="" loading="lazy"></button>`).join('');

function showGalleryImage(nextIndex) {
  galleryIndex = (nextIndex + btsImages.length) % btsImages.length;
  galleryMain.src = btsImages[galleryIndex];
  galleryCounter.textContent = `${String(galleryIndex + 1).padStart(2, '0')}/${btsImages.length}`;
  galleryThumbs.querySelectorAll('.gallery-thumb').forEach((thumb, index) => thumb.classList.toggle('active', index === galleryIndex));
  galleryThumbs.querySelector(`[data-index="${galleryIndex}"]`).scrollIntoView({ inline: 'nearest', block: 'nearest' });
}

galleryThumbs.addEventListener('click', event => {
  const thumb = event.target.closest('.gallery-thumb');
  if (thumb) showGalleryImage(Number(thumb.dataset.index));
});
document.querySelector('.gallery-arrow.prev').addEventListener('click', () => showGalleryImage(galleryIndex - 1));
document.querySelector('.gallery-arrow.next').addEventListener('click', () => showGalleryImage(galleryIndex + 1));
