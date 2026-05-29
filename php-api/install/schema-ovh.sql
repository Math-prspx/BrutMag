-- Schéma de base de données pour BrutMag - Version OVH
-- À copier/coller dans phpMyAdmin

-- Table users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    salt VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table feeds (sources RSS par utilisateur)
CREATE TABLE IF NOT EXISTS user_feeds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    feed_url VARCHAR(500) NOT NULL,
    feed_title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_feed (user_id, feed_url)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table favoris
CREATE TABLE IF NOT EXISTS favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    article_url VARCHAR(500) NOT NULL,
    article_title VARCHAR(500),
    article_source VARCHAR(255),
    article_image VARCHAR(500),
    article_published_at VARCHAR(50),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_favorite (user_id, article_url),
    INDEX idx_user_added (user_id, added_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table articles lus
CREATE TABLE IF NOT EXISTS read_articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    article_url VARCHAR(500) NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_read (user_id, article_url),
    INDEX idx_user_read (user_id, read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Données de test (optionnel)
INSERT INTO users (email, salt, password_hash, token) VALUES 
('sync-test@example.com', 
 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
 'a9c02c77c149b27e4a7c8fb6f53f4fa8b95c4d2e8e3b0c44298fc1c149afbf4c',
 'test-token-12345');

-- Feeds par défaut pour sync-test@example.com
INSERT INTO user_feeds (user_id, feed_url, feed_title) VALUES
(1, 'https://www.wallpaper.com/rss', 'Wallpaper'),
(1, 'https://www.dezeen.com/feed/', 'Dezeen'),
(1, 'https://www.creativereview.co.uk/feed/', 'Creative Review'),
(1, 'https://www.designweek.co.uk/feed/', 'Design Week'),
(1, 'https://webdesignerdepot.com/feed/', 'Web Designer Depot'),
(1, 'https://www.printmag.com/feed/', 'Print Magazine');
