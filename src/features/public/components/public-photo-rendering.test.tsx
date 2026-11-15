import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { AboutPage } from './about-page';
import { ContactHero } from './contact-sections';
import { PublicHero } from './public-page-primitives';
import { StudioPage, getGalleryImageSizes } from './studio/studio-page';

const photo = { id: 'synthetic', title: null, altText: 'Testovací fotografie', imageUrl: '/photo.jpg', width: 1200, height: 900 };

test('portréty, kontakt a studio zachovají středový ořez a respektují vlastní ohnisko', () => {
  for (const point of [{}, { focalPointX: 20, focalPointY: 80 }]) {
    const image = { ...photo, ...point };
    const position = `${point.focalPointX ?? 50}% ${point.focalPointY ?? 50}%`;
    const pages = [
      <AboutPage key="about" certificates={[]} portrait={image} />,
      <ContactHero key="contact" title="Kontakt" description="Popis" phone="+420000000000" email="test@example.test" instagramUrl={null} photo={{ src: image.imageUrl, alt: image.altText, width: 1200, height: 900, ...point }} />,
      <StudioPage key="studio" photos={[image, { ...image, id: 'gallery' }]} />,
      <PublicHero key="hero" eyebrow="Test" title="Test" description="Popis" portraitImage={{ src: image.imageUrl, alt: image.altText, width: 1200, height: 900 }} portraitObjectPosition={position} />,
    ];
    for (const page of pages) {
      const html = renderToStaticMarkup(page);
      const images = html.match(/<img\b[^>]*src="[^"]*photo[^>]*>/g) ?? [];
      assert.ok(images.length > 0);
      for (const img of images) {
        assert.ok(img.includes(`object-position:${position}`));
        assert.match(img, /object-cover/);
        assert.match(img, /sizes="/);
      }
    }
  }
});

test('rozlišení galerie odpovídá všem existujícím rozložením karet', () => {
  for (let total = 1; total <= 6; total++) {
    for (let index = 0; index < total; index++) {
      const sizes = getGalleryImageSizes(index, total);
      const width = total === 1 ? 1216 : total === 2 || total === 4 || total === 3 && index === 0 ? 598 : total === 3 ? 289 : total === 5 && index === 0 ? 804 : 392;
      assert.ok(sizes.startsWith(`(min-width: 1280px) ${width}px,`));
      assert.ok(sizes.endsWith('calc(100vw - 40px)'));
    }
  }
});
