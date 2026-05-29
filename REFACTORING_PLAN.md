# 🔧 Plan de Refactoring - App.tsx

## 📊 État Actuel

- **App.tsx** : 2774 lignes (monolithique)
- **src/** : 1199 lignes (modules prêts à utiliser)
- **Statut** : Structure modulaire créée, migration progressive à faire

---

## 🎯 Stratégie : Migration Progressive Sans Casse

### Pourquoi progressive ?
- ✅ Éviter les régressions
- ✅ Tester à chaque étape
- ✅ Garder l'app fonctionnelle
- ✅ Faciliter le debugging

---

## 🚦 Étapes de Migration

### ✅ Étape 0 : Préparation (FAIT)
- [x] Créer la structure src/
- [x] Extraire types, utils, hooks
- [x] Créer App.tsx.backup
- [x] Total : 1199 lignes de code structuré

---

### 🔄 Étape 1 : Imports et Types (15 min)

**Objectif** : Remplacer les définitions de types par des imports

```typescript
// Dans App.tsx, ligne 1-50
// SUPPRIMER ces lignes (dupliquer dans src/types)
type Feed = { ... };
type Story = { ... };
type FeedTransferPayload = { ... };
// ... etc

// AJOUTER en haut
import { Feed, Story, FeedTransferPayload } from './src';
```

**Test** : `npm run build:ftp` doit compiler sans erreur

---

### 🔄 Étape 2 : Constantes (10 min)

**Objectif** : Utiliser les constantes depuis src/config

```typescript
// SUPPRIMER ces lignes dans App.tsx
const FEEDS_STORAGE_KEY = 'brutmag:feeds';
const STORIES_STORAGE_KEY = 'brutmag:stories';
const SEED_STORIES = [...];
// ... etc

// AJOUTER à l'import
import {
  Feed,
  Story,
  FEEDS_STORAGE_KEY,
  SEED_STORIES,
  SYNC_API_BASE_URL,
} from './src';
```

**Test** : Vérifier que l'app charge toujours les 3 cartes seeds

---

### 🔄 Étape 3 : Utils Date (5 min) - PRIORITAIRE

**Objectif** : Remplacer les fonctions `isNewStory()` et `formatRelativeDate()`

```typescript
// SUPPRIMER ces fonctions dans App.tsx (~50 lignes)
function isNewStory(publishedAt?: string): boolean { ... }
function formatRelativeDate(publishedAt?: string): string { ... }

// AJOUTER à l'import
import { isNewStory, formatRelativeDate } from './src';
```

**Test** : Vérifier que les badges "NOUVEAU" et les dates relatives s'affichent

---

### 🔄 Étape 4 : Utils Image (10 min) - PRIORITAIRE

**Objectif** : Remplacer les fonctions de gestion d'images

```typescript
// SUPPRIMER ces fonctions dans App.tsx (~200 lignes)
function resolveImageCandidate(...) { ... }
function extractImageUrlsFromHtml(...) { ... }
function getCardImageUrl(...) { ... }
function getStoryImageCandidates(...) { ... }
// ... etc

// AJOUTER à l'import
import {
  resolveImageCandidate,
  extractImageUrlsFromHtml,
  getCardImageUrl,
  getStoryImageCandidates,
  getStoryImageKey,
} from './src';
```

**Test** : Vérifier que les images des cartes s'affichent correctement

---

### 🔄 Étape 5 : Utils Feed (15 min)

**Objectif** : Remplacer les fonctions de gestion des feeds

```typescript
// SUPPRIMER ces fonctions dans App.tsx (~300 lignes)
function fetchFeedJson(...) { ... }
function loadFeedStories(...) { ... }
function resolveFeedUrl(...) { ... }
function buildFeedCandidates(...) { ... }
function dedupeFeeds(...) { ... }
function mergeFeeds(...) { ... }
// ... etc

// AJOUTER à l'import
import {
  fetchFeedJson,
  loadFeedStories,
  resolveFeedUrl,
  dedupeFeeds,
  mergeFeeds,
} from './src';
```

**Test** : Ajouter un nouveau flux et vérifier qu'il charge les articles

---

### 🔄 Étape 6 : Utils API (10 min)

**Objectif** : Remplacer les appels API

```typescript
// SUPPRIMER ces fonctions dans App.tsx (~150 lignes)
async function apiRequest(...) { ... }
async function loginUser(...) { ... }
async function registerUser(...) { ... }
async function loadFeedsFromAccount(...) { ... }
async function pushFeedsToAccount(...) { ... }

// AJOUTER à l'import
import {
  apiRequest,
  loginUser,
  registerUser,
  loadFeedsFromAccount,
  pushFeedsToAccount,
} from './src';
```

**Test** : Se connecter et vérifier que les feeds se synchronisent

---

### 🔄 Étape 7 : Hook useAuth (30 min) - GROS IMPACT

**Objectif** : Remplacer toute la logique d'authentification par le hook

```typescript
// SUPPRIMER dans App.tsx (~150 lignes)
const [accountEmail, setAccountEmail] = useState('');
const [accountPassword, setAccountPassword] = useState('');
const [accountToken, setAccountToken] = useState('');
const [accountMode, setAccountMode] = useState<...>('local');
const [accountMessage, setAccountMessage] = useState('');
const [accountBusy, setAccountBusy] = useState(false);

async function submitAccount(...) { ... }
async function logoutAccount() { ... }
async function syncFeedsWithAccount(...) { ... }
async function loadFeedsFromAccountIfSignedIn() { ... }

// REMPLACER PAR
import { useAuth } from './src';

export default function App() {
  const {
    accountToken,
    accountEmail,
    accountMode,
    accountMessage,
    accountBusy,
    submitAccount,
    logoutAccount,
    syncFeedsWithAccount,
    loadFeedsFromAccountIfSignedIn,
  } = useAuth();

  // Garder juste accountPassword local pour le formulaire
  const [accountPassword, setAccountPassword] = useState('');
}
```

**⚠️ ATTENTION** : Gros changement, bien tester toutes les fonctionnalités d'auth

**Test complet** :
1. Se connecter
2. Vérifier la synchro des feeds
3. Se déconnecter
4. Créer un nouveau compte
5. Import/Export

---

### 🔄 Étape 8 : Hook useFeeds (45 min) - TRÈS GROS IMPACT

**Objectif** : Remplacer toute la logique de gestion des feeds

```typescript
// SUPPRIMER dans App.tsx (~200 lignes)
const [feeds, setFeeds] = useState<Feed[]>([]);
const [stories, setStories] = useState<Story[]>(seedStories);
const [isSyncing, setIsSyncing] = useState(false);
const [syncStep, setSyncStep] = useState(0);
const [syncMessage, setSyncMessage] = useState('');

async function refreshStories(...) { ... }
async function syncFeeds(...) { ... }
async function addFeed() { ... }
async function removeFeed(...) { ... }
async function importFeeds() { ... }

// REMPLACER PAR
import { useFeeds } from './src';

export default function App() {
  const {
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
  } = useFeeds();

  // Adapter addFeed pour utiliser le hook
  async function handleAddFeed() {
    const cleanName = feedName.trim();
    const cleanUrl = feedUrl.trim();
    
    if (!cleanName || !cleanUrl) {
      setError('Nom et URL requis.');
      return;
    }

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

      await addFeed(nextFeed, syncFeedsWithAccount);
      setFeedName('');
      setFeedUrl('');
      setShowComposer(false);
    } catch {
      setError('Aucun flux detecte sur ce site.');
    }
  }
}
```

**⚠️ ATTENTION** : Changement majeur, tester TOUT

**Test exhaustif** :
1. Charger l'app
2. Ajouter un flux
3. Supprimer un flux
4. Rafraîchir les stories
5. Importer/Exporter
6. Vérifier le lazy loading
7. Tester la recherche
8. Changer le mode de tri (date/mix/feed)

---

### 🔄 Étape 9 : Hook useArticleScraper (15 min)

**Objectif** : Remplacer la logique de scraping d'articles

```typescript
// SUPPRIMER dans App.tsx (~80 lignes)
const [articleBody, setArticleBody] = useState('');
const [scrapedImages, setScrapedImages] = useState<string[]>([]);
const [articleLoading, setArticleLoading] = useState(false);
const [articleError, setArticleError] = useState('');

async function scrapeArticle(...) { ... }

// REMPLACER PAR
import { useArticleScraper } from './src';

export default function App() {
  const {
    articleBody,
    scrapedImages,
    articleLoading,
    articleError,
    scrapeArticle,
    resetScraper,
  } = useArticleScraper();
}
```

**Test** : Cliquer sur un article et vérifier que le contenu se charge

---

### 🔄 Étape 10 : Nettoyage Final (10 min)

**Objectif** : Supprimer les fonctions helpers inutilisées

```typescript
// Garder uniquement les fonctions UI spécifiques :
- toHostname()
- getMasonryColumnCount()
- estimateCardHeight()
- makeStoryFromFeed()
- mixStoriesByFeed()
- sortStoriesByFeed()
- stableNoise()
- dateToScore()
```

**Test final** : Parcourir toute l'app et vérifier chaque fonctionnalité

---

## ✅ Checklist de Test Complète

Après chaque étape, tester :

### Navigation
- [ ] L'app se charge
- [ ] Pas d'erreurs console
- [ ] Les cartes s'affichent

### Feeds
- [ ] Ajouter un flux
- [ ] Supprimer un flux
- [ ] Rafraîchir (bouton SYNC)
- [ ] Import/Export JSON

### Authentification
- [ ] Se connecter
- [ ] Créer un compte
- [ ] Se déconnecter
- [ ] Synchro auto des feeds

### Stories
- [ ] Affichage des cartes
- [ ] Images se chargent
- [ ] Badges "NOUVEAU"
- [ ] Dates relatives
- [ ] Tri (date/mix/feed)
- [ ] Lazy loading (charger plus)
- [ ] Recherche

### Article Detail
- [ ] Cliquer sur une carte
- [ ] Hero image
- [ ] Contenu texte
- [ ] Galerie d'images
- [ ] Vidéo (si présente)
- [ ] Bouton "Ouvrir source"

### UI
- [ ] Toggle dark/light mode
- [ ] Responsive (mobile/desktop)
- [ ] Masonry layout (1/2/3 colonnes)

---

## 📊 Résultat Attendu

### Avant (Actuellement)
```
App.tsx : 2774 lignes
```

### Après (Refactorisé)
```
App.tsx : ~800-1000 lignes (UI + styles + logique spécifique)
src/ : 1199 lignes (logique réutilisable)

Total inchangé mais BEAUCOUP plus maintenable !
```

---

## 🎓 Bonnes Pratiques Pendant la Migration

### ✅ À FAIRE
1. **Une étape à la fois** - Ne pas tout faire d'un coup
2. **Tester après chaque étape** - Commit après chaque succès
3. **Garder App.tsx.backup** - Sécurité
4. **Lire les erreurs TypeScript** - Elles vous guident
5. **Utiliser Git** - `git diff` pour voir les changements

### ❌ À ÉVITER
1. Modifier plusieurs fichiers simultanément
2. Ignorer les erreurs de compilation
3. Sauter les tests
4. Dupliquer du code entre App.tsx et src/
5. Faire des "refactoring créatifs" (suivre le plan !)

---

## 🆘 En Cas de Problème

### Erreur de compilation
```bash
# Restaurer la sauvegarde
Copy-Item -Path "App.tsx.backup" -Destination "App.tsx" -Force

# Identifier le problème
npm run build:ftp

# Reprendre depuis la dernière étape fonctionnelle
```

### L'app ne s'affiche plus
1. Vérifier les imports
2. Vérifier que tous les exports existent dans src/index.ts
3. Vérifier les types (Feed, Story, etc.)
4. Consulter la console navigateur

### Les tests échouent
1. Comparer avec App.tsx.backup
2. Vérifier que la logique est identique
3. Chercher les typos dans les noms de fonctions
4. Vérifier les paramètres des fonctions

---

## 🚀 Après le Refactoring

### Prochaines Améliorations
1. **Créer des composants** :
   - `<StoryCard>`
   - `<StoryDetail>`
   - `<FeedComposer>`
   - `<AccountPanel>`

2. **Ajouter des features** :
   - Catégories
   - Animations
   - Mode lecture
   - Favoris UI
   - Articles lus UI
   - Notifications

3. **Optimisations** :
   - Virtual scrolling
   - Lazy load des composants
   - Service Worker (PWA)
   - Caching avancé

---

## 📝 Commit Messages Suggérés

```bash
# Après étape 1
git commit -m "refactor(types): Import types depuis src/"

# Après étape 2
git commit -m "refactor(config): Import constantes depuis src/"

# Après étape 3
git commit -m "refactor(utils): Utiliser date utils depuis src/"

# Après étape 4
git commit -m "refactor(utils): Utiliser image utils depuis src/"

# Après étape 5
git commit -m "refactor(utils): Utiliser feed utils depuis src/"

# Après étape 6
git commit -m "refactor(utils): Utiliser API utils depuis src/"

# Après étape 7
git commit -m "refactor(hooks): Utiliser useAuth hook"

# Après étape 8
git commit -m "refactor(hooks): Utiliser useFeeds hook"

# Après étape 9
git commit -m "refactor(hooks): Utiliser useArticleScraper hook"

# Après étape 10
git commit -m "refactor: Nettoyage final, architecture modulaire complète"
```

---

## ⏱️ Estimation Totale

- **Étapes 1-6** : ~1h15 (utils et types)
- **Étapes 7-9** : ~1h30 (hooks majeurs)
- **Étape 10** : ~15min (nettoyage)
- **Tests complets** : ~30min

**Total : ~3h30** pour un refactoring complet et testé

---

**🎯 GO GO GO ! Une étape à la fois !**
