// Utilitaires pour AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FEEDS_STORAGE_KEY,
  STORIES_STORAGE_KEY,
  ACCOUNT_TOKEN_KEY,
  ACCOUNT_EMAIL_KEY,
} from '../config/constants';
import type { Feed, Story } from '../types';

/**
 * Sauvegarde les feeds dans AsyncStorage
 */
export async function saveFeeds(feeds: Feed[]): Promise<void> {
  await AsyncStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify(feeds));
}

/**
 * Charge les feeds depuis AsyncStorage
 */
export async function loadFeeds(): Promise<Feed[]> {
  try {
    const json = await AsyncStorage.getItem(FEEDS_STORAGE_KEY);
    if (!json) return [];
    return JSON.parse(json) as Feed[];
  } catch {
    return [];
  }
}

/**
 * Sauvegarde les stories dans AsyncStorage
 */
export async function saveStories(stories: Story[]): Promise<void> {
  await AsyncStorage.setItem(STORIES_STORAGE_KEY, JSON.stringify(stories));
}

/**
 * Charge les stories depuis AsyncStorage
 */
export async function loadStories(): Promise<Story[]> {
  try {
    const json = await AsyncStorage.getItem(STORIES_STORAGE_KEY);
    if (!json) return [];
    return JSON.parse(json) as Story[];
  } catch {
    return [];
  }
}

/**
 * Sauvegarde la session utilisateur
 */
export async function saveAccountSession(token: string, email: string): Promise<void> {
  await AsyncStorage.multiSet([
    [ACCOUNT_TOKEN_KEY, token],
    [ACCOUNT_EMAIL_KEY, email],
  ]);
}

/**
 * Charge la session utilisateur
 */
export async function loadAccountSession(): Promise<{ token: string; email: string } | null> {
  try {
    const [[, token], [, email]] = await AsyncStorage.multiGet([
      ACCOUNT_TOKEN_KEY,
      ACCOUNT_EMAIL_KEY,
    ]);

    if (token && email) {
      return { token, email };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Supprime la session utilisateur
 */
export async function clearAccountSession(): Promise<void> {
  await AsyncStorage.multiRemove([ACCOUNT_TOKEN_KEY, ACCOUNT_EMAIL_KEY]);
}
