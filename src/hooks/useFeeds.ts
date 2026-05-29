// Hook pour gérer les feeds et les stories

import { useState, useCallback } from 'react';
import { FEED_FETCH_TIMEOUT_MS, FEED_SYNC_CONCURRENCY, SEED_STORIES } from '../config/constants';
import type { Feed, Story, SyncOptions } from '../types';
import {
  loadFeedStories,
  withTimeout,
  runWithConcurrency,
  dedupeFeeds,
  mergeFeeds,
} from '../utils/feed';
import { saveFeeds, saveStories } from '../utils/storage';

export function useFeeds() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [stories, setStories] = useState<Story[]>(SEED_STORIES);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');

  /**
   * Rafraîchir les stories depuis les feeds
   */
  const refreshStories = useCallback(
    async (feedsToRefresh: Feed[], options?: SyncOptions) => {
      if (!options?.background) {
        setIsSyncing(true);
        setSyncStep(0);
      }

      const results = await runWithConcurrency(
        feedsToRefresh,
        FEED_SYNC_CONCURRENCY,
        async (feed, index) => {
          if (!options?.background) {
            setSyncStep(index % 4);
          }

          try {
            return await withTimeout(
              loadFeedStories(feed),
              FEED_FETCH_TIMEOUT_MS,
              'Feed timeout'
            );
          } catch (error) {
            console.warn(`Failed to load feed ${feed.name}:`, error);
            return [];
          }
        }
      );

      const allStories = results.flat();
      setStories(allStories.length > 0 ? allStories : SEED_STORIES);
      await saveStories(allStories);

      if (!options?.background) {
        setIsSyncing(false);
        const count = allStories.length;
        setSyncMessage(
          count > 0
            ? `${count} article${count > 1 ? 's' : ''} chargé${count > 1 ? 's' : ''} en arrière-plan.`
            : 'Aucun article trouvé.'
        );
      }
    },
    []
  );

  /**
   * Synchroniser les feeds (sauvegarder + rafraîchir)
   */
  const syncFeeds = useCallback(
    async (
      nextFeeds: Feed[],
      options?: SyncOptions,
      syncWithAccountFn?: (feeds: Feed[]) => Promise<Feed[]>
    ): Promise<Feed[]> => {
      const normalized = dedupeFeeds(nextFeeds);

      setFeeds(normalized);
      await saveFeeds(normalized);
      refreshStories(normalized, options);

      // Si une fonction de sync avec le compte est fournie
      if (syncWithAccountFn) {
        try {
          const merged = await syncWithAccountFn(normalized);
          if (merged.length !== normalized.length) {
            setFeeds(merged);
            await saveFeeds(merged);
            refreshStories(merged, { background: true });
            return merged;
          }
        } catch {
          // Ignorer les erreurs de sync
        }
      }

      return normalized;
    },
    [refreshStories]
  );

  /**
   * Ajouter un feed
   */
  const addFeed = useCallback(
    async (feed: Feed, syncWithAccountFn?: (feeds: Feed[]) => Promise<Feed[]>) => {
      const updated = [...feeds, feed];
      return await syncFeeds(updated, { background: true }, syncWithAccountFn);
    },
    [feeds, syncFeeds]
  );

  /**
   * Supprimer un feed
   */
  const removeFeed = useCallback(
    async (feedId: string, syncWithAccountFn?: (feeds: Feed[]) => Promise<Feed[]>) => {
      const updated = feeds.filter((f) => f.id !== feedId);
      return await syncFeeds(updated, { background: true }, syncWithAccountFn);
    },
    [feeds, syncFeeds]
  );

  /**
   * Importer des feeds (merge avec existants)
   */
  const importFeeds = useCallback(
    async (importedFeeds: Feed[], syncWithAccountFn?: (feeds: Feed[]) => Promise<Feed[]>) => {
      const merged = mergeFeeds(feeds, importedFeeds);
      return await syncFeeds(merged, { background: false }, syncWithAccountFn);
    },
    [feeds, syncFeeds]
  );

  return {
    feeds,
    setFeeds,
    stories,
    setStories,
    isSyncing,
    syncStep,
    syncMessage,
    setSyncMessage,
    refreshStories,
    syncFeeds,
    addFeed,
    removeFeed,
    importFeeds,
  };
}
