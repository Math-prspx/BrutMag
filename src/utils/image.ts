// Utilitaires pour le traitement des images

import type { Story } from '../types';

/**
 * Décode les entités HTML
 */
export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

/**
 * Résout une URL d'image (relative ou absolue)
 */
export function resolveImageCandidate(candidate: string, baseUrl?: string): string {
  const cleaned = decodeHtmlEntities(String(candidate || '').trim());
  if (!cleaned) {
    return '';
  }

  // Forcer HTTPS pour éviter les Mixed Content warnings
  if (/^http:\/\//i.test(cleaned)) {
    return cleaned.replace('http://', 'https://');
  }

  if (/^https:\/\//i.test(cleaned)) {
    return cleaned;
  }

  if (cleaned.startsWith('//')) {
    return `https:${cleaned}`;
  }

  if (baseUrl) {
    try {
      return new URL(cleaned, baseUrl).toString();
    } catch {
      return '';
    }
  }

  return '';
}

/**
 * Extrait toutes les URLs d'images depuis du HTML
 */
export function extractImageUrlsFromHtml(html: string, baseUrl?: string): string[] {
  if (!html) {
    return [];
  }

  const matches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
  return matches
    .map((match) => resolveImageCandidate(match[1], baseUrl))
    .filter(Boolean);
}

/**
 * Retourne uniquement les URLs uniques
 */
export function uniqueImageUrls(urls: string[]): string[] {
  return urls.filter((url, index, array) => !!url && array.indexOf(url) === index);
}

/**
 * Retourne l'URL d'image principale d'une story
 */
export function getPrimaryImageUrl(story: Story): string {
  const candidates = uniqueImageUrls([
    story.imageUrl || '',
    ...(story.imageUrls || []),
  ]);
  return candidates[0] || '';
}

/**
 * Retourne toutes les URLs d'images candidates pour une story
 */
export function getStoryImageCandidates(story: Story): string[] {
  return uniqueImageUrls([story.imageUrl || '', ...(story.imageUrls || [])]);
}

/**
 * Retourne les URLs d'images pour le hero d'une story
 */
export function getStoryHeroCandidates(story: Story): string[] {
  return uniqueImageUrls([story.imageUrl || '', ...(story.imageUrls || [])]);
}

/**
 * Génère une clé unique pour une image d'une story
 */
export function getStoryImageKey(storyId: string, imageUrl: string): string {
  return `${storyId}:${imageUrl}`;
}

/**
 * Retourne l'URL d'image à afficher en tenant compte des images en échec
 */
export function getDisplayImageUrl(story: Story, failedImages: Record<string, boolean>): string {
  const candidates = getStoryImageCandidates(story);
  return (
    candidates.find((url) => !failedImages[getStoryImageKey(story.id, url)]) ||
    candidates[0] ||
    ''
  );
}

/**
 * Retourne l'URL d'image pour une carte à un index de tentative donné
 */
export function getCardImageUrl(story: Story, attemptIndex: number): string {
  const candidates = getStoryImageCandidates(story);
  const index = Math.min(attemptIndex, Math.max(candidates.length - 1, 0));
  return candidates[index] || '';
}

/**
 * Retourne l'URL d'image hero pour le détail en tenant compte des échecs
 */
export function getDetailHeroImageUrl(story: Story, failedImages: Record<string, boolean>): string {
  const candidates = getStoryHeroCandidates(story);
  return (
    candidates.find((url) => !failedImages[getStoryImageKey(story.id, url)]) ||
    candidates[0] ||
    ''
  );
}

/**
 * Retourne les URLs d'images secondaires (sans la principale)
 */
export function getSecondaryImageUrls(story: Story): string[] {
  const primary = getPrimaryImageUrl(story);
  return uniqueImageUrls(story.imageUrls || []).filter((url) => url !== primary);
}

/**
 * Vérifie si une image est valide (pas de placeholder)
 */
export function isValidThumbnail(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return !lower.includes('no_thumb') && 
         !lower.includes('placeholder') && 
         !lower.includes('default_thumb');
}
