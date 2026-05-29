# 🔖 CHECKPOINT - BrutMag - 29 Mai 2026

## 📍 État Actuel du Projet

### ✅ **FONCTIONNEL ET EN LIGNE**

#### Frontend (React Native / Expo)
- **URL** : https://nothuman.be/projects/brutmag/
- **Statut** : ✅ En production et fonctionnel
- **Build** : 646 KB (optimisé)
- **Dernière mise à jour** : 29 Mai 2026

#### Backend Node.js (Render.com)
- **URL** : https://brutmag.onrender.com
- **Statut** : ✅ En ligne
- **Fonction** : Feed proxy avec cache 10min, scraping article content/images

#### API PHP MySQL (OVH)
- **URL** : https://nothuman.be/api/api/
- **Statut** : ✅ En production
- **Base** : nothumanbrutmag.mysql.db
- **Fonction** : Authentification, gestion flux, favoris, suivi lecture

---

## 🎉 Fonctionnalités Implémentées

### 1. **Lazy Loading** ⚡
- 12 articles chargés initialement
- Bouton "CHARGER PLUS" pour charger par tranches de 12
- Performance optimisée

### 2. **Dates Relatives** 📅
- Format : "Il y a 6h", "Hier", "Il y a 3j"
- Affichage sous chaque titre d'article

### 3. **Badge "NOUVEAU"** 🔴
- Articles publiés il y a moins de 24h
- Badge rouge "NOUVEAU" affiché

### 4. **Synchronisation MySQL** 🔄
- Authentification utilisateur (login/register)
- Synchronisation des flux entre navigateurs
- 6 flux design par défaut
- API REST complète (feeds, favorites, read tracking)

### 5. **Interface Améliorée** 🎨
- Mode clair/sombre
- Recherche en temps réel
- Layout masonry avec images
- Tri par date/mélange/flux

---

## 📁 Structure du Projet (Nettoyée)

```
test_AI/
├── App.tsx              # Application React Native principale (2250+ lignes)
├── index.ts             # Point d'entrée Expo
├── app.json             # Config Expo (base path: /projects/brutmag)
├── package.json         # Dépendances
├── tsconfig.json        # Config TypeScript
├── server.js            # Backend Node.js (Render.com)
├── dist/                # Build statique FTP
├── assets/              # Images et ressources
├── electron/            # Source Electron (optionnel)
├── php-api/             # API PHP MySQL
│   ├── .htaccess        # Config Apache + CORS
│   ├── config/
│   │   └── database.php # Connexion MySQL
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login.php
│   │   │   └── register.php
│   │   ├── feeds.php
│   │   ├── favorites.php
│   │   └── read-articles.php
│   └── install/
│       ├── schema.sql
│       └── schema-ovh.sql
└── DEPLOY.md            # Instructions déploiement
```

---

## 🗄️ Base de Données MySQL

**Tables :**
- `users` : Comptes utilisateurs (email, password_hash, salt, token)
- `user_feeds` : Flux RSS de chaque utilisateur
- `favorites` : Articles favoris
- `read_articles` : Articles lus

**Compte Test :**
- Email : mathieu@nothuman.be
- Password : Brutmag123
- Token : 7699908787404d6c09e34aed1861b3d4f802675234ff1f44f22e8e3c9293a281

**Flux par Défaut (6) :**
- Wallpaper
- Dezeen
- Creative Review
- Design Week
- Web Designer Depot
- Print Magazine

---

## 🚀 Déploiement

### Frontend
```bash
npm run build:ftp    # Build statique
# Upload dist/ vers /www/projects/brutmag/ via FTP
```

### API PHP
```bash
# Upload php-api/ vers /www/api/ via FTP
# Configurer database.php avec credentials MySQL OVH
```

### Backend Node.js
- Auto-deploy depuis GitHub vers Render.com
- URL : https://brutmag.onrender.com

---

## ✅ Tests Validés

- ✅ Login/Register fonctionnel
- ✅ Synchronisation des 6 flux depuis MySQL
- ✅ Chargement de 48 articles avec images
- ✅ Badges "NOUVEAU" affichés
- ✅ Dates relatives correctes
- ✅ Mode clair/sombre
- ✅ Recherche fonctionnelle
- ✅ Lazy loading opérationnel

---

## 📋 TODO Prochaines Étapes

### Priorité Haute
- [ ] Implémenter UI Favoris (⭐ bouton sur articles)
- [ ] Implémenter suivi de lecture (marquer comme lu)
- [ ] Sauvegarder sur Git

### Améliorations Futures
- [ ] PWA avec service worker
- [ ] Notifications push
- [ ] Mode hors ligne
- [ ] Export/import OPML
- Badge rose/rouge sur articles < 24h
- Position : coin supérieur droit des cartes

### 4. **Recherche en Temps Réel** 🔍
- Barre de recherche avec filtrage instantané
- Filtre par : titre, résumé, source
- Bouton ✕ pour effacer la recherche

### 5. **Thème Clair/Sombre** 🌙☀️
- Toggle dans le header
- Transition fluide entre modes
- Mode sombre par défaut

### 6. **API PHP/MySQL Créée** 🗄️
- API REST complète pour persistance des données
- Fichiers prêts dans `php-api/` et `php-api.zip`
- **NON ENCORE INSTALLÉE SUR OVH**

---

## 📦 Fichiers Importants

### Frontend
- **App.tsx** : Application principale (~2250+ lignes)
- **server.js** : Backend Node.js (Render.com)
- **dist/** : Build de production (646KB)

### API PHP (À installer)
- **php-api/** : Code complet de l'API
- **php-api.zip** : Archive prête pour upload FTP
- **php-api/INSTALL.md** : Guide d'installation détaillé
- **php-api/config/database.php** : ⚠️ À configurer avec vos identifiants MySQL

---

## 🎯 PROCHAINES ÉTAPES (Dans l'ordre)

### **ÉTAPE 1 : Installer l'API PHP/MySQL** ⏳

#### 1.1 - Créer la base MySQL sur OVH (5 min)
```
1. Panneau OVH → Hébergements → Bases de données
2. Créer une base de données MySQL 5.7+
3. Noter les informations :
   - Host : mysql5-XXX.perso
   - Nom BDD : votreuser_brutmag
   - User : votreuser
   - Password : [votre password]
```

#### 1.2 - Importer le schéma SQL (2 min)
```
1. Accéder à phpMyAdmin (depuis panneau OVH)
2. Onglet SQL
3. Copier/coller le contenu de php-api/install/schema.sql
4. Exécuter
5. Vérifier que 4 tables sont créées :
   - users
   - user_feeds
   - favorites
   - read_articles
```

#### 1.3 - Configurer les identifiants (1 min)
```
Éditer : php-api/config/database.php
Lignes 4-7, remplacer :
   private $host = "mysql5-XXX.perso";
   private $db_name = "votreuser_brutmag";
   private $username = "votreuser";
   private $password = "votre_mot_de_passe";
```

#### 1.4 - Uploader via FTP (5 min)
```
Avec FileZilla ou Gestionnaire FTP OVH :
1. Se connecter au FTP
2. Aller dans /www/
3. Créer dossier api/
4. Uploader tout le contenu de php-api/ dedans

Structure finale :
/www/
├── projects/
│   └── brutmag/     ← Frontend (déjà là)
└── api/             ← Nouveau
    ├── config/
    ├── api/
    ├── .htaccess
    └── test.html
```

#### 1.5 - Tester l'API (5 min)
```
1. Ouvrir : https://nothuman.be/api/test.html
2. Test Register → Login → Get Feeds
3. Vérifier que chaque test renvoie un succès ✅
```

---

### **ÉTAPE 2 : Connecter App.tsx à l'API PHP**

#### 2.1 - Changer l'URL de base
```typescript
// Dans App.tsx, ligne ~31
// AVANT :
const SYNC_API_BASE_URL = 'https://brutmag.onrender.com';

// APRÈS :
const SYNC_API_BASE_URL = 'https://nothuman.be/api';
```

#### 2.2 - Adapter les endpoints
```typescript
// AVANT :
/auth/register → /auth/register.php
/auth/login    → /auth/login.php
/feeds         → /feeds.php

// APRÈS : Ajouter .php aux endpoints
```

#### 2.3 - Rebuild et déployer
```bash
npm run build:ftp
# Uploader dist/ sur OVH via FTP
```

---

### **ÉTAPE 3 : Implémenter Favoris + Articles Lus**

#### 3.1 - Ajouter états dans App.tsx
```typescript
const [favorites, setFavorites] = useState<string[]>([]); // URLs des favoris
const [readArticles, setReadArticles] = useState<string[]>([]); // URLs lues
```

#### 3.2 - Ajouter fonctions API
```typescript
async function addFavorite(story: Story) {
  // POST /api/favorites.php
}

async function removeFavorite(url: string) {
  // DELETE /api/favorites.php
}

async function markAsRead(url: string) {
  // POST /api/read-articles.php
}
```

#### 3.3 - Ajouter UI
- Bouton ⭐ sur chaque carte (toggle favori)
- Indicateur visuel pour articles lus (opacité réduite)
- Onglet "Favoris" dans le menu

---

## 🔐 Informations Importantes

### URLs de Production
- **Frontend** : https://nothuman.be/projects/brutmag/
- **Backend Node.js** : https://brutmag.onrender.com
- **API PHP** (future) : https://nothuman.be/api/

### Comptes de Test
- **Email** : sync-test@example.com
- **Password** : test123
- **Token** : (généré à chaque login)

### Commandes Utiles
```bash
# Build frontend
npm run build:ftp

# Build + créer zip
npm run zip:ftp

# Démarrer serveur local Expo
npm run dev

# Démarrer backend Node.js local
node server.js
```

### Structure Git
- **Repo GitHub** : https://github.com/Math-prspx/BrutMag
- **Branches** : main (production)

---

## 📊 État des Fonctionnalités

| Fonctionnalité | Statut | Notes |
|---|---|---|
| RSS Feed Reader | ✅ En production | 6 feeds configurés |
| Images + Videos | ✅ En production | Retry automatique |
| Scraping Articles | ✅ En production | Render.com |
| Scraping Images | ✅ En production | Jusqu'à 8 images/article |
| Cache Feeds | ✅ En production | 10 min TTL |
| Cache Articles | ✅ En production | 1h TTL |
| Lazy Loading | ✅ En production | 12 articles initiaux |
| Dates Relatives | ✅ En production | Format français |
| Badge "NOUVEAU" | ✅ En production | < 24h |
| Recherche | ✅ En production | Temps réel |
| Thème Clair/Sombre | ✅ En production | Toggle header |
| **API PHP/MySQL** | ⏳ À installer | Code prêt |
| **Favoris** | ❌ Non implémenté | Nécessite API |
| **Articles Lus** | ❌ Non implémenté | Nécessite API |
| **Reader Mode** | ❌ Non planifié | Complexe |

---

## 🚀 Pour Reprendre le Travail

### Si l'API n'est pas encore installée :
1. Ouvrir **php-api/INSTALL.md** (guide détaillé)
2. Suivre les étapes 1 à 5
3. Revenir ici pour l'étape 2

### Si l'API est installée et testée :
1. Modifier **App.tsx** (voir ÉTAPE 2)
2. `npm run build:ftp`
3. Uploader `dist/` via FTP
4. Tester sur https://nothuman.be/projects/brutmag/

### Pour implémenter les favoris :
1. Voir ÉTAPE 3 ci-dessus
2. Code à ajouter dans App.tsx
3. Rebuild + upload

---

## 📝 Notes Techniques

### Architecture Actuelle
```
Frontend (Expo Web)
    ↓
Backend Node.js (Render)   ← Cache + Scraping
    ↓
RSS Feeds externes
```

### Architecture Future (avec MySQL)
```
Frontend (Expo Web)
    ↓
API PHP (OVH)              ← Auth + Favoris + Lus
    ↓
MySQL (OVH)                ← Persistance

+
Backend Node.js (Render)   ← Cache + Scraping (garde)
    ↓
RSS Feeds externes
```

### Avantages de MySQL
- ✅ Persistance permanente (pas de reset)
- ✅ Favoris illimités par utilisateur
- ✅ Historique de lecture
- ✅ Serveur EU (plus rapide que Render US)
- ✅ Base relationnelle (vs JSON file)

---

## 🐛 Problèmes Connus

### Images HTTP vs HTTPS
- **Symptôme** : Warnings "Mixed Content" dans la console
- **Cause** : Certains feeds (Dezeen) servent images en HTTP
- **Solution actuelle** : Navigateur auto-upgrade vers HTTPS
- **Impact** : Aucun, transparent pour l'utilisateur

### Render.com Free Tier
- **Symptôme** : Données réinitialisées à chaque redéploiement
- **Solution** : Migration vers MySQL OVH (en cours)

---

## ✅ Checklist de Reprise

- [ ] Lire ce fichier CHECKPOINT.md
- [ ] Ouvrir php-api/INSTALL.md
- [ ] Créer base MySQL sur OVH
- [ ] Importer schema.sql
- [ ] Configurer database.php
- [ ] Uploader API via FTP
- [ ] Tester sur /api/test.html
- [ ] Modifier App.tsx (URL + endpoints)
- [ ] Build + Upload frontend
- [ ] Tester la connexion frontend ↔ API
- [ ] Implémenter favoris dans l'UI
- [ ] Implémenter articles lus dans l'UI

---

## 📞 Besoin d'Aide ?

### Fichiers de Référence
- **CHECKPOINT.md** (ce fichier) : Point de sauvegarde
- **php-api/INSTALL.md** : Guide d'installation API
- **php-api/README.md** : Documentation API complète
- **DEPLOY_RENDER.md** : Guide déploiement (déjà fait)

### Commandes Rapides
```bash
# Voir l'état Git
git status

# Créer un commit de sauvegarde
git add .
git commit -m "Checkpoint: API PHP créée"
git push

# Lancer l'app en local
npm run dev
```

---

**Dernière mise à jour** : 29 Mai 2026, après implémentation des 5 nouvelles fonctionnalités UX

**Prêt à continuer !** 🚀

Ouvrez ce fichier pour reprendre exactement où vous en étiez. Tout est documenté ! 😊
