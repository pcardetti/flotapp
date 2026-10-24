import type { MetadataRoute } from 'next';
import { sitioPublico } from '@/lib/url';

// Páginas públicas para los buscadores. Por ahora, la de inicio; las páginas de producto se suman acá.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${sitioPublico()}/`, changeFrequency: 'monthly', priority: 1 }];
}
