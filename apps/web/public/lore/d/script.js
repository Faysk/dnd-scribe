const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

const artwork = {
  '/lore/d/assets/d-completo.webp': [
    '/lore/d/assets/base64/d-completo.0.b64',
    '/lore/d/assets/base64/d-completo.1.b64',
    '/lore/d/assets/base64/d-completo.2.b64',
  ],
  '/lore/d/assets/d-sem-sobretudo.webp': [
    '/lore/d/assets/base64/d-sem-sobretudo.0.b64',
    '/lore/d/assets/base64/d-sem-sobretudo.1.b64',
    '/lore/d/assets/base64/d-sem-sobretudo.2.b64',
  ],
  '/lore/d/assets/d-sem-chapeu.webp': [
    '/lore/d/assets/base64/d-sem-chapeu.0.b64',
    '/lore/d/assets/base64/d-sem-chapeu.1.b64',
    '/lore/d/assets/base64/d-sem-chapeu.2.b64',
  ],
};

const resolvedArtwork = new Map();
function applyArtwork(root = document) {
  resolvedArtwork.forEach((dataUrl, original) => {
    root.querySelectorAll('img').forEach((image) => {
      if (image.getAttribute('src') === original) image.src = dataUrl;
    });
    root.querySelectorAll('.image-button').forEach((button) => {
      if (button.dataset.image === original) button.dataset.image = dataUrl;
    });
  });
}

async function loadArtwork() {
  const resolved = await Promise.all(Object.entries(artwork).map(async ([original, parts]) => {
    const responses = await Promise.all(parts.map((part) => fetch(part)));
    const failed = responses.find((response) => !response.ok);
    if (failed) throw new Error(`Falha ao carregar arte de D: ${failed.status}`);
    const chunks = await Promise.all(responses.map((response) => response.text()));
    return [original, `data:image/avif;base64,${chunks.join('')}`];
  }));
  resolved.forEach(([original, dataUrl]) => resolvedArtwork.set(original, dataUrl));
  applyArtwork();
}

const lightbox = document.querySelector('#lightbox');
const lightboxImg = lightbox.querySelector('img');
const closeBtn = lightbox.querySelector('.close');
document.addEventListener('click', (event) => {
  const button = event.target.closest('.image-button');
  if (!button) return;
  lightboxImg.src = button.dataset.image;
  lightbox.showModal();
});
closeBtn.addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', (event) => {
  const rect = lightbox.getBoundingClientRect();
  const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  if (!inside) lightbox.close();
});
loadArtwork().catch((error) => console.error(error));

/* =========================================================
   Lore View Modes — Cinemático ⇄ Leitura
   ========================================================= */
const body = document.body;
const modeToggle = document.querySelector('#lore-mode-toggle');
const cinematicView = document.querySelector('#cinematic-view');
const modeStatus = document.querySelector('#lore-mode-status');
const modeHint = document.querySelector('#mode-hint');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let readingView = null;
let readingPromise = null;
let currentMode = 'cinematic';
let chapterObserver = null;
let hintTimer = null;

const chapterIds = {
  'Prólogo — Sempre há um antes':'read-prologue','I — Antes de D':'read-before','II — Um futuro no bolso':'read-future','III — O último toque':'read-last-touch','IV — Os sinais':'read-signals','V — O pedido que nunca aconteceu':'read-proposal','VI — O erro dos homens':'read-men-error','VII — O disparo':'read-shot','VIII — “E se...?”':'read-what-if','IX — Ele não esqueceu':'read-memory','X — D.':'read-d','XI — Investigator':'read-investigator','XII — O homem que observa':'read-observer','XIII — Roupa fina. Vida bruta.':'read-wardrobe','XIV — O lenço':'read-scarf','XV — O sobretudo':'read-overcoat','XVI — O cachimbo':'read-pipe','XVII — O que restou do homem anterior':'read-remains','XVIII — Antes do “tarde demais”':'read-before-too-late','Epílogo — A resposta antes da pergunta':'read-epilogue'
};
const storyMap = [
  { cinematic: '.hero', reading: 'reading-top' },
  { cinematic: '#origem', reading: 'read-before' },
  { cinematic: '.proposal', reading: 'read-future' },
  { cinematic: '.night-copy', reading: 'read-signals' },
  { cinematic: '.crime-grid', reading: 'read-proposal' },
  { cinematic: '.death-scene', reading: 'read-shot' },
  { cinematic: '#e-se', reading: 'read-what-if' },
  { cinematic: '.aftermath', reading: 'read-memory' },
  { cinematic: '#proposito', reading: 'read-investigator' },
  { cinematic: '#perfil', reading: 'read-observer' },
  { cinematic: '#visual', reading: 'read-wardrobe' },
  { cinematic: '.relics', reading: 'read-scarf' },
  { cinematic: '.closing', reading: 'read-epilogue' },
];

function escapeHtml(value) { return value.replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char])); }
function inlineMarkdown(value) {
  let text = escapeHtml(value);
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  return text;
}
function splitChapterTitle(title) {
  const parts = title.split(' — ');
  return parts.length > 1 ? [parts.shift(), parts.join(' — ')] : ['', title];
}
function parseLongform(markdown) {
  const clean = markdown.replace(/<!--[^]*?-->/g, '').split('## Frases centrais para a apresentação editorial')[0];
  const lines = clean.split(/\r?\n/);
  const chapters = [];
  let current = null;
  let block = [];
  let quote = [];
  const flushParagraph = () => {
    if (!current || !block.length) return;
    current.blocks.push({ type:'p', text:block.join(' ') }); block=[];
  };
  const flushQuote = () => {
    if (!current || !quote.length) return;
    current.blocks.push({ type:'quote', lines:[...quote] }); quote=[];
  };
  for (const raw of lines) {
    const line = raw.trim();
    const heading = line.match(/^(#{1,2})\s+(.+)$/);
    const isChapter = heading && (heading[2].startsWith('Prólogo') || /^(?:[IVXLCDM]+)\s+—/.test(heading[2]) || heading[2].startsWith('Epílogo'));
    if (isChapter) {
      flushParagraph(); flushQuote();
      current = { title:heading[2], id:chapterIds[heading[2]], blocks:[] };
      if (current.id) chapters.push(current); else current=null;
      continue;
    }
    if (!current) continue;
    if (!line) { flushParagraph(); flushQuote(); continue; }
    if (line === '---') { flushParagraph(); flushQuote(); continue; }
    if (line.startsWith('>')) { flushParagraph(); quote.push(line.replace(/^>\s?/,'')); continue; }
    flushQuote(); block.push(line);
  }
  flushParagraph(); flushQuote();
  return chapters;
}
function renderBlocks(blocks) {
  return blocks.map((block) => {
    if (block.type === 'quote') return `<blockquote>${block.lines.map((line) => `<p>${inlineMarkdown(line)}</p>`).join('')}</blockquote>`;
    return `<p>${inlineMarkdown(block.text)}</p>`;
  }).join('');
}
function readingFigure(id) {
  if (id === 'read-d') return '<figure class="reading-figure reading-figure-wide"><button class="image-button" data-image="/lore/d/assets/d-sem-sobretudo.webp" aria-label="Ampliar retrato de D"><img src="/lore/d/assets/d-sem-sobretudo.webp" alt="D em sua aparência atual, sem o sobretudo"></button><figcaption>D, depois. O homem que transformou atenção em método.</figcaption></figure>';
  if (id === 'read-wardrobe') return '<figure class="reading-figure"><button class="image-button" data-image="/lore/d/assets/d-sem-chapeu.webp" aria-label="Ampliar retrato de D sem chapéu"><img src="/lore/d/assets/d-sem-chapeu.webp" alt="D sem chapéu e sem sobretudo"></button><figcaption>Roupa fina. Vida bruta. A elegância permaneceu; o tempo fez o resto.</figcaption></figure>';
  return '';
}
function buildReadingView(markdown) {
  const chapters = parseLongform(markdown);
  if (!chapters.length) throw new Error('A história completa de D não contém capítulos reconhecíveis.');
  const nav = chapters.map(({title,id}) => { const [kicker,heading]=splitChapterTitle(title); return `<a href="#${id}" data-reading-link="${id}"><span>${escapeHtml(kicker || '•')}</span>${escapeHtml(heading)}</a>`; }).join('');
  const sections = chapters.map(({title,id,blocks}) => { const [kicker,heading]=splitChapterTitle(title); return `<section class="reading-chapter" id="${id}" data-reading-chapter><header class="reading-chapter-header"><p>${escapeHtml(kicker)}</p><h2>${escapeHtml(heading)}</h2></header><div class="reading-prose">${renderBlocks(blocks)}</div>${readingFigure(id)}</section>`; }).join('');
  const main = document.createElement('main');
  main.className='reading-view lore-view'; main.id='reading-view'; main.dataset.loreView='reading'; main.hidden=true;
  main.innerHTML=`<div class="reading-progress" aria-hidden="true"><span id="reading-progress-bar"></span></div><header class="reading-hero" id="reading-top"><div class="reading-hero-copy"><p class="eyebrow">HISTÓRIA COMPLETA · ≈ 26 MIN DE LEITURA</p><h1 class="reading-title shared-lore-title">D<span>.</span></h1><p class="reading-subtitle">Antes que seja <em>tarde demais.</em></p><p class="reading-deck">A história completa do homem que aprendeu a procurar o instante anterior ao irreversível.</p><a class="reading-start" href="#read-prologue">Começar a leitura <span aria-hidden="true">↓</span></a></div><div class="reading-hero-art"><div class="reading-halo" aria-hidden="true"></div><img class="shared-lore-art" src="/lore/d/assets/d-completo.webp" alt="D usando sobretudo e chapéu, segurando um cachimbo"></div></header><div class="reading-layout"><aside class="reading-toc" aria-label="Capítulos da história completa"><p>Capítulos</p><nav>${nav}</nav></aside><article class="reading-document" aria-label="História completa de D"><details class="reading-mobile-toc"><summary>Capítulos <span aria-hidden="true">＋</span></summary><nav>${nav}</nav></details>${sections}</article></div>`;
  document.querySelector('footer').before(main); applyArtwork(main); setupReadingNavigation(main); return main;
}
async function ensureReadingView() {
  if (readingView) return readingView;
  if (!readingPromise) {
    const storyParts = ['/lore/d/historia-1.md','/lore/d/historia-2.md','/lore/d/historia-3.md','/lore/d/historia-4.md'];
    readingPromise = Promise.all(storyParts.map((url) => fetch(url).then((response) => { if (!response.ok) throw new Error(`Falha ao carregar história completa: ${response.status}`); return response.text(); }))).then((parts) => parts.join('\n')).then((markdown) => { readingView=buildReadingView(markdown); return readingView; });
  }
  return readingPromise;
}

function nearestCinematicEntry() {
  const headerOffset=100; let best=storyMap[0], bestDistance=Infinity;
  storyMap.forEach((entry) => { const element=document.querySelector(entry.cinematic); if(!element)return; const rect=element.getBoundingClientRect(); const distance=rect.bottom<headerOffset?Math.abs(rect.bottom-headerOffset)+180:Math.abs(rect.top-headerOffset); if(distance<bestDistance){bestDistance=distance;best=entry;} });
  return best;
}
function nearestReadingEntry() {
  const hero=readingView?.querySelector('.reading-hero'); if(hero && window.scrollY < hero.offsetTop + hero.offsetHeight*.72) return storyMap[0];
  const chapters=[...document.querySelectorAll('[data-reading-chapter]')]; const headerOffset=110; let active=chapters[0], bestDistance=Infinity;
  chapters.forEach((chapter)=>{const rect=chapter.getBoundingClientRect();const distance=rect.bottom<headerOffset?Math.abs(rect.bottom-headerOffset)+180:Math.abs(rect.top-headerOffset);if(distance<bestDistance){bestDistance=distance;active=chapter;}});
  const activeIndex=chapters.indexOf(active); let best=null;
  storyMap.forEach((item)=>{const target=document.getElementById(item.reading);const targetIndex=chapters.indexOf(target);if(targetIndex<0||activeIndex<0)return;const distance=Math.abs(targetIndex-activeIndex);if(!best||distance<best.distance)best={item,distance};});
  return best?best.item:storyMap[0];
}
function setToggleState(mode) {
  const reading=mode==='reading'; body.dataset.loreMode=mode; modeToggle.setAttribute('aria-checked',String(reading)); modeToggle.setAttribute('aria-label',reading?'Ativar modo Cinemático':'Ativar modo Leitura'); modeToggle.title=reading?'Modo Leitura — trocar para Cinemático':'Modo Cinemático — trocar para Leitura'; modeStatus.textContent=reading?'Modo Leitura ativo.':'Modo Cinemático ativo.';
}
function jumpTo(element){ if(!element)return; element.scrollIntoView({block:'start',behavior:'instant'}); }
function swapView(nextMode,entry){ if(nextMode==='reading'){cinematicView.hidden=true;readingView.hidden=false;setToggleState('reading');jumpTo(document.getElementById(entry.reading)||readingView.querySelector('#reading-top'));updateReadingProgress();}else{readingView.hidden=true;cinematicView.hidden=false;setToggleState('cinematic');jumpTo(document.querySelector(entry.cinematic)||cinematicView);}currentMode=nextMode; }
async function changeMode(nextMode) {
  if(nextMode===currentMode||body.classList.contains('is-switching'))return; hideModeHint(); body.classList.add('is-switching'); modeToggle.setAttribute('aria-busy','true');
  try { if(nextMode==='reading') await ensureReadingView(); const entry=currentMode==='cinematic'?nearestCinematicEntry():nearestReadingEntry(); if(!reduceMotion.matches&&document.startViewTransition){const transition=document.startViewTransition(()=>swapView(nextMode,entry));await transition.finished;}else swapView(nextMode,entry); }
  catch(error){console.error(error);modeStatus.textContent='Não foi possível abrir o modo Leitura.';}
  finally{body.classList.remove('is-switching');modeToggle.removeAttribute('aria-busy');modeToggle.focus({preventScroll:true});}
}
modeToggle.addEventListener('click',()=>changeMode(currentMode==='cinematic'?'reading':'cinematic')); setToggleState('cinematic');
document.querySelector('.brand').addEventListener('click',(event)=>{event.preventDefault();window.scrollTo({top:0,behavior:reduceMotion.matches?'auto':'smooth'});});

function setupReadingNavigation(view) {
  const chapters=[...view.querySelectorAll('[data-reading-chapter]')],tocLinks=[...view.querySelectorAll('[data-reading-link]')]; chapterObserver?.disconnect(); chapterObserver=new IntersectionObserver((entries)=>{const visible=entries.filter((entry)=>entry.isIntersecting).sort((a,b)=>Math.abs(a.boundingClientRect.top-130)-Math.abs(b.boundingClientRect.top-130));if(!visible.length)return;const id=visible[0].target.id;tocLinks.forEach((link)=>link.classList.toggle('active',link.dataset.readingLink===id));},{rootMargin:'-18% 0px -68% 0px',threshold:0});chapters.forEach((chapter)=>chapterObserver.observe(chapter));view.addEventListener('click',(event)=>{const link=event.target.closest('[data-reading-link]');if(!link)return;const mobileToc=link.closest('details');if(mobileToc)mobileToc.open=false;});
}
function updateReadingProgress(){if(currentMode!=='reading'||!readingView)return;const bar=readingView.querySelector('#reading-progress-bar');if(!bar)return;const start=readingView.offsetTop,end=start+readingView.scrollHeight-window.innerHeight,progress=end<=start?1:Math.min(1,Math.max(0,(window.scrollY-start)/(end-start)));bar.style.width=`${progress*100}%`;}
window.addEventListener('scroll',updateReadingProgress,{passive:true}); window.addEventListener('resize',updateReadingProgress,{passive:true});

function hideModeHint(){if(!modeHint||modeHint.hidden)return;modeHint.hidden=true;if(hintTimer)clearTimeout(hintTimer);try{sessionStorage.setItem('lore-d-mode-hint-seen','1');}catch(_){}}
try{if(modeHint&&!sessionStorage.getItem('lore-d-mode-hint-seen')){window.setTimeout(()=>{if(currentMode!=='cinematic')return;modeHint.hidden=false;hintTimer=window.setTimeout(hideModeHint,6500);},2600);}}catch(_){}
modeHint?.addEventListener('click',hideModeHint);

// Preload the long-form source during idle time so the first switch feels immediate.
const preloadReading=()=>ensureReadingView().catch((error)=>console.error(error));
if('requestIdleCallback' in window) requestIdleCallback(preloadReading,{timeout:1800}); else window.setTimeout(preloadReading,900);
