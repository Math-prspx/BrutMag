# 📋 Guide d'Installation API PHP/MySQL sur OVH

## Étape 1 : Créer la base de données MySQL

1. **Connectez-vous à votre espace client OVH**
   - URL : https://www.ovh.com/manager/
   
2. **Créer une base de données**
   - Allez dans **Web Cloud** → **Hébergements**
   - Sélectionnez votre hébergement
   - Onglet **Bases de données**
   - Cliquez sur **Créer une base de données**
   - Choisissez **MySQL** (version 5.7 ou supérieure)
   
3. **Notez vos informations de connexion** ⚠️
   ```
   Serveur : mysql5-XXX.perso (ou mysql5-XXX.pro)
   Nom de la base : votreuser_brutmag
   Utilisateur : votreuser
   Mot de passe : [celui que vous avez défini]
   ```

---

## Étape 2 : Importer le schéma SQL

1. **Accédez à phpMyAdmin**
   - Dans l'espace client OVH : **Bases de données** → cliquez sur les 3 points `⋮` → **Accéder à phpMyAdmin**
   - Ou URL directe : https://phpmyadmin.cluster0XX.hosting.ovh.net/
   
2. **Connectez-vous avec vos identifiants MySQL**
   
3. **Importer le schéma**
   - Sélectionnez votre base de données dans le menu de gauche
   - Onglet **SQL** (en haut)
   - Ouvrez le fichier `php-api/install/schema.sql` dans un éditeur de texte
   - Copiez tout le contenu
   - Collez dans la zone de texte de phpMyAdmin
   - Cliquez sur **Exécuter**
   
4. **Vérification**
   - Vous devriez voir 4 tables créées :
     - `users`
     - `user_feeds`
     - `favorites`
     - `read_articles`

---

## Étape 3 : Configurer les identifiants de connexion

1. **Ouvrez le fichier** `php-api/config/database.php`
   
2. **Remplacez les valeurs** aux lignes 4-7 :
   ```php
   private $host = "mysql5-XXX.perso"; // Votre serveur MySQL OVH
   private $db_name = "votreuser_brutmag"; // Votre nom de BDD
   private $username = "votreuser"; // Votre utilisateur MySQL
   private $password = "votre_mot_de_passe"; // Votre mot de passe MySQL
   ```

---

## Étape 4 : Uploader les fichiers via FTP

### Option A : Avec FileZilla (recommandé)

1. **Téléchargez FileZilla** : https://filezilla-project.org/
   
2. **Connectez-vous à votre FTP OVH**
   - Hôte : `ftp.cluster0XX.hosting.ovh.net` (ou `ftp.votredomaine.com`)
   - Utilisateur : votre identifiant FTP OVH
   - Mot de passe : votre mot de passe FTP
   - Port : 21
   
3. **Uploadez le dossier `php-api`**
   - Dans la colonne de droite (serveur), naviguez vers `/www/` ou `/public_html/`
   - Créez un dossier `api`
   - Uploadez tout le contenu de `php-api/` dans `/www/api/`
   
4. **Structure finale sur le serveur** :
   ```
   /www/
   ├── projects/
   │   └── brutmag/           ← Frontend (déjà en place)
   │       ├── index.html
   │       └── ...
   └── api/                   ← Nouveau
       ├── config/
       │   └── database.php
       ├── api/
       │   ├── auth/
       │   │   ├── register.php
       │   │   └── login.php
       │   ├── feeds.php
       │   ├── favorites.php
       │   └── read-articles.php
       ├── install/
       │   └── schema.sql
       ├── .htaccess
       ├── test.html
       └── README.md
   ```

### Option B : Avec le gestionnaire de fichiers OVH

1. Dans votre espace client OVH : **Hébergements** → **FTP - SSH**
2. Cliquez sur **Explorateur FTP** (accès via navigateur)
3. Naviguez vers `/www/`
4. Créez le dossier `api`
5. Uploadez les fichiers un par un

---

## Étape 5 : Tester l'API

1. **Ouvrez votre navigateur**
   
2. **Allez sur la page de test** :
   ```
   https://nothuman.be/api/test.html
   ```
   
3. **Tests à effectuer dans l'ordre** :
   
   #### Test 1 : Register
   - Email : `test@example.com`
   - Password : `test123`
   - Cliquez sur **Test Register**
   - ✅ Succès si vous voyez `"message": "Compte créé avec succès"` et un **token**
   
   #### Test 2 : Login
   - Même email/password
   - Cliquez sur **Test Login**
   - ✅ Le token devrait être automatiquement copié dans les champs suivants
   
   #### Test 3 : Get Feeds
   - Le token est pré-rempli
   - Cliquez sur **Test Get Feeds**
   - ✅ Vous devriez voir la liste des 6 feeds par défaut
   
   #### Test 4 : Add Favorite
   - Cliquez sur **Test Add Favorite**
   - ✅ Message `"Favori ajouté"`
   
   #### Test 5 : Get Favorites
   - Cliquez sur **Test Get Favorites**
   - ✅ Vous devriez voir l'article ajouté précédemment

---

## Étape 6 : Mettre à jour App.tsx

Une fois l'API validée, il faudra modifier `App.tsx` pour utiliser votre API PHP :

**Avant** (ligne ~31) :
```typescript
const SYNC_API_BASE_URL = 'https://brutmag.onrender.com';
```

**Après** :
```typescript
const SYNC_API_BASE_URL = 'https://nothuman.be/api';
```

Puis :
1. `npm run build:ftp`
2. Uploader le nouveau `dist/` sur OVH

---

## 🐛 Dépannage

### Erreur : "Erreur de connexion à la base de données"
- Vérifiez les identifiants dans `config/database.php`
- Vérifiez que la base existe dans phpMyAdmin
- Vérifiez que l'utilisateur a les droits sur cette base

### Erreur 500 sur les endpoints
- Vérifiez les logs PHP dans l'espace client OVH : **Hébergements** → **Logs**
- Vérifiez que le `.htaccess` est bien uploadé
- Vérifiez les permissions des fichiers (755 pour dossiers, 644 pour fichiers)

### CORS errors dans le navigateur
- Vérifiez que le `.htaccess` contient bien les headers CORS
- Testez avec un autre navigateur
- Vérifiez la console du navigateur

### Token invalide
- Vérifiez que le token est bien passé dans le header `Authorization: Bearer <token>`
- Reconnectez-vous pour obtenir un nouveau token

---

## 📞 Prochaines étapes

1. ✅ Installation API PHP/MySQL
2. ⏳ Modifier App.tsx pour utiliser la nouvelle API
3. ⏳ Implémenter les fonctionnalités favoris dans l'UI
4. ⏳ Implémenter les articles lus dans l'UI

---

**Besoin d'aide ?** Contactez-moi avec les détails de l'erreur ! 😊
