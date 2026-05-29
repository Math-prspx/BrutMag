# 📁 Architecture Modulaire - BrutMag

## 🎯 Objectif

Refactoring progressif d'App.tsx (2774 lignes) vers une architecture modulaire et évolutive.

**✅ Actuellement : 1199 lignes de code refactorisé dans `src/`**

## 📂 Structure

```
src/
├── index.ts                  # Export centralisé
├── types/
│   └── index.ts              # Types TypeScript (83 lignes)
├── config/
│   └── constants.ts          # Configuration (50 lignes)
├── utils/
│   ├── date.ts               # Formatage dates (34 lignes)
│   ├── api.ts                # Appels API PHP MySQL (165 lignes)
│   ├── feed.ts               # Gestion feeds RSS (241 lignes)
│   ├── image.ts              # Traitement images (154 lignes)
│   └── storage.ts            # AsyncStorage (87 lignes)
└── hooks/
    ├── useAuth.ts            # Authentification (150 lignes)
    ├── useFeeds.ts           # Gestion feeds/stories (153 lignes)
    └── useArticleScraper.ts  # Scraping articles (63 lignes)
```

**Total : 1199 lignes** bien organisées et réutilisables

---

## 🚀 Utilisation

### Import depuis App.tsx

```typescript
import {
  // Types
  Feed,
  Story,
  FeedTransferPayload,
  StoryLayoutMode,
  
  // Constantes
  FEEDS_STORAGE_KEY,
  SEED_STORIES,
  SYNC_API_BASE_URL,
  
  // Utils dates
  isNewStory,
  formatRelativeDate,
  
  // Utils API
  apiRequest,
  loginUser,
  registerUser,
  loadFeedsFromAccount,
  pushFeedsToAccount,
  
  // Utils feeds
  fetchFeedJson,
  loadFeedStories,
  resolveFeedUrl,
  dedupeFeeds,
  mergeFeeds,
  
  // Utils images
  getCardImageUrl,
  getStoryImageCandidates,
  resolveImageCandidate,
  
  // Hooks
  useAuth,
  useFeeds,
  useArticleScraper,
} from './src';
```

### Exemple : Utiliser le hook useAuth

```typescript
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
  } = useAuth();

  // ... rest of component
}
```

### Exemple : Utiliser le hook useFeeds

```typescript
export default function App() {
  const {
    feeds,
    stories,
    isSyncing,
    syncStep,
    syncMessage,
    syncFeeds,
    addFeed,
    removeFeed,
    refreshStories,
  } = useFeeds();

  // ... rest of component
}
```

---

## 🛠️ Migration Progressive

### Phase 1 : Utiliser les utils (Simple)

```typescript
// Avant
function isNewStory(publishedAt?: string): boolean {
  // ... 10 lignes de code
}

// Après
import { isNewStory } from './src';
```

### Phase 2 : Utiliser les hooks (Moyen)

```typescript
// Avant
const [accountToken, setAccountToken] = useState('');
const [accountEmail, setAccountEmail] = useState('');
// ... 50 lignes de logique auth

// Après
const auth = useAuth();
// Toute la logique est dans le hook !
```

### Phase 3 : Créer des composants (Avancé)

```typescript
// components/StoryCard.tsx
export function StoryCard({ story, onPress }) {
  const imageUrl = getCardImageUrl(story, 0);
  
  return (
    <Pressable onPress={onPress}>
      <Image source={{ uri: imageUrl }} />
      <Text>{story.title}</Text>
    </Pressable>
  );
}
```

---

## 🎨 Avantages

### ✅ Séparation des responsabilités
- **Types** : Définitions centralisées
- **Config** : Constantes modifiables facilement
- **Utils** : Fonctions réutilisables
- **Hooks** : Logique métier isolée

### ✅ Testabilité
Chaque module peut être testé indépendamment

### ✅ Évolutivité
Ajouter de nouvelles fonctionnalités sans toucher App.tsx:

```typescript
// Nouvelle feature : Catégories
src/
├── types/
│   └── index.ts          # + type Category
├── utils/
│   └── category.ts       # Nouvelle logique
└── hooks/
    └── useCategories.ts  # Nouveau hook
```

### ✅ Réutilisabilité
Les utils/hooks peuvent être utilisés dans d'autres projets

---

## 📋 Prochaines Étapes

### Priorité 1 : Intégration Progressive
1. Remplacer les imports de types par `import { Feed, Story } from './src'`
2. Utiliser `isNewStory()` et `formatRelativeDate()` depuis src/
3. Remplacer la logique auth par `useAuth()`
4. Remplacer la logique feeds par `useFeeds()`

### Priorité 2 : Créer des Composants
1. `components/StoryCard.tsx` - Carte d'article
2. `components/StoryDetail.tsx` - Vue détail
3. `components/FeedComposer.tsx` - Panneau ajout flux
4. `components/AccountPanel.tsx` - Panneau compte

### Priorité 3 : Optimisations
1. Lazy loading des composants
2. Memoization avec `useMemo`/`useCallback`
3. Virtual scrolling pour les grandes listes
4. Service Worker pour PWA

---

## 🧪 Tests

### Tester un module

```bash
# Créer un fichier de test
src/utils/__tests__/date.test.ts
```

```typescript
import { isNewStory, formatRelativeDate } from '../date';

describe('date utils', () => {
  it('should detect new story', () => {
    const now = new Date().toISOString();
    expect(isNewStory(now)).toBe(true);
  });

  it('should format relative date', () => {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    expect(formatRelativeDate(oneHourAgo)).toBe('Il y a 1h');
  });
});
```

---

## 🔄 Workflow de Développement

### Ajouter une nouvelle fonctionnalité

1. **Créer les types** dans `src/types/`
2. **Créer les utils** dans `src/utils/`
3. **Créer le hook** dans `src/hooks/`
4. **Utiliser dans App.tsx** ou un composant
5. **Tester** le module isolément

### Exemple : Ajouter les Favoris UI

```typescript
// 1. Type déjà existant (favoris API existe)

// 2. Créer src/hooks/useFavorites.ts
export function useFavorites(accountToken: string) {
  const [favorites, setFavorites] = useState<string[]>([]);
  
  const addFavorite = async (articleUrl: string) => {
    await api.addFavorite(accountToken, { url: articleUrl, ... });
    setFavorites([...favorites, articleUrl]);
  };
  
  return { favorites, addFavorite, removeFavorite };
}

// 3. Utiliser dans App.tsx
const { favorites, addFavorite } = useFavorites(accountToken);
```

---

## 📊 Statistiques

- **Avant** : 1 fichier de 2774 lignes
- **Après** : 12 fichiers de ~100-250 lignes chacun
- **Code extrait** : 1199 lignes (43% du total)
- **Reste à refactoriser** : ~1575 lignes (UI/styles)

---

## 💡 Recommandations

### ✅ À FAIRE
- Utiliser les hooks créés (`useAuth`, `useFeeds`, `useArticleScraper`)
- Importer les types depuis `src/types`
- Utiliser les utils pour les dates et images
- Créer de nouveaux hooks pour les nouvelles features

### ❌ À ÉVITER
- Dupliquer la logique qui existe déjà dans src/
- Créer des composants de 500+ lignes
- Mettre de la logique métier dans les composants UI
- Ignorer la structure modulaire pour les nouvelles features

---

## 🎓 Ressources

- [React Hooks Best Practices](https://react.dev/reference/react)
- [TypeScript Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
- [Code Splitting](https://react.dev/reference/react/lazy)

---

**🚀 Architecture modulaire prête pour l'évolution !**
