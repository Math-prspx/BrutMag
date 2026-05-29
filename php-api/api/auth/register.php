<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

require_once '../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['email']) || !isset($data['password'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Email et password requis']);
    exit();
}

$email = filter_var($data['email'], FILTER_VALIDATE_EMAIL);
if (!$email) {
    http_response_code(400);
    echo json_encode(['error' => 'Email invalide']);
    exit();
}

$database = new Database();
$db = $database->getConnection();

if (!$db) {
    http_response_code(500);
    echo json_encode(['error' => 'Erreur de connexion à la base de données']);
    exit();
}

try {
    // Vérifier si l'email existe déjà
    $check = $db->prepare("SELECT id FROM users WHERE email = :email");
    $check->execute(['email' => $email]);
    
    if ($check->rowCount() > 0) {
        http_response_code(409);
        echo json_encode(['error' => 'Email déjà utilisé']);
        exit();
    }
    
    // Générer salt et hash (compatible avec pbkdf2 de Node.js)
    $salt = bin2hex(random_bytes(32));
    $password_hash = hash_pbkdf2('sha256', $data['password'], hex2bin($salt), 120000, 64);
    $token = bin2hex(random_bytes(32));
    
    // Insérer l'utilisateur
    $stmt = $db->prepare("
        INSERT INTO users (email, salt, password_hash, token) 
        VALUES (:email, :salt, :password_hash, :token)
    ");
    
    $stmt->execute([
        'email' => $email,
        'salt' => $salt,
        'password_hash' => $password_hash,
        'token' => $token
    ]);
    
    $user_id = $db->lastInsertId();
    
    // Ajouter les feeds par défaut
    $default_feeds = [
        ['url' => 'https://www.wallpaper.com/rss', 'title' => 'Wallpaper'],
        ['url' => 'https://www.dezeen.com/feed/', 'title' => 'Dezeen'],
        ['url' => 'https://www.creativereview.co.uk/feed/', 'title' => 'Creative Review'],
        ['url' => 'https://www.designweek.co.uk/feed/', 'title' => 'Design Week'],
        ['url' => 'https://webdesignerdepot.com/feed/', 'title' => 'Web Designer Depot'],
        ['url' => 'https://www.printmag.com/feed/', 'title' => 'Print Magazine']
    ];
    
    $feed_stmt = $db->prepare("
        INSERT INTO user_feeds (user_id, feed_url, feed_title) 
        VALUES (:user_id, :feed_url, :feed_title)
    ");
    
    foreach ($default_feeds as $feed) {
        $feed_stmt->execute([
            'user_id' => $user_id,
            'feed_url' => $feed['url'],
            'feed_title' => $feed['title']
        ]);
    }
    
    // Récupérer les feeds avec leurs IDs et dates depuis la BDD
    $feed_list_stmt = $db->prepare("
        SELECT 
            id,
            feed_title as name,
            feed_url as sourceUrl,
            feed_url as url,
            UNIX_TIMESTAMP(created_at) * 1000 as createdAt
        FROM user_feeds 
        WHERE user_id = :user_id 
        ORDER BY created_at
    ");
    $feed_list_stmt->execute(['user_id' => $user_id]);
    $raw_feeds = $feed_list_stmt->fetchAll();
    
    // Convertir les entiers pour JSON
    $feeds_response = array_map(function($feed) {
        return [
            'id' => (string)$feed['id'],
            'name' => $feed['name'],
            'sourceUrl' => $feed['sourceUrl'],
            'url' => $feed['url'],
            'createdAt' => (int)$feed['createdAt']
        ];
    }, $raw_feeds);
    
    http_response_code(201);
    echo json_encode([
        'message' => 'Compte créé avec succès',
        'token' => $token,
        'email' => $email,
        'user' => [
            'id' => $user_id,
            'email' => $email
        ],
        'feeds' => $feeds_response
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erreur serveur: ' . $e->getMessage()]);
}
