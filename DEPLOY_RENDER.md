# Déploiement BrutMag

## 🚀 Déploiement Backend (Render.com)

### Étape 1 : Créer un compte Render
1. Va sur https://render.com
2. Inscris-toi avec ton compte GitHub (recommandé) ou email

### Étape 2 : Pousser le code sur GitHub
```bash
# Initialiser Git (si pas déjà fait)
git init
git add .
git commit -m "Préparation déploiement"

# Créer un repo sur GitHub et le connecter
git remote add origin https://github.com/TON_USERNAME/brutmag-backend.git
git push -u origin main
```

### Étape 3 : Créer un Web Service sur Render
1. Sur Render Dashboard, clique "New +" → "Web Service"
2. Connecte ton repo GitHub
3. Configure :
   - **Name** : `brutmag-backend` (ou autre nom)
   - **Region** : Frankfurt (EU) ou Paris (EU)
   - **Branch** : `main`
   - **Runtime** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Instance Type** : `Free`

4. Variables d'environnement (optionnel) :
   - `SYNC_SERVER_PORT` = `3333` (mais Render utilise son propre port)

5. Clique "Create Web Service"

### Étape 4 : Attendre le déploiement
- Le déploiement prend 2-5 minutes
- Render va te donner une URL : `https://brutmag-backend.onrender.com`
- **Note importante** : Le service gratuit se met en veille après 15 min d'inactivité
  (premier chargement = 30-50 secondes de réveil)

### Étape 5 : Tester le backend
```bash
curl https://brutmag-backend.onrender.com/health
```
Devrait retourner : `{"ok":true}`

---

## 🌐 Déploiement Frontend (OVH)

### Étape 1 : Modifier l'URL du backend dans App.tsx
Remplace :
```typescript
const SYNC_API_BASE_URL = 'http://127.0.0.1:3333';
```
Par :
```typescript
const SYNC_API_BASE_URL = 'https://brutmag-backend.onrender.com';
```

### Étape 2 : Builder le frontend
```bash
npm run build:ftp
npm run zip:ftp
```

Cela crée :
- `dist/` - dossier avec tous les fichiers
- `dist.zip` - archive zip

### Étape 3 : Upload sur OVH par FTP
1. Ouvre ton client FTP (FileZilla, Cyberduck, etc.)
2. Connecte-toi à ton hébergement OVH
3. Va dans le dossier web (souvent `www/`, `public_html/`, ou `htdocs/`)
4. Upload tout le contenu de `dist/`
5. Vérifie que `index.html` est à la racine

### Étape 4 : Tester l'app
Va sur `https://tondomaine.com` et teste !

---

## 📝 Notes importantes

### Backend Gratuit Render
- ✅ **Gratuit à vie**
- ⚠️ **Se met en veille après 15 min** (premier chargement lent)
- ✅ **HTTPS inclus**
- ✅ **Auto-redéploiement** à chaque push GitHub

### Alternative : Upgrade Render
- **7$/mois** : Pas de mise en veille
- Idéal pour production

### Base de données
- La base de données `data/sync-db.json` est en mémoire sur Render
- ⚠️ **Se réinitialise à chaque redéploiement**
- Pour production : utiliser une vraie base de données (MongoDB, PostgreSQL)

---

## 🔧 Commandes utiles

### Développement local
```bash
# Démarrer le backend
node server.js

# Démarrer le frontend
npm run dev
```

### Build production
```bash
# Frontend pour FTP
npm run build:ftp
npm run zip:ftp

# Windows standalone
npm run standalone:win
```
