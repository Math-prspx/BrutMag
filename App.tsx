import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { XMLParser } from 'fast-xml-parser';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

// Import depuis les modules refactorisés
import {
  // Types
  Feed,
  Story,
  FeedTransferPayload,
  AccountSession,
  MasonryItem,
  Rss2JsonItem,
  Rss2JsonFeedResponse,
  // Constantes
  FEEDS_STORAGE_KEY,
  STORIES_STORAGE_KEY,
  ACCOUNT_TOKEN_KEY,
  ACCOUNT_EMAIL_KEY,
  TONES,
  MAX_ITEMS_PER_FEED,
  FEED_FETCH_TIMEOUT_MS,
  FEED_SYNC_CONCURRENCY,
  RSS2JSON_ENDPOINT,
  SYNC_API_BASE_URL,
  NODE_API_BASE_URL,
  SYNC_STEPS,
  SEED_STORIES as seedStories,
  // Utils date
  isNewStory,
  formatRelativeDate,
  // Utils image
  decodeHtmlEntities,
  resolveImageCandidate,
  extractImageUrlsFromHtml,
  uniqueImageUrls,
  getPrimaryImageUrl,
  getStoryImageCandidates,
  getStoryHeroCandidates,
  getStoryImageKey,
  getDisplayImageUrl,
  getCardImageUrl,
  getDetailHeroImageUrl,
  getSecondaryImageUrls,
  // Utils feed
  buildFeedCandidates,
  fetchFeedJson,
  resolveFeedUrl,
  // loadFeedStories, // Gardé dans App.tsx (logique vidéo spécifique)
  normalizeFeed,
  dedupeFeeds,
  mergeFeeds,
  withTimeout,
  runWithConcurrency,
  // Utils API
  apiRequest as apiRequestUtil,
  loadFeedsFromAccount as loadFeedsFromAccountUtil,
  pushFeedsToAccount as pushFeedsToAccountUtil,
} from './src';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
});

function toHostname(url: string) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

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

function stripHtml(input: string) {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ✅ Fonctions image maintenant importées depuis src/utils/image.ts
// (decodeHtmlEntities, resolveImageCandidate, extractImageUrlsFromHtml, etc.)

// ✅ Fonctions feed/API maintenant importées depuis src/utils/feed.ts et src/utils/api.ts
// (buildFeedCandidates, fetchFeedJson, resolveFeedUrl, loadFeedStories, etc.)
// (withTimeout, runWithConcurrency, normalizeFeed, dedupeFeeds, mergeFeeds)

function extractVideoFromUrl(url: string): { url: string; type: 'youtube' | 'vimeo' | 'native' } | null {
  if (!url) return null;
  
  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (youtubeMatch) {
    return { url: `https://www.youtube.com/embed/${youtubeMatch[1]}`, type: 'youtube' };
  }
  
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return { url: `https://player.vimeo.com/video/${vimeoMatch[1]}`, type: 'vimeo' };
  }
  
  // Vidéo native (mp4, webm, etc.)
  if (/\.(mp4|webm|ogg)$/i.test(url)) {
    return { url, type: 'native' };
  }
  
  return null;
}

function extractVideoFromHtml(html: string): { embedHtml: string; type: 'embed' } | null {
  if (!html) return null;
  
  // Extraire les iframes YouTube/Vimeo
  const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+(?:youtube\.com|youtu\.be|vimeo\.com)[^"']+)["'][^>]*>/i);
  if (iframeMatch) {
    return { embedHtml: iframeMatch[0], type: 'embed' };
  }
  
  return null;
}

async function loadFeedStories(feed: Feed): Promise<Story[]> {
  const data = await fetchFeedJson(feed.url);

  return (data.items ?? []).slice(0, MAX_ITEMS_PER_FEED).map((item, index) => {
    const storyUrl = item.link || item.guid;
    const htmlImages = extractImageUrlsFromHtml(`${item.content || ''} ${item.description || ''}`, storyUrl);
    
    // Filtrer les images "no_thumb" ou placeholders
    const isValidThumbnail = (url: string) => {
      if (!url) return false;
      const lower = url.toLowerCase();
      return !lower.includes('no_thumb') && 
             !lower.includes('placeholder') && 
             !lower.includes('default_thumb');
    };
    
    const preferredCandidates = [
      resolveImageCandidate(item.enclosure?.link || '', storyUrl), // Enclosure d'abord
      resolveImageCandidate(item.thumbnail || '', storyUrl),
      ...htmlImages,
    ].filter((url) => url && isValidThumbnail(url));

    const imageUrls = preferredCandidates.filter(
      (url, urlIndex, array) => array.indexOf(url) === urlIndex,
    );

    let mainImageUrl = imageUrls[0] || '';
    if (!mainImageUrl && htmlImages.length > 0) {
      mainImageUrl = htmlImages[0];
    }

    // Détection vidéo
    let videoUrl: string | undefined;
    let videoType: 'youtube' | 'vimeo' | 'embed' | 'native' | undefined;
    let videoEmbedHtml: string | undefined;

    // 1. Chercher dans l'URL de l'article
    const urlVideo = extractVideoFromUrl(storyUrl || '');
    if (urlVideo) {
      videoUrl = urlVideo.url;
      videoType = urlVideo.type;
    }

    // 2. Chercher dans le contenu HTML
    if (!videoUrl) {
      const htmlVideo = extractVideoFromHtml(item.content || item.description || '');
      if (htmlVideo) {
        videoEmbedHtml = htmlVideo.embedHtml;
        videoType = htmlVideo.type;
      }
    }

    // 3. Chercher dans enclosure (podcasts vidéo)
    if (!videoUrl && item.enclosure?.link) {
      const enclosureVideo = extractVideoFromUrl(item.enclosure.link);
      if (enclosureVideo) {
        videoUrl = enclosureVideo.url;
        videoType = enclosureVideo.type;
      }
    }

    return {
      id: `${feed.id}-rss-${index}`,
      feedId: feed.id,
      source: feed.name.toUpperCase().slice(0, 18),
      title: item.title || 'UNTITLED',
      url: storyUrl,
      publishedAt: item.pubDate,
      summary: stripHtml(item.description || item.content || ''),
      body: stripHtml(item.content || item.description || ''),
      imageUrl: mainImageUrl,
      imageUrls,
      tone: TONES[index % TONES.length],
      videoUrl,
      videoType,
      videoEmbedHtml,
    };
  });
}

function dateToScore(value?: string) {
  if (!value) {
    return 0;
  }

  const score = Date.parse(value);
  return Number.isNaN(score) ? 0 : score;
}

function stableNoise(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash / 0xffffffff;
}

function estimateCardHeight(story: Story, index: number) {
  const base = getPrimaryImageUrl(story) ? 278 : 224;
  const noiseSeed = `${story.id}-${story.title}-${story.source}-${index}`;
  const variation = Math.round(stableNoise(noiseSeed) * (getPrimaryImageUrl(story) ? 112 : 70));
  return base + variation;
}

function makeStoryFromFeed(feed: Feed, index: number): Story {
  const hostname = toHostname(feed.url).split('.')[0] || feed.name;

  return {
    id: `feed-${feed.id}`,
    source: feed.name.toUpperCase().slice(0, 18),
    title: hostname.replace(/[-_]/g, ' ').toUpperCase(),
    tone: TONES[index % TONES.length],
  };
}

function mixStoriesByFeed(stories: Story[]) {
  const seedItems = stories.filter((story) => !story.feedId);
  const feedBuckets = new Map<string, Story[]>();

  stories
    .filter((story) => !!story.feedId)
    .slice()
    .sort((a, b) => dateToScore(b.publishedAt) - dateToScore(a.publishedAt))
    .forEach((story) => {
      const key = story.feedId as string;
      const bucket = feedBuckets.get(key) || [];
      bucket.push(story);
      feedBuckets.set(key, bucket);
    });

  const bucketList = [...feedBuckets.values()];
  const mixedFeedStories: Story[] = [];

  while (bucketList.some((bucket) => bucket.length > 0)) {
    for (const bucket of bucketList) {
      const next = bucket.shift();
      if (next) {
        mixedFeedStories.push(next);
      }
    }
  }

  return [...seedItems, ...mixedFeedStories];
}

function sortStoriesByFeed(stories: Story[]) {
  const seedItems = stories.filter((story) => !story.feedId);
  const feedStories = stories.filter((story) => !!story.feedId);
  const bucketBySource = new Map<string, Story[]>();

  feedStories.forEach((story) => {
    const sourceKey = (story.source || 'INCONNU').trim().toUpperCase();
    const bucket = bucketBySource.get(sourceKey) || [];
    bucket.push(story);
    bucketBySource.set(sourceKey, bucket);
  });

  const sortedSources = [...bucketBySource.keys()].sort((a, b) => a.localeCompare(b));
  const grouped: Story[] = [];

  sortedSources.forEach((sourceKey) => {
    const bucket = (bucketBySource.get(sourceKey) || []).slice().sort(
      (a, b) => dateToScore(b.publishedAt) - dateToScore(a.publishedAt),
    );
    grouped.push(...bucket);
  });

  return [...seedItems, ...grouped];
}

function getMasonryColumnCount(width: number) {
  if (width >= 1080) {
    return 3;
  }

  if (width >= 720) {
    return 2;
  }

  return 1;
}

// ✅ normalizeFeed, dedupeFeeds, mergeFeeds maintenant importés depuis src/utils/feed.ts

// ✅ isNewStory et formatRelativeDate maintenant importés depuis src/utils/date.ts

export default function App() {
  const { width, height } = useWindowDimensions();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [stories, setStories] = useState<Story[]>(seedStories);
  const [storyLayoutMode, setStoryLayoutMode] = useState<'date' | 'mix' | 'feed'>('date');
  const [showComposer, setShowComposer] = useState(false);
  const [feedName, setFeedName] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [error, setError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountToken, setAccountToken] = useState('');
  const [accountMode, setAccountMode] = useState<'local' | 'signed-in' | 'syncing'>('local');
  const [accountMessage, setAccountMessage] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [cardImageAttempts, setCardImageAttempts] = useState<Record<string, number>>({});
  const [syncStep, setSyncStep] = useState(0);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [hoveredStoryId, setHoveredStoryId] = useState<string | null>(null);
  const [articleBody, setArticleBody] = useState('');
  const [scrapedImages, setScrapedImages] = useState<string[]>([]);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState('');
  const [transferText, setTransferText] = useState('');
  const [transferMessage, setTransferMessage] = useState('');
  const [detailHeroAttempt, setDetailHeroAttempt] = useState(0);
  const [detailHeroLoadedKey, setDetailHeroLoadedKey] = useState('');
  const [debugHeroMode, setDebugHeroMode] = useState(false);
  const [forcedHeroUrl, setForcedHeroUrl] = useState('');
  const [displayLimit, setDisplayLimit] = useState(12);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [readArticles, setReadArticles] = useState<Set<string>>(new Set());
  const [favoriteArticles, setFavoriteArticles] = useState<Set<string>>(new Set());
  const [filterSource, setFilterSource] = useState<string>('all');
  const [showReaderMode, setShowReaderMode] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  // Couleurs dynamiques basées sur le thème
  const theme = {
    bg: isDarkMode ? '#000' : '#f5f5f5',
    text: isDarkMode ? '#fff' : '#1a1a1a',
    textSecondary: isDarkMode ? '#9d9d9d' : '#666',
    border: isDarkMode ? '#232323' : '#ddd',
    cardBg: isDarkMode ? '#111' : '#fff',
  };

  async function apiRequest(path: string, options: RequestInit = {}) {
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

  async function saveAccountSession(token: string, email: string) {
    setAccountToken(token);
    setAccountEmail(email);
    await AsyncStorage.multiSet([
      [ACCOUNT_TOKEN_KEY, token],
      [ACCOUNT_EMAIL_KEY, email],
    ]);
  }

  async function clearAccountSession() {
    setAccountToken('');
    setAccountEmail('');
    setAccountBusy(false);
    setAccountMode('local');
    setAccountMessage('Compte déconnecté.');
    await AsyncStorage.multiRemove([ACCOUNT_TOKEN_KEY, ACCOUNT_EMAIL_KEY]);
  }

  async function pushFeedsToAccount(nextFeeds: Feed[], token = accountToken) {
    if (!token) {
      return nextFeeds;
    }

    const payload = (await apiRequest('/feeds.php', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ feeds: nextFeeds }),
    })) as { feeds?: Feed[] };

    return Array.isArray(payload.feeds) ? payload.feeds : nextFeeds;
  }

  async function loadFeedsFromAccount(token: string) {
    const payload = (await apiRequest('/feeds.php', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })) as { feeds?: Feed[] };

    return Array.isArray(payload.feeds) ? payload.feeds : [];
  }

  async function syncFeeds(
    nextFeeds: Feed[],
    options?: { background?: boolean; token?: string },
  ) {
    const normalized = dedupeFeeds(nextFeeds);

    setFeeds(normalized);
    await AsyncStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify(normalized));
    void refreshStories(normalized, options);

    const token = options?.token ?? accountToken;

    if (!token) {
      return normalized;
    }

    try {
      const synced = await pushFeedsToAccount(normalized, token);
      const merged = mergeFeeds(normalized, synced);

      if (merged.length !== normalized.length) {
        setFeeds(merged);
        await AsyncStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify(merged));
        void refreshStories(merged, { background: true });
      }

      setAccountMode('signed-in');
      setAccountMessage(`Flux synchronisés avec ${accountEmail}.`);
      return merged;
    } catch {
      setAccountMode('signed-in');
      setAccountMessage('Sauvegarde locale faite, mais la synchro du compte a échoué.');
      return normalized;
    }
  }

  async function submitAccount(mode: 'login' | 'register') {
    const email = accountEmail.trim().toLowerCase();
    const password = accountPassword.trim();

    if (!email || !password) {
      setAccountMessage('Email et mot de passe requis.');
      return;
    }

    setAccountBusy(true);
    setAccountMode('syncing');
    setAccountMessage(mode === 'login' ? 'Connexion en cours...' : 'Création du compte en cours...');

    try {
      const payload = (await apiRequest(mode === 'login' ? '/auth/login.php' : '/auth/register.php', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })) as AccountSession;

      await saveAccountSession(payload.token, payload.user.email);

      const remoteFeeds = dedupeFeeds(Array.isArray(payload.feeds) ? payload.feeds : []);
      const cachedFeeds = dedupeFeeds(feeds);
      const mergedFeeds = mergeFeeds(remoteFeeds, cachedFeeds);

      const nextFeeds = mergedFeeds.length > 0 ? mergedFeeds : remoteFeeds;
      if (nextFeeds.length > 0) {
        await syncFeeds(nextFeeds, { background: true, token: payload.token });
      } else {
        setFeeds([]);
        await AsyncStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify([]));
        void refreshStories([], { background: true });
      }

      setAccountMode('signed-in');
      setAccountMessage(`Compte synchronisé: ${payload.user.email}`);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'SYNC_FAILED';
      if (mode === 'register' && code === 'ACCOUNT_EXISTS') {
        setAccountMessage('Ce compte existe déjà. Utilise Connexion.');
      } else if (mode === 'login' && code === 'INVALID_CREDENTIALS') {
        setAccountMessage('Identifiants invalides.');
      } else {
        setAccountMessage('Connexion au serveur de synchronisation impossible.');
      }
      setAccountMode('local');
    } finally {
      setAccountBusy(false);
    }
  }

  async function logoutAccount() {
    await clearAccountSession();
  }

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [pulse]);

  useEffect(() => {
    if (!isSyncing) {
      setSyncStep(0);
      return undefined;
    }

    setSyncStep(0);
    const timer = setInterval(() => {
      setSyncStep((prev) => (prev + 1) % SYNC_STEPS.length);
    }, 900);

    return () => {
      clearInterval(timer);
    };
  }, [isSyncing]);

  useEffect(() => {
    if (!selectedStory) {
      setArticleBody('');
      setScrapedImages([]);
      setArticleError('');
      setArticleLoading(false);
      setDetailHeroAttempt(0);
      setDetailHeroLoadedKey('');
      setForcedHeroUrl('');
      return undefined;
    }

    // Utiliser l'image qui a fonctionné dans la carte
    const cardAttempt = cardImageAttempts[selectedStory.id] || 0;
    const initialHeroCandidates = getStoryHeroCandidates(selectedStory);
    const cardImageUrl = initialHeroCandidates[cardAttempt] || initialHeroCandidates[0] || '';

    // Afficher immédiatement le résumé RSS
    const rssContent = stripHtml(selectedStory.body || selectedStory.summary || '');
    setArticleBody(rssContent);
    setScrapedImages([]);
    setArticleError('');
    setDetailHeroAttempt(cardAttempt);
    setDetailHeroLoadedKey('');
    setForcedHeroUrl(cardImageUrl);

    // Tenter de récupérer le contenu complet en arrière-plan
    if (selectedStory.url) {
      setArticleLoading(true);
      
      const fetchFullContent = async () => {
        try {
          const response = await fetch(
            `${NODE_API_BASE_URL}/article-content?url=${encodeURIComponent(selectedStory.url!)}`
          );
          
          if (response.ok) {
            const result = await response.json();
            
            // Si le scraping a réussi et le contenu est plus long que le résumé RSS
            if (result.success && result.content) {
              const scrapedText = stripHtml(result.content);
              
              // Ne remplacer que si le contenu scraped est significativement plus long
              if (scrapedText.length > rssContent.length * 1.2) {
                setArticleBody(scrapedText);
              }
              
              // Stocker les images scrapées si disponibles
              if (result.images && Array.isArray(result.images)) {
                setScrapedImages(result.images);
              }
            }
          }
        } catch (err) {
          // Échec silencieux : on garde le résumé RSS
          console.warn('Full content fetch failed:', err);
        } finally {
          setArticleLoading(false);
        }
      };
      
      fetchFullContent();
    } else {
      setArticleLoading(false);
    }

    return undefined;
  }, [selectedStory, cardImageAttempts]);

  async function refreshStories(currentFeeds: Feed[], options?: { background?: boolean }) {
    const background = options?.background ?? false;

    if (currentFeeds.length === 0) {
      setStories(seedStories);
      setIsSyncing(false);
      setSyncMessage('Aucun flux ajoute pour le moment.');
      await AsyncStorage.setItem(STORIES_STORAGE_KEY, JSON.stringify(seedStories));
      return;
    }

    if (!background) {
      setIsSyncing(true);
      setSyncStep(0);
      setSyncMessage('Synchronisation des articles...');
    }

    const results = await runWithConcurrency(currentFeeds, FEED_SYNC_CONCURRENCY, async (feed) =>
      withTimeout(loadFeedStories(feed), FEED_FETCH_TIMEOUT_MS, 'Feed timeout'),
    );

    const successful = results
      .filter((result): result is PromiseFulfilledResult<Story[]> => result.status === 'fulfilled')
      .flatMap((result) => result.value);

    if (successful.length === 0) {
      if (!background) {
        setStories(seedStories);
        setCardImageAttempts({});
        setSyncMessage('Flux ajoutes, mais aucun article lisible pour l instant.');
        setIsSyncing(false);
      }
      return;
    }

    const sorted = successful.sort(
      (a, b) => dateToScore(b.publishedAt) - dateToScore(a.publishedAt),
    );

    setStories(sorted);
    setFailedImages({});
    setCardImageAttempts({});
    await AsyncStorage.setItem(STORIES_STORAGE_KEY, JSON.stringify(sorted));

    const failedCount = results.length - results.filter((r) => r.status === 'fulfilled').length;
    if (!background) {
      setSyncMessage(
        failedCount > 0
          ? `${sorted.length} articles charges, ${failedCount} flux en echec.`
          : `${sorted.length} articles charges.`,
      );
      setIsSyncing(false);
    } else {
      setSyncMessage(
        failedCount > 0
          ? `${sorted.length} articles charges en arriere-plan, ${failedCount} flux en echec.`
          : `${sorted.length} articles charges en arriere-plan.`,
      );
    }
  }

  useEffect(() => {
    async function loadFeeds() {
      const [rawFeeds, rawStories, rawToken, rawEmail] = await Promise.all([
        AsyncStorage.getItem(FEEDS_STORAGE_KEY),
        AsyncStorage.getItem(STORIES_STORAGE_KEY),
        AsyncStorage.getItem(ACCOUNT_TOKEN_KEY),
        AsyncStorage.getItem(ACCOUNT_EMAIL_KEY),
      ]);

      if (rawStories) {
        try {
          const parsedStories = JSON.parse(rawStories) as Story[];
          if (parsedStories.length > 0) {
            setStories(parsedStories);
          }
        } catch {
          // Ignore invalid cache.
        }
      }

      let cachedFeeds: Feed[] = [];

      if (rawFeeds) {
        try {
          cachedFeeds = (JSON.parse(rawFeeds) as Feed[]).map((feed) => ({
            ...feed,
            sourceUrl: feed.sourceUrl ?? feed.url,
          }));
        } catch {
          cachedFeeds = [];
        }
      }

      setFeeds(cachedFeeds);

      if (rawToken && rawEmail) {
        setAccountToken(rawToken);
        setAccountEmail(rawEmail);
        setAccountMode('syncing');

        try {
          const remoteFeeds = await loadFeedsFromAccount(rawToken);
          const mergedFeeds = mergeFeeds(remoteFeeds, cachedFeeds);

          setFeeds(mergedFeeds);
          await AsyncStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify(mergedFeeds));
          void refreshStories(mergedFeeds, { background: true });

          if (mergedFeeds.length !== remoteFeeds.length) {
            await pushFeedsToAccount(mergedFeeds, rawToken);
          }

          setAccountMode('signed-in');
          setAccountMessage(`Compte synchronisé: ${rawEmail}`);
        } catch {
          setAccountMode('local');
          setAccountMessage('Compte indisponible. Les flux locaux restent visibles.');
          void refreshStories(cachedFeeds, { background: true });
        }
      } else {
        void refreshStories(cachedFeeds, { background: true });
      }
    }

    void loadFeeds();
  }, []);

  const previewStories = useMemo(() => {
    const dynamic = feeds.map((feed, index) => makeStoryFromFeed(feed, index));
    return [...seedStories, ...dynamic];
  }, [feeds]);

  const visibleStories = useMemo(() => {
    let baseStories = stories.length > 0 ? stories : previewStories;
    
    // Filtrage par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      baseStories = baseStories.filter((story) => 
        story.title.toLowerCase().includes(query) || 
        (story.summary || '').toLowerCase().includes(query) ||
        story.source.toLowerCase().includes(query)
      );
    }
    
    // Filtrage par source
    if (filterSource !== 'all') {
      baseStories = baseStories.filter((story) => story.source === filterSource);
    }
    
    // Tri selon le mode
    if (storyLayoutMode === 'mix') {
      baseStories = mixStoriesByFeed(baseStories);
    } else if (storyLayoutMode === 'feed') {
      baseStories = sortStoriesByFeed(baseStories);
    }
    
    // Limitation pour lazy loading
    return baseStories.slice(0, displayLimit);
  }, [stories, previewStories, storyLayoutMode, searchQuery, filterSource, displayLimit]);
  const masonryColumnCount = getMasonryColumnCount(width);
  const minCardHeight = Math.max(220, Math.round(height * 0.65));
  const detailHeroHeight = Math.round(height * 0.95);

  const masonryColumns = useMemo(() => {
    const columns = Array.from({ length: masonryColumnCount }, () => [] as MasonryItem[]);
    const heights = Array.from({ length: masonryColumnCount }, () => 0);

    visibleStories.forEach((story, order) => {
      const minHeightFactor = 0.7 + stableNoise(`${story.id}-min-height`) * 0.65;
      const randomizedMinCardHeight = Math.round(minCardHeight * minHeightFactor);
      const height = Math.max(estimateCardHeight(story, order), randomizedMinCardHeight);
      const targetColumn = heights.indexOf(Math.min(...heights));
      columns[targetColumn].push({ story, order, height });
      heights[targetColumn] += height + 24;
    });

    return columns;
  }, [visibleStories, masonryColumnCount, minCardHeight]);

  const statusLabel = isSyncing ? SYNC_STEPS[syncStep] : syncMessage || 'PRET';
  const statusDetail = isSyncing
    ? `${feeds.length} flux en cours de lecture`
    : syncMessage
      ? accountToken
        ? 'Compte synchronise'
        : 'Derniere action terminee'
      : 'En attente d une action';
  const isDetailWide = width >= 1100;
  const detailHeroSourceCandidates = selectedStory ? getStoryHeroCandidates(selectedStory) : [];
  const detailHeroCandidates = forcedHeroUrl
    ? [forcedHeroUrl, ...detailHeroSourceCandidates.filter((url) => url !== forcedHeroUrl)]
    : detailHeroSourceCandidates;
  const detailHeroIndex = Math.min(detailHeroAttempt, Math.max(detailHeroCandidates.length - 1, 0));
  const detailHeroImageUrl = detailHeroCandidates[detailHeroIndex] || '';
  const detailHeroImageKey = selectedStory
    ? getStoryImageKey(selectedStory.id, detailHeroImageUrl)
    : '';
  const hasDetailHeroImage = !!detailHeroImageUrl;
  const detailFirstAlternateHeroUrl = detailHeroSourceCandidates.find(
    (url) => url !== detailHeroImageUrl,
  ) || '';
  
  // Combiner les images RSS et les images scrapées
  const allGalleryImages = selectedStory
    ? [
        ...detailHeroSourceCandidates.filter((url) => url !== detailHeroImageUrl),
        ...scrapedImages.filter((url) => 
          // Éviter les doublons avec les images RSS
          !detailHeroSourceCandidates.includes(url) && url !== detailHeroImageUrl
        ),
      ]
    : [];
  
  const detailGalleryImages = allGalleryImages.slice(0, 8); // Augmenter la limite à 8 images
  
  const detailHeroUsesGalleryImage = selectedStory
    ? (selectedStory.imageUrls || []).includes(detailHeroImageUrl)
    : false;
  const detailHideFirstRightGalleryImage = detailHeroUsesGalleryImage;
  const detailRenderableGalleryImages = selectedStory
    ? (detailHideFirstRightGalleryImage
        ? detailGalleryImages.filter(
            (url) => !failedImages[getStoryImageKey(selectedStory.id, url)],
          ).slice(1)
        : detailGalleryImages.filter(
            (url) => !failedImages[getStoryImageKey(selectedStory.id, url)],
          ))
    : [];
  const detailTextSegments = useMemo(() => {
    const fallback = 'Contenu indisponible pour cet article.';
    const source = (articleBody || selectedStory?.body || selectedStory?.summary || fallback).trim();

    if (!source || source === fallback) {
      return [fallback];
    }

    const sentences = source.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length <= 4) {
      return [source];
    }

    const chunks: string[] = [];
    for (let index = 0; index < sentences.length; index += 4) {
      chunks.push(sentences.slice(index, index + 4).join(' '));
    }

    return chunks;
  }, [articleBody, selectedStory?.id, selectedStory?.body, selectedStory?.summary]);

  useEffect(() => {
    if (!selectedStory || !detailHeroImageUrl || !detailHeroImageKey) {
      return undefined;
    }

    if (detailHeroLoadedKey === detailHeroImageKey) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setDetailHeroAttempt((prev) =>
        Math.min(prev + 1, Math.max(detailHeroCandidates.length - 1, 0)),
      );
    }, 2200);

    return () => {
      clearTimeout(timer);
    };
  }, [
    selectedStory?.id,
    detailHeroImageUrl,
    detailHeroImageKey,
    detailHeroLoadedKey,
    detailHeroCandidates.length,
  ]);

  if (selectedStory) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>BRUT MAG</Text>
            <Text style={styles.meta}>ARTICLE</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={() => {
                setDebugHeroMode((prev) => !prev);
              }}
              style={styles.addButton}
            >
              <Text style={styles.addButtonLabel}>{debugHeroMode ? 'DEBUG ON' : 'DEBUG OFF'}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setSelectedStory(null);
              }}
              style={styles.addButton}
            >
              <Text style={styles.addButtonLabel}>RETOUR</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statusBar}>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{selectedStory.source}</Text>
          </View>
          <Text style={styles.statusSubtext} numberOfLines={1}>
            {selectedStory.url ? 'LECTURE DU CONTENU SOURCE' : 'CONTENU LOCAL UNIQUEMENT'}
          </Text>
        </View>

        <ScrollView
          style={styles.feed}
          contentContainerStyle={styles.detailContent}
          showsVerticalScrollIndicator={false}
          decelerationRate="normal"
        >
          <View style={[styles.detailMasonryRow, isDetailWide && styles.detailMasonryRowWide]}>
            {hasDetailHeroImage && (
              <View style={styles.detailMediaColumn}>
                <View
                  style={[
                    styles.detailHero,
                    { backgroundColor: selectedStory.tone, height: detailHeroHeight, minHeight: detailHeroHeight },
                  ]}
                >
                  <Image
                    key={detailHeroImageKey}
                    source={{ uri: detailHeroImageUrl }}
                    style={styles.detailImage}
                    resizeMode="cover"
                    onLoad={() => {
                      setDetailHeroLoadedKey(detailHeroImageKey);
                    }}
                    onError={() => {
                      setFailedImages((prev) => ({ ...prev, [detailHeroImageKey]: true }));
                      setDetailHeroAttempt((prev) =>
                        Math.min(prev + 1, Math.max(detailHeroCandidates.length - 1, 0)),
                      );
                    }}
                  />

                  <LinearGradient
                    colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[styles.detailTint, styles.noPointerEvents]}
                  />
                  <View style={styles.detailHeroOverlay}>
                    <Text
                      style={[styles.detailHeroTitle, width < 900 && styles.detailHeroTitleMobile]}
                    >
                      {selectedStory.title}
                    </Text>
                    <Text style={styles.detailKicker}>LECTURE DETAILLEE</Text>
                    {!!selectedStory.publishedAt && (
                      <Text style={styles.detailMeta}>{selectedStory.publishedAt}</Text>
                    )}
                  </View>
                </View>

              </View>
            )}

            <View style={styles.detailCard}>
              <Text style={styles.detailSectionLabel}>CONTENU</Text>

              {/* Player vidéo si disponible */}
              {(selectedStory.videoUrl || selectedStory.videoEmbedHtml) && (
                <View style={styles.videoPlayerContainer}>
                  {selectedStory.videoUrl && selectedStory.videoType !== 'embed' ? (
                    selectedStory.videoType === 'native' ? (
                      <video
                        controls
                        style={{ width: '100%', maxHeight: 500, backgroundColor: '#000' }}
                        src={selectedStory.videoUrl}
                      />
                    ) : (
                      <iframe
                        style={{ width: '100%', height: 500, border: 'none' }}
                        src={selectedStory.videoUrl}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    )
                  ) : selectedStory.videoEmbedHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: selectedStory.videoEmbedHtml }} />
                  ) : null}
                </View>
              )}

              {/* Ajout : Toujours afficher l'image hero en première image du contenu */}
              {hasDetailHeroImage && !(selectedStory.videoUrl || selectedStory.videoEmbedHtml) && (
                <View style={styles.detailInlineImageWrap}>
                  <Image
                    source={{ uri: detailHeroImageUrl }}
                    style={styles.detailInlineImage}
                    resizeMode="cover"
                    onError={() => {
                      setFailedImages((prev) => ({
                        ...prev,
                        [getStoryImageKey(selectedStory.id, detailHeroImageUrl)]: true,
                      }));
                    }}
                  />
                  <LinearGradient
                    colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)']}
                    start={{ x: 0.5, y: 1 }}
                    end={{ x: 0.5, y: 0 }}
                    style={[styles.detailGalleryTint, styles.noPointerEvents]}
                  />
                </View>
              )}
              
              {debugHeroMode && (
                <View style={styles.debugHeroBox}>
                  <Text style={styles.debugHeroLabel}>HERO URL</Text>
                  <Text style={styles.debugHeroValue} numberOfLines={2}>
                    {detailHeroImageUrl || 'AUCUNE URL HERO'}
                  </Text>

                  <Text style={styles.debugHeroLabel}>GALERIE #1</Text>
                  <Text style={styles.debugHeroValue} numberOfLines={2}>
                    {detailFirstAlternateHeroUrl || 'AUCUNE URL ALTERNATIVE'}
                  </Text>

                  <Text style={styles.debugHeroMeta}>
                    tentative {detailHeroIndex + 1}/{Math.max(detailHeroCandidates.length, 1)}
                  </Text>

                  <Pressable
                    onPress={() => {
                      if (!detailFirstAlternateHeroUrl) {
                        return;
                      }

                      setForcedHeroUrl(detailFirstAlternateHeroUrl);
                      setDetailHeroAttempt(0);
                      setDetailHeroLoadedKey('');
                    }}
                    style={styles.debugHeroButton}
                  >
                    <Text style={styles.debugHeroButtonLabel}>HERO = GALERIE #1</Text>
                  </Pressable>
                </View>
              )}
              {articleLoading && <Text style={styles.detailLoading}>CHARGEMENT DU TEXTE...</Text>}
              {!!articleError && <Text style={styles.detailError}>{articleError}</Text>}

              {detailTextSegments.map((segment, segmentIndex) => (
                <View key={`${selectedStory.id}-segment-${segmentIndex}`} style={styles.detailFlowBlock}>
                  <View style={styles.detailTextBox}>
                    <Text style={styles.detailBody}>{segment}</Text>
                  </View>

                  {!!detailRenderableGalleryImages[segmentIndex] && (
                    <View style={styles.detailInlineImageWrap}>
                      <Image
                        source={{ uri: detailRenderableGalleryImages[segmentIndex] }}
                        style={styles.detailInlineImage}
                        resizeMode="cover"
                        onError={() => {
                          const failedUrl = detailRenderableGalleryImages[segmentIndex];
                          if (!failedUrl) {
                            return;
                          }

                          setFailedImages((prev) => ({
                            ...prev,
                            [getStoryImageKey(selectedStory.id, failedUrl)]: true,
                          }));
                        }}
                      />
                      <LinearGradient
                        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)']}
                        start={{ x: 0.5, y: 1 }}
                        end={{ x: 0.5, y: 0 }}
                        style={[styles.detailGalleryTint, styles.noPointerEvents]}
                      />
                    </View>
                  )}
                </View>
              ))}

              {detailRenderableGalleryImages
                .slice(detailTextSegments.length)
                .map((imageUrl, extraIndex) => (
                <View key={`${selectedStory.id}-extra-${extraIndex}`} style={styles.detailInlineImageWrap}>
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.detailInlineImage}
                    resizeMode="cover"
                    onError={() => {
                      setFailedImages((prev) => ({
                        ...prev,
                        [getStoryImageKey(selectedStory.id, imageUrl)]: true,
                      }));
                    }}
                  />
                  <LinearGradient
                    colors={['rgba(0,0,0,00)', 'rgba(0,0,0,0)']}
                    start={{ x: 0.5, y: 1 }}
                    end={{ x: 0.5, y: 0 }}
                    style={[styles.detailGalleryTint, styles.noPointerEvents]}
                  />
                </View>
              ))}

              {!!selectedStory.url && (
                <Pressable
                  onPress={() => {
                    void Linking.openURL(selectedStory.url as string);
                  }}
                  style={styles.detailButton}
                >
                  <Text style={styles.detailButtonLabel}>OUVRIR LA SOURCE</Text>
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  async function addFeed() {
    const cleanName = feedName.trim();
    const cleanUrl = feedUrl.trim();

    if (!cleanName || !cleanUrl) {
      setError('Nom et URL requis.');
      return;
    }

    setError('');

    try {
      const normalizedUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
      const resolvedUrl = await resolveFeedUrl(normalizedUrl);

      const nextFeed: Feed = {
        id: crypto.randomUUID(),
        name: cleanName,
        sourceUrl: normalizedUrl,
        url: resolvedUrl,
        createdAt: Date.now(),
      };

      const nextFeeds = [nextFeed, ...feeds];
      await syncFeeds(nextFeeds, { background: true });

      setFeedName('');
      setFeedUrl('');
      setError('');
      setShowComposer(false);
      setSyncMessage(`Flux ajoute via ${resolvedUrl === normalizedUrl ? 'RSS direct' : 'detector site'}.`);
    } catch {
      setError('Aucun flux detecte sur ce site. Essaie l URL du RSS si elle existe.');
    }
  }

  async function removeFeed(feedId: string) {
    const nextFeeds = feeds.filter((feed) => feed.id !== feedId);
    await syncFeeds(nextFeeds, { background: true });
  }

  function exportFeeds() {
    const payload: FeedTransferPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      feeds,
    };

    setTransferText(JSON.stringify(payload, null, 2));
    setTransferMessage('Export prêt. Copie le JSON puis colle-le plus tard pour importer.');
  }

  async function importFeeds() {
    const raw = transferText.trim();

    if (!raw) {
      setTransferMessage('Colle un export JSON dans le champ avant d importer.');
      return;
    }

    try {
      const parsed = JSON.parse(raw) as FeedTransferPayload | Feed[];
      const incomingFeeds = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as FeedTransferPayload).feeds)
          ? (parsed as FeedTransferPayload).feeds
          : [];

      const normalizedFeeds = incomingFeeds
        .map((feed, index) => ({
          id: feed.id || `${Date.now()}-${index}`,
          name: feed.name?.trim() || 'Flux importé',
          sourceUrl: feed.sourceUrl?.trim() || feed.url,
          url: feed.url?.trim() || feed.sourceUrl,
          createdAt: Number.isFinite(feed.createdAt) ? feed.createdAt : Date.now(),
        }))
        .filter((feed) => feed.name && feed.url);

      if (normalizedFeeds.length === 0) {
        setTransferMessage('Aucun flux valide trouvé dans cet export.');
        return;
      }

      const uniqueFeeds = normalizedFeeds.filter(
        (feed, index, array) =>
          index ===
          array.findIndex(
            (candidate) =>
              candidate.url.toLowerCase() === feed.url.toLowerCase() ||
              candidate.sourceUrl.toLowerCase() === feed.sourceUrl.toLowerCase(),
          ),
      );

      await syncFeeds(uniqueFeeds, { background: true });
      setShowComposer(false);
      setTransferMessage(`${uniqueFeeds.length} flux importés avec succès.`);
    } catch {
      setTransferMessage('JSON invalide. Colle un export généré par l application.');
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>BRUT MAG</Text>
          <Text style={styles.meta}>{feeds.length} FLUX</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setIsDarkMode(prev => !prev)}
            style={styles.addButton}
          >
            <Text style={styles.addButtonLabel}>{isDarkMode ? '☀️ CLAIR' : '🌙 SOMBRE'}</Text>
          </Pressable>
          
          <Pressable
            onPress={() => {
              setShowComposer((prev) => !prev);
              setError('');
            }}
            style={styles.addButton}
          >
            <Text style={styles.addButtonLabel}>
              {showComposer ? 'FERMER' : '+ FLUX'}
            </Text>
          </Pressable>

          <Pressable onPress={() => void syncFeeds(feeds)} style={styles.addButton}>
            <Text style={styles.addButtonLabel}>SYNC</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statusBar}>
        <View style={styles.statusRow}>
          <Animated.View
            style={[
              styles.statusDot,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
                transform: [
                  {
                    scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] }),
                  },
                ],
              },
            ]}
          />
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
        <Text style={styles.statusSubtext}>{statusDetail}</Text>
      </View>

      <View style={styles.layoutSwitcher}>
        <Text style={styles.layoutLabel}>ORDRE DES CARTES</Text>
        <View style={styles.layoutActions}>
          <Pressable
            onPress={() => setStoryLayoutMode('date')}
            style={[styles.layoutButton, storyLayoutMode === 'date' && styles.layoutButtonActive]}
          >
            <Text style={styles.layoutButtonLabel}>DATE</Text>
          </Pressable>

          <Pressable
            onPress={() => setStoryLayoutMode('mix')}
            style={[styles.layoutButton, storyLayoutMode === 'mix' && styles.layoutButtonActive]}
          >
            <Text style={styles.layoutButtonLabel}>MELANGE</Text>
          </Pressable>

          <Pressable
            onPress={() => setStoryLayoutMode('feed')}
            style={[styles.layoutButton, storyLayoutMode === 'feed' && styles.layoutButtonActive]}
          >
            <Text style={styles.layoutButtonLabel}>PAR FLUX</Text>
          </Pressable>
        </View>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchBar}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Rechercher un article..."
          placeholderTextColor="#666"
          style={styles.searchInput}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} style={styles.searchClearButton}>
            <Text style={styles.searchClearText}>✕</Text>
          </Pressable>
        )}
      </View>

      {showComposer && (
        <View style={styles.composer}>
          <View style={styles.accountBox}>
            <Text style={styles.savedFeedsTitle}>COMPTE UTILISATEUR</Text>
            <Text style={styles.accountHint}>
              Synchronise les flux dans un compte local partagé entre navigateurs.
            </Text>

            <TextInput
              value={accountEmail}
              onChangeText={setAccountEmail}
              placeholder="email@exemple.com"
              placeholderTextColor="#5f5f5f"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />

            <TextInput
              value={accountPassword}
              onChangeText={setAccountPassword}
              placeholder="Mot de passe"
              placeholderTextColor="#5f5f5f"
              style={styles.input}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.accountActions}>
              <Pressable
                onPress={() => void submitAccount('login')}
                style={styles.accountButton}
                disabled={accountBusy}
              >
                <Text style={styles.accountButtonLabel}>SE CONNECTER</Text>
              </Pressable>

              <Pressable
                onPress={() => void submitAccount('register')}
                style={styles.accountButton}
                disabled={accountBusy}
              >
                <Text style={styles.accountButtonLabel}>CREER COMPTE</Text>
              </Pressable>

              {!!accountToken && (
                <Pressable onPress={() => void logoutAccount()} style={styles.accountButton}>
                  <Text style={styles.accountButtonLabel}>DECONNEXION</Text>
                </Pressable>
              )}
            </View>

            {!!accountMessage && <Text style={styles.accountMessage}>{accountMessage}</Text>}
          </View>

          <TextInput
            value={feedName}
            onChangeText={setFeedName}
            placeholder="Nom du flux"
            placeholderTextColor="#7f7f7f"
            style={styles.input}
          />

          <TextInput
            value={feedUrl}
            onChangeText={setFeedUrl}
            placeholder="https://site.com ou https://site.com/rss"
            placeholderTextColor="#7f7f7f"
            style={styles.input}
            autoCapitalize="none"
            keyboardType="url"
          />

          <View style={styles.composerFooter}>
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable onPress={() => void addFeed()} style={styles.saveButton}>
              <Text style={styles.saveButtonLabel}>SUIVRE</Text>
            </Pressable>
          </View>

          <View style={styles.savedFeedsBox}>
            <Text style={styles.savedFeedsTitle}>FLUX SAUVEGARDES</Text>

            {feeds.length === 0 ? (
              <Text style={styles.savedFeedEmpty}>AUCUN FLUX ENREGISTRE</Text>
            ) : (
              feeds.map((feed) => (
                <View key={feed.id} style={styles.savedFeedRow}>
                  <View style={styles.savedFeedTextWrap}>
                    <Text style={styles.savedFeedName} numberOfLines={1}>
                      {feed.name.toUpperCase()}
                    </Text>
                    <Text style={styles.savedFeedUrl} numberOfLines={1}>
                      {feed.sourceUrl}
                    </Text>
                    {feed.sourceUrl !== feed.url && (
                      <Text style={styles.savedFeedResolved} numberOfLines={1}>
                        FEED: {feed.url}
                      </Text>
                    )}
                  </View>

                  <Pressable
                    onPress={() => {
                      void removeFeed(feed.id);
                    }}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteButtonLabel}>SUPPRIMER</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          <View style={styles.transferBox}>
            <Text style={styles.savedFeedsTitle}>EXPORT / IMPORT</Text>
            <Text style={styles.transferHint}>
              Exporte la liste des flux depuis une session, colle le JSON ici sur une autre session, puis importe.
            </Text>

            <TextInput
              value={transferText}
              onChangeText={setTransferText}
              placeholder='[{"id":"...","name":"..."}]'
              placeholderTextColor="#5f5f5f"
              style={styles.transferInput}
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.transferActions}>
              <Pressable onPress={exportFeeds} style={styles.transferButton}>
                <Text style={styles.transferButtonLabel}>EXPORTER</Text>
              </Pressable>

              <Pressable onPress={() => void importFeeds()} style={styles.transferButton}>
                <Text style={styles.transferButtonLabel}>IMPORTER</Text>
              </Pressable>
            </View>

            {!!transferMessage && <Text style={styles.transferMessage}>{transferMessage}</Text>}
          </View>
        </View>
      )}

      <ScrollView
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
      >
        {isSyncing && visibleStories.length === seedStories.length ? (
          // Skeleton loader pendant le chargement
          <View style={[styles.masonryRow, { gap: masonryColumnCount > 1 ? 20 : 0 }]}>
            {Array.from({ length: masonryColumnCount }).map((_, columnIndex) => (
              <View key={`skeleton-column-${columnIndex}`} style={styles.masonryColumn}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <Animated.View
                    key={`skeleton-${columnIndex}-${index}`}
                    style={[
                      styles.skeletonCard,
                      {
                        height: 250 + Math.random() * 100,
                        opacity: pulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 0.6],
                        }),
                      },
                    ]}
                  >
                    <View style={styles.skeletonImage} />
                    <View style={styles.skeletonText} />
                    <View style={[styles.skeletonText, { width: '70%' }]} />
                  </Animated.View>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.masonryRow, { gap: masonryColumnCount > 1 ? 20 : 0 }]}> 
          {masonryColumns.map((column, columnIndex) => (
            <View key={`column-${columnIndex}`} style={styles.masonryColumn}>
              {column.map((item) => {
                const attemptIndex = cardImageAttempts[item.story.id] || 0;
                const cardImageUrl = getCardImageUrl(item.story, attemptIndex);
                const cardImageKey = getStoryImageKey(item.story.id, cardImageUrl);

                return (
                <Pressable
                  key={item.story.id}
                  onHoverIn={() => {
                    setHoveredStoryId(item.story.id);
                  }}
                  onHoverOut={() => {
                    setHoveredStoryId((current) => (current === item.story.id ? null : current));
                  }}
                  onPress={() => {
                    setSelectedStory(item.story);
                  }}
                  style={({ pressed }) => [
                    styles.card,
                    { width: '100%' },
                    { height: item.height, opacity: pressed ? 0.96 : 1 },
                  ]}
                >
                  <View style={[styles.image, { backgroundColor: item.story.tone }]}> 
                    {!!cardImageUrl ? (
                      <Image
                        key={cardImageKey}
                        source={{ uri: cardImageUrl }}
                        style={[
                          styles.storyImage,
                          hoveredStoryId === item.story.id
                            ? [styles.grayscaleImage, styles.hoveredImage]
                            : styles.colorImage,
                        ]}
                        resizeMode="cover"
                        onError={() => {
                          setFailedImages((prev) => ({
                            ...prev,
                            [cardImageKey]: true,
                          }));
                          
                          // Essayer l'image suivante
                          const candidates = getStoryImageCandidates(item.story);
                          const currentAttempt = cardImageAttempts[item.story.id] || 0;
                          if (currentAttempt < candidates.length - 1) {
                            setCardImageAttempts((prev) => ({
                              ...prev,
                              [item.story.id]: currentAttempt + 1,
                            }));
                          }
                        }}
                      />
                    ) : (
                      <>
                        <View style={styles.shapeLarge} />
                        <View style={styles.shapeMedium} />
                        <View style={styles.shapeLine} />
                      </>
                    )}

                    <LinearGradient
                      colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0)']}
                      start={{ x: 0.5, y: 1 }}
                      end={{ x: 0.5, y: 0 }}
                      style={[styles.imageTint, styles.noPointerEvents]}
                    />
                    {isNewStory(item.story.publishedAt) && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NOUVEAU</Text>
                      </View>
                    )}
                    {!!item.story.videoUrl || !!item.story.videoEmbedHtml ? (
                      <View style={styles.videoIndicator}>
                        <View style={styles.playButton}>
                          <Text style={styles.playIcon}>▶</Text>
                        </View>
                      </View>
                    ) : null}
                    <View style={styles.overlay}>
                      <Text style={styles.kicker}>{item.story.source}</Text>
                      <Text style={styles.title} numberOfLines={3}>{item.story.title}</Text>
                      {!!item.story.publishedAt && (
                        <Text style={styles.dateText}>{formatRelativeDate(item.story.publishedAt)}</Text>
                      )}
                      {!!item.story.summary && (
                        <Text style={styles.summary} numberOfLines={2}>
                          {item.story.summary}
                        </Text>
                      )}
                    </View>
                  </View>
                </Pressable>
              );})}
            </View>
          ))}
          </View>
        )}
        
        {/* Bouton Charger plus pour lazy loading */}
        {!isSyncing && visibleStories.length >= displayLimit && displayLimit < (stories.length > 0 ? stories.length : previewStories.length) && (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Pressable 
              onPress={() => setDisplayLimit(prev => prev + 12)}
              style={({ pressed }) => [
                {
                  borderWidth: 1,
                  borderColor: '#3f3f3f',
                  backgroundColor: pressed ? '#1a1a1a' : '#0a0a0a',
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                },
              ]}
            >
              <Text style={{
                color: '#fff',
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 1.3,
              }}>
                CHARGER PLUS
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    width: '100%',
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#232323',
  },
  brand: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  issue: {
    color: '#bfbfbf',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  meta: {
    color: '#9d9d9d',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    borderWidth: 1,
    borderColor: '#2f2f2f',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addButtonLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  statusBar: {
    borderBottomWidth: 1,
    borderBottomColor: '#232323',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: '#fff',
  },
  statusText: {
    color: '#9f9f9f',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  statusSubtext: {
    color: '#676767',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  layoutSwitcher: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 8,
  },
  layoutLabel: {
    color: '#8a8a8a',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  layoutActions: {
    flexDirection: 'row',
    gap: 8,
  },
  layoutButton: {
    borderWidth: 1,
    borderColor: '#2b2b2b',
    backgroundColor: '#090909',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  layoutButtonActive: {
    borderColor: '#f5f5f5',
    backgroundColor: '#141414',
  },
  layoutButtonLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  searchClearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  searchClearText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '700',
  },
  composer: {
    borderBottomWidth: 1,
    borderBottomColor: '#232323',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  accountBox: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#0a0a0a',
    padding: 12,
    gap: 10,
  },
  accountHint: {
    color: '#8a8a8a',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  accountActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accountButton: {
    borderWidth: 1,
    borderColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  accountButtonLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  accountMessage: {
    color: '#d3d3d3',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  savedFeedsBox: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#252525',
    paddingTop: 10,
    gap: 8,
  },
  transferBox: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#252525',
    paddingTop: 10,
    gap: 8,
  },
  savedFeedsTitle: {
    color: '#9d9d9d',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  transferHint: {
    color: '#7f7f7f',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  transferInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    color: '#fff',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#0a0a0a',
  },
  transferActions: {
    flexDirection: 'row',
    gap: 8,
  },
  transferButton: {
    borderWidth: 1,
    borderColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  transferButtonLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  transferMessage: {
    color: '#bdbdbd',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  savedFeedEmpty: {
    color: '#707070',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  savedFeedRow: {
    borderWidth: 1,
    borderColor: '#242424',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#090909',
  },
  savedFeedTextWrap: {
    flex: 1,
  },
  savedFeedName: {
    color: '#eaeaea',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  savedFeedUrl: {
    color: '#8a8a8a',
    fontSize: 10,
    fontWeight: '600',
  },
  savedFeedResolved: {
    color: '#616161',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#414141',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  deleteButtonLabel: {
    color: '#d7d7d7',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#2d2d2d',
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0a0a0a',
  },
  composerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  error: {
    color: '#d8d8d8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  saveButton: {
    borderWidth: 1,
    borderColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveButtonLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 24,
  },
  masonryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  masonryColumn: {
    flex: 1,
    minWidth: 0,
    gap: 20,
  },
  card: {
    borderWidth: 1,
    borderColor: '#252525',
    overflow: 'hidden',
  },
  detailContent: {
    paddingHorizontal: 10,
    paddingBottom: 28,
  },
  detailMasonryRow: {
    width: '100%',
    gap: 12,
  },
  detailMasonryRowWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailMediaColumn: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  detailHero: {
    minHeight: 340,
    borderBottomWidth: 1,
    borderBottomColor: '#242424',
    overflow: 'hidden',
  },
  detailImage: {
    ...StyleSheet.absoluteFill,
  },
  detailImageFallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailImageFallbackLabel: {
    color: '#b0b0b0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  detailTint: {
    ...StyleSheet.absoluteFill,
  },
  detailHeroOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  videoIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -30 }, { translateY: -30 }],
    zIndex: 10,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  playIcon: {
    fontSize: 20,
    color: '#000',
    marginLeft: 3,
  },
  videoPlayerContainer: {
    width: '100%',
    marginBottom: 24,
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  skeletonCard: {
    width: '100%',
    marginBottom: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    overflow: 'hidden',
    padding: 16,
  },
  skeletonImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    marginBottom: 12,
  },
  skeletonText: {
    width: '100%',
    height: 14,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    marginBottom: 8,
  },
  detailHeroTitle: {
    color: '#fff',
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: 0.3,
    lineHeight: 75,
    textTransform: 'uppercase',
    textAlign: 'right',
    maxWidth: '75%',
    margin: 20,
  },
  detailHeroTitleMobile: {
    fontSize: 48,
    lineHeight: 51,
    maxWidth: '90%',
  },
  detailKicker: {
    color: '#f0f0f0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },
  detailMeta: {
    color: '#d0d0d0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 10,
  },
  detailCard: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    backgroundColor: '#141414',
    padding: 40,
    paddingTop: 60,
  },
  detailFlowBlock: {
    width: '100%',
    gap: 14,
    marginBottom: 16,
  },
  detailTextBox: {
    width: '80%',
  },
  detailGallery: {
    marginBottom: 14,
    gap: 8,
  },
  detailGalleryItem: {
    height: 180,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
    backgroundColor: '#101010',
  },
  detailGalleryImage: {
    width: '100%',
    height: '100%',
  },
  detailGalleryTint: {
    ...StyleSheet.absoluteFill,
  },
  detailInlineImageWrap: {
    width: '80%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
    backgroundColor: '#101010',
  },
  detailInlineImage: {
    width: '100%',
    height: '100%',
  },
  detailSectionLabel: {
    color: '#8f8f8f',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  detailLoading: {
    color: '#b9b9b9',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  detailError: {
    color: '#ffb4b4',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  debugHeroBox: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#101010',
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  debugHeroLabel: {
    color: '#9a9a9a',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  debugHeroValue: {
    color: '#efefef',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  debugHeroMeta: {
    color: '#bdbdbd',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  debugHeroButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  debugHeroButtonLabel: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  detailBody: {
    color: '#efefef',
    fontSize: 20,
    lineHeight: 30,
    marginTop: 15,
    marginBottom: 15,
  },
  detailButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#f4f4f4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 16,
  },
  detailButtonLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  image: {
    flex: 1,
    overflow: 'hidden',
  },
  storyImage: {
    ...StyleSheet.absoluteFill,
  },
  grayscaleImage: {
    filter: 'grayscale(100%)',
  } as any,
  colorImage: {
    filter: 'none',
  } as any,
  hoveredImage: {
    opacity: 0.3,
  },
  imageTint: {
    ...StyleSheet.absoluteFill,
  },
  noPointerEvents: {
    pointerEvents: 'none',
  },
  shapeLarge: {
    position: 'absolute',
    right: '-12%',
    top: '10%',
    width: '86%',
    height: '42%',
    backgroundColor: '#f8f8f8',
  },
  shapeMedium: {
    position: 'absolute',
    left: 12,
    top: '52%',
    width: '58%',
    height: '28%',
    backgroundColor: '#cfcfcf',
  },
  shapeLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: '24%',
    height: 2,
    backgroundColor: '#ffffff',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  kicker: {
    color: '#f0f0f0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
  summary: {
    color: '#d1d1d1',
    fontSize: 16,
    lineHeight: 20,
    marginTop: 15,
    marginBottom: 15,
    width: '80%',
  },
  dateText: {
    color: '#b0b0b0',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 6,
    opacity: 0.8,
  },
  newBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#ff3366',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});
