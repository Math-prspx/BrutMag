# API PHP MySQL pour BrutMag

API REST pour gérer la persistance des données utilisateurs (comptes, feeds, favoris, articles lus).

## 📦 Installation sur OVH

### 1. Créer la base de données MySQL

1. Connectez-vous à votre panneau OVH
2. Allez dans **Bases de données** → **Créer une base de données**
3. Notez les informations de connexion :
   - Host (ex: `mysql5-123.perso`)
   - Nom de la BDD (ex: `brutmag_db`)
   - Utilisateur MySQL
   - Mot de passe

### 2. Importer le schéma

1. Ouvrez **phpMyAdmin** depuis votre panneau OVH
2. Sélectionnez votre base de données
3. Onglet **SQL**
4. Copiez/collez le contenu de `install/schema.sql`
5. Cliquez sur **Exécuter**

### 3. Configurer l'API

1. Ouvrez `config/database.php`
2. Remplacez les valeurs :
   ```php
   private $host = "votre_host_mysql.perso"; // ex: mysql5-123.perso
   private $db_name = "brutmag_db";
   private $username = "votre_user_mysql";
   private $password = "votre_password_mysql";
   ```

### 4. Uploader les fichiers

1. Via **FTP** (FileZilla ou autre)
2. Uploadez le dossier `php-api/` dans `/www/` ou `/public_html/`
3. Structure finale :
   ```
   /www/
   ├── projects/
   │   └── brutmag/       (frontend React Native)
   └── api/
       ├── config/
       │   └── database.php
       ├── api/
       │   ├── auth/
       │   │   ├── register.php
       │   │   └── login.php
       │   ├── feeds.php
       │   ├── favorites.php
       │   └── read-articles.php
       └── .htaccess
   ```

### 5. Tester l'API

URL de base : `https://nothuman.be/api/`

Test santé :
```bash
curl https://nothuman.be/api/auth/login.php
```

## 🔌 Endpoints

### Authentification

#### Register
```http
POST /api/auth/register.php
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

#### Login
```http
POST /api/auth/login.php
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

### Feeds (nécessite token)

#### GET Feeds
```http
GET /api/feeds.php
Authorization: Bearer <token>
```

#### PUT Feeds
```http
PUT /api/feeds.php
Authorization: Bearer <token>
Content-Type: application/json

{
  "feeds": [
    { "url": "https://...", "title": "..." }
  ]
}
```

### Favoris (nécessite token)

#### GET Favoris
```http
GET /api/favorites.php
Authorization: Bearer <token>
```

#### POST Favori
```http
POST /api/favorites.php
Authorization: Bearer <token>
Content-Type: application/json

{
  "article_url": "https://...",
  "article_title": "...",
  "article_source": "...",
  "article_image": "...",
  "article_published_at": "2026-05-29"
}
```

#### DELETE Favori
```http
DELETE /api/favorites.php
Authorization: Bearer <token>
Content-Type: application/json

{
  "article_url": "https://..."
}
```

### Articles Lus (nécessite token)

#### GET Articles Lus
```http
GET /api/read-articles.php
Authorization: Bearer <token>
```

#### POST Marquer comme lu
```http
POST /api/read-articles.php
Authorization: Bearer <token>
Content-Type: application/json

{
  "article_url": "https://..."
}
```

## 🔐 Sécurité

- Hashing password avec **pbkdf2** (120 000 itérations, compatible Node.js)
- Token unique par utilisateur
- Validation des entrées
- Protection CORS configurée
- Requêtes préparées (PDO) contre injection SQL

## 🚀 Prochaine étape

Modifier `App.tsx` pour utiliser cette API au lieu de `https://brutmag.onrender.com`
