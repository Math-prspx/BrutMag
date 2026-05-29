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

$database = new Database();
$db = $database->getConnection();

if (!$db) {
    http_response_code(500);
    echo json_encode(['error' => 'Erreur de connexion à la base de données']);
    exit();
}

try {
    $stmt = $db->prepare("SELECT id, email, salt, password_hash, token FROM users WHERE email = :email");
    $stmt->execute(['email' => $data['email']]);
    
    $user = $stmt->fetch();
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Email ou mot de passe incorrect']);
        exit();
    }
    
    // Vérifier le password avec pbkdf2 (compatible Node.js)
    $password_hash = hash_pbkdf2('sha256', $data['password'], hex2bin($user['salt']), 120000, 64);
    
    if ($password_hash !== $user['password_hash']) {
        http_response_code(401);
        echo json_encode(['error' => 'Email ou mot de passe incorrect']);
        exit();
    }
    
    // Récupérer les feeds de l'utilisateur
    $feed_stmt = $db->prepare("
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
    $feed_stmt->execute(['user_id' => $user['id']]);
    $raw_feeds = $feed_stmt->fetchAll();
    
    // Convertir les entiers pour JSON
    $feeds = array_map(function($feed) {
        return [
            'id' => (string)$feed['id'],
            'name' => $feed['name'],
            'sourceUrl' => $feed['sourceUrl'],
            'url' => $feed['url'],
            'createdAt' => (int)$feed['createdAt']
        ];
    }, $raw_feeds);
    
    // Succès - Format compatible avec App.tsx
    http_response_code(200);
    echo json_encode([
        'message' => 'Connexion réussie',
        'token' => $user['token'],
        'email' => $user['email'],
        'user' => [
            'id' => $user['id'],
            'email' => $user['email']
        ],
        'feeds' => $feeds
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erreur serveur']);
}
