// Utilitaires pour les appels API

import { SYNC_API_BASE_URL } from '../config/constants';
import type { Feed, AccountSession } from '../types';

/**
 * Effectue une requête vers l'API PHP MySQL
 */
export async function apiRequest(path: string, options: RequestInit = {}): Promise<Record<string, unknown>> {
  const response = await fetch(`${SYNC_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(String(payload.error || 'SYNC_FAILED'));
  }

  return payload;
}

/**
 * Authentification - Login
 */
export async function loginUser(email: string, password: string): Promise<AccountSession> {
  return (await apiRequest('/auth/login.php', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })) as AccountSession;
}

/**
 * Authentification - Register
 */
export async function registerUser(email: string, password: string): Promise<AccountSession> {
  return (await apiRequest('/auth/register.php', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })) as AccountSession;
}

/**
 * Récupère les feeds depuis l'API
 */
export async function loadFeedsFromAccount(token: string): Promise<Feed[]> {
  const payload = (await apiRequest('/feeds.php', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })) as { feeds?: Feed[] };

  return Array.isArray(payload.feeds) ? payload.feeds : [];
}

/**
 * Envoie les feeds vers l'API
 */
export async function pushFeedsToAccount(feeds: Feed[], token: string): Promise<Feed[]> {
  if (!token) {
    return feeds;
  }

  const payload = (await apiRequest('/feeds.php', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ feeds }),
  })) as { feeds?: Feed[] };

  return Array.isArray(payload.feeds) ? payload.feeds : feeds;
}

/**
 * Ajoute un article aux favoris
 */
export async function addFavorite(
  token: string,
  article: {
    url: string;
    title: string;
    source: string;
    image?: string;
    publishedAt?: string;
  }
): Promise<void> {
  await apiRequest('/favorites.php', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      article_url: article.url,
      article_title: article.title,
      article_source: article.source,
      article_image: article.image,
      article_published_at: article.publishedAt,
    }),
  });
}

/**
 * Supprime un article des favoris
 */
export async function removeFavorite(token: string, articleUrl: string): Promise<void> {
  await apiRequest('/favorites.php', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ article_url: articleUrl }),
  });
}

/**
 * Récupère la liste des favoris
 */
export async function getFavorites(token: string): Promise<Array<{
  id: number;
  article_url: string;
  article_title: string;
  article_source: string;
  article_image: string | null;
  article_published_at: string | null;
  created_at: string;
}>> {
  const payload = (await apiRequest('/favorites.php', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })) as { favorites?: Array<unknown> };

  return Array.isArray(payload.favorites) ? payload.favorites as Array<unknown> : [];
}

/**
 * Marque un article comme lu
 */
export async function markArticleAsRead(token: string, articleUrl: string): Promise<void> {
  await apiRequest('/read-articles.php', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ article_url: articleUrl }),
  });
}

/**
 * Récupère la liste des articles lus
 */
export async function getReadArticles(token: string): Promise<string[]> {
  const payload = (await apiRequest('/read-articles.php', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })) as { read_articles?: string[] };

  return Array.isArray(payload.read_articles) ? payload.read_articles : [];
}
