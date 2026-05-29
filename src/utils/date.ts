// Utilitaires pour la gestion des dates

/**
 * Vérifie si un article a été publié il y a moins de 24h
 */
export function isNewStory(publishedAt?: string): boolean {
  if (!publishedAt) return false;
  const published = new Date(publishedAt).getTime();
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  return now - published < dayInMs;
}

/**
 * Formate une date en format relatif (Il y a 2h, Hier, etc.)
 */
export function formatRelativeDate(publishedAt?: string): string {
  if (!publishedAt) return '';
  
  const published = new Date(publishedAt).getTime();
  const now = Date.now();
  const diffMs = now - published;
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  
  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins}min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)}sem`;
  return `Il y a ${Math.floor(diffDays / 30)}mois`;
}
