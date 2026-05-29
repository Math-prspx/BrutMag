// Configuration et constantes de l'application

// Clés AsyncStorage
export const FEEDS_STORAGE_KEY = 'brutmag:feeds';
export const STORIES_STORAGE_KEY = 'brutmag:stories';
export const ACCOUNT_TOKEN_KEY = 'brutmag:accountToken';
export const ACCOUNT_EMAIL_KEY = 'brutmag:accountEmail';

// Palette de couleurs pour les cartes
export const TONES = ['#161616', '#1e1e1e', '#111111', '#191919', '#101010'];

// Configuration des feeds
export const MAX_ITEMS_PER_FEED = 8;
export const FEED_FETCH_TIMEOUT_MS = 10000;
export const FEED_SYNC_CONCURRENCY = 3;

// URLs API
export const RSS2JSON_ENDPOINT = 'https://api.rss2json.com/v1/api.json?rss_url=';
export const SYNC_API_BASE_URL = 'https://nothuman.be/api/api'; // API PHP MySQL
export const NODE_API_BASE_URL = 'https://brutmag.onrender.com'; // Backend Node.js

// Étapes de synchronisation
export const SYNC_STEPS = [
  'LECTURE DES FLUX',
  'DETECTION DES NOUVEAUTES',
  'NETTOYAGE DES REPONSES',
  'RECONSTRUCTION DE LA MOSAIQUE',
];

// Stories de démonstration
export const SEED_STORIES = [
  {
    id: '01',
    title: 'CITY IN SILENCE',
    source: 'ARCHIVE',
    tone: '#161616',
  },
  {
    id: '02',
    title: 'ANGLES OF LIGHT',
    source: 'OBSERVATORY',
    tone: '#1e1e1e',
  },
  {
    id: '03',
    title: 'RAW GEOMETRY',
    source: 'MONO ISSUE',
    tone: '#111111',
  },
];
