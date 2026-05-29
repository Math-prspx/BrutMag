// Hook pour scraper le contenu des articles

import { useState } from 'react';
import { NODE_API_BASE_URL } from '../config/constants';

export function useArticleScraper() {
  const [articleBody, setArticleBody] = useState('');
  const [scrapedImages, setScrapedImages] = useState<string[]>([]);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState('');

  /**
   * Scrape le contenu d'un article via le backend Node.js
   */
  const scrapeArticle = async (url: string) => {
    setArticleLoading(true);
    setArticleError('');
    setArticleBody('');
    setScrapedImages([]);

    try {
      const response = await fetch(
        `${NODE_API_BASE_URL}/article-content?url=${encodeURIComponent(url)}`
      );

      if (!response.ok) {
        throw new Error('Failed to scrape article');
      }

      const data = (await response.json()) as {
        content?: string;
        images?: string[];
      };

      setArticleBody(data.content || '');
      setScrapedImages(data.images || []);
    } catch (error) {
      console.warn('Article scraping failed:', error);
      setArticleError('Impossible de charger le contenu complet.');
    } finally {
      setArticleLoading(false);
    }
  };

  /**
   * Reset l'état du scraper
   */
  const resetScraper = () => {
    setArticleBody('');
    setScrapedImages([]);
    setArticleLoading(false);
    setArticleError('');
  };

  return {
    articleBody,
    scrapedImages,
    articleLoading,
    articleError,
    scrapeArticle,
    resetScraper,
    // Expose setters pour permettre un usage personnalisé
    setArticleBody,
    setScrapedImages,
    setArticleLoading,
    setArticleError,
  };
}
