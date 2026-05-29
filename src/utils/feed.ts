// Utilitaires pour la gestion des feeds RSS

import { XMLParser } from 'fast-xml-parser';
import { RSS2JSON_ENDPOINT, NODE_API_BASE_URL, MAX_ITEMS_PER_FEED, TONES } from '../config/constants';
import type { Feed, Story, Rss2JsonFeedResponse, Rss2JsonItem } from '../types';
import { extractImageUrlsFromHtml, resolveImageCandidate, isValidThumbnail } from './image';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
});

/**
 * Helpers pour parser le XML
 */
function textFromNode(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (value && typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    return textFromNode((value as Record<string, unknown>)['#text']);
  }

  return '';
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Récupère le JSON d'un feed RSS via le proxy Node.js (avec cache) ou rss2json en fallback
 */
export async function fetchFeedJson(feedUrl: string): Promise<Rss2JsonFeedResponse> {
  // Utiliser le proxy du serveur pour bénéficier du cache
  try {
    const proxyUrl = `${NODE_API_BASE_URL}/feed-proxy?url=${encodeURIComponent(feedUrl)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error('Feed unreachable via proxy');
    }
    const data = (await response.json()) as Rss2JsonFeedResponse;
    if (data.status !== 'ok' || !Array.isArray(data.items)) {
      throw new Error('Feed unreachable');
    }
    return data;
  } catch {
    // Fallback: appeler directement rss2json si le proxy échoue
    const response = await fetch(`${RSS2JSON_ENDPOINT}${encodeURIComponent(feedUrl)}`);
    if (!response.ok) {
      throw new Error('Feed unreachable');
    }

    const data = (await response.json()) as Rss2JsonFeedResponse;
    if (data.status !== 'ok' || !Array.isArray(data.items)) {
      throw new Error('Feed unreachable');
    }

    return data;
  }
}

/**
 * Charge les articles d'un feed
 */
export async function loadFeedStories(feed: Feed): Promise<Story[]> {
  const data = await fetchFeedJson(feed.url);

  return (data.items ?? []).slice(0, MAX_ITEMS_PER_FEED).map((item, index) => {
    const storyUrl = item.link || item.guid;
    const htmlImages = extractImageUrlsFromHtml(`${item.content || ''} ${item.description || ''}`, storyUrl);
    
    const preferredCandidates = [
      resolveImageCandidate(item.enclosure?.link || '', storyUrl),
      resolveImageCandidate(item.thumbnail || '', storyUrl),
      ...htmlImages,
    ].filter(isValidThumbnail);

    const allCandidates = preferredCandidates.length > 0 ? preferredCandidates : htmlImages;

    return {
      id: `${feed.id}:${item.guid || item.link || index}`,
      title: (item.title || 'Sans titre').toUpperCase(),
      source: feed.name.toUpperCase(),
      tone: TONES[Math.floor(Math.random() * TONES.length)],
      feedId: feed.id,
      imageUrl: allCandidates[0] || '',
      imageUrls: allCandidates,
      url: storyUrl,
      publishedAt: item.pubDate,
      summary: stripHtml(item.description || item.content || '').substring(0, 300),
    };
  });
}

/**
 * Construit une liste de candidats d'URLs de feed à tester
 */
export function buildFeedCandidates(inputUrl: string): string[] {
  try {
    const parsed = new URL(inputUrl);
    const basePath = parsed.pathname.replace(/\/$/, '');
    const pathCandidates = basePath
      ? [
          `${basePath}/rss`,
          `${basePath}/feed`,
          `${basePath}/feed.xml`,
          `${basePath}/rss.xml`,
          `${basePath}/atom.xml`,
        ]
      : [];

    return [
      inputUrl,
      ...pathCandidates.map((path) => `${parsed.origin}${path}`),
      `${parsed.origin}/rss`,
      `${parsed.origin}/feed`,
      `${parsed.origin}/feed.xml`,
      `${parsed.origin}/rss.xml`,
      `${parsed.origin}/atom.xml`,
    ];
  } catch {
    return [inputUrl];
  }
}

/**
 * Résout l'URL d'un feed en testant plusieurs candidats
 */
export async function resolveFeedUrl(inputUrl: string): Promise<string> {
  for (const candidate of buildFeedCandidates(inputUrl)) {
    try {
      await fetchFeedJson(candidate);
      return candidate;
    } catch {
      // Try the next guess.
    }
  }

  throw new Error('Aucun flux detecte sur ce site');
}

/**
 * Normalise un feed
 */
export function normalizeFeed(feed: Feed, fallbackId: string): Feed {
  return {
    id: feed.id || fallbackId,
    name: feed.name.trim(),
    sourceUrl: feed.sourceUrl?.trim() || feed.url.trim(),
    url: feed.url.trim() || feed.sourceUrl.trim(),
    createdAt: Number.isFinite(feed.createdAt) ? feed.createdAt : Date.now(),
  };
}

/**
 * Déduplique une liste de feeds
 */
export function dedupeFeeds(feeds: Feed[]): Feed[] {
  const seen = new Set<string>();
  const unique: Feed[] = [];

  feeds.forEach((feed, index) => {
    const normalized = normalizeFeed(feed, `${Date.now()}-${index}`);
    const key = `${normalized.url.toLowerCase()}|${normalized.sourceUrl.toLowerCase()}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    unique.push(normalized);
  });

  return unique;
}

/**
 * Fusionne deux listes de feeds en dédupliquant
 */
export function mergeFeeds(primary: Feed[], secondary: Feed[]): Feed[] {
  return dedupeFeeds([...primary, ...secondary]);
}

/**
 * Exécute des promesses avec une limite de concurrence
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let currentIndex = 0;

  async function next(): Promise<void> {
    const index = currentIndex++;
    if (index >= items.length) {
      return;
    }

    const item = items[index];
    const result = await fn(item, index);
    results[index] = result;

    await next();
  }

  await Promise.all(Array.from({ length: concurrency }, () => next()));

  return results;
}

/**
 * Wrapper avec timeout
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]);
}
