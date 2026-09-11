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

async function loadArtwork() {
  const resolved = await Promise.all(
    Object.entries(artwork).map(async ([original, parts]) => {
      const responses = await Promise.all(parts.map((part) => fetch(part)));
      const failed = responses.find((response) => !response.ok);
      if (failed) throw new Error(`Falha ao carregar arte de D: ${failed.status}`);
      const chunks = await Promise.all(responses.map((response) => response.text()));
      return [original, `data:image/avif;base64,${chunks.join('')}`];
    }),
  );

  resolved.forEach(([original, dataUrl]) => {
    document.querySelectorAll('img').forEach((image) => {
      if (image.getAttribute('src') === original) image.src = dataUrl;
    });
    document.querySelectorAll('.image-button').forEach((button) => {
      if (button.dataset.image === original) button.dataset.image = dataUrl;
    });
  });
}

const lightbox = document.querySelector('#lightbox');
const lightboxImg = lightbox.querySelector('img');
const closeBtn = lightbox.querySelector('.close');

document.querySelectorAll('.image-button').forEach((button) => {
  button.addEventListener('click', () => {
    lightboxImg.src = button.dataset.image;
    lightbox.showModal();
  });
});

closeBtn.addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', (event) => {
  const rect = lightbox.getBoundingClientRect();
  const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  if (!inside) lightbox.close();
});

loadArtwork().catch((error) => {
  console.error(error);
});
