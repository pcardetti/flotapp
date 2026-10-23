import type { MetadataRoute } from 'next';
import { urlBase } from '@/lib/url';

// Páginas públicas para los buscadores. Por ahora, la de inicio; las páginas de producto se suman acá.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [{ url: `${await urlBase()}/`, changeFrequency: 'monthly', priority: 1 }];
}
