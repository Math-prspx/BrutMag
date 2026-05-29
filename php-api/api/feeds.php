<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, PUT");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Extraire le token
$token = null;
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $token = $_SERVER['HTTP_AUTHORIZATION'];
} elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $token = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
} elseif (function_exists('apache_request_headers')) {
    $headers = apache_request_headers();
    $token = $headers['Authorization'] ?? $headers['authorization'] ?? null;
}

if ($token && strpos($token, 'Bearer ') === 0) {
    $token = substr($token, 7);
}

if (!$token) {
    http_response_code(401);
    echo json_encode(['error' => 'Token manquant']);
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
    // Vérifier le token et récupérer l'utilisateur
    $user_stmt = $db->prepare("SELECT id, email FROM users WHERE token = :token");
    $user_stmt->execute(['token' => $token]);
    $user = $user_stmt->fetch();
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Token invalide']);
        exit();
    }
    
    // GET - Récupérer les feeds
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $db->prepare("
            SELECT feed_url as url, feed_title as title 
            FROM user_feeds 
            WHERE user_id = :user_id 
            ORDER BY created_at
        ");
        $stmt->execute(['user_id' => $user['id']]);
        $feeds = $stmt->fetchAll();
        
        http_response_code(200);
        echo json_encode(['feeds' => $feeds]);
    }
    
    // PUT - Mettre à jour les feeds
    elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $data = json_decode(file_get_contents("php://input"), true);
        
        if (!isset($data['feeds']) || !is_array($data['feeds'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Format feeds invalide']);
            exit();
        }
        
        // Supprimer tous les anciens feeds
        $delete_stmt = $db->prepare("DELETE FROM user_feeds WHERE user_id = :user_id");
        $delete_stmt->execute(['user_id' => $user['id']]);
        
        // Insérer les nouveaux
        $insert_stmt = $db->prepare("
            INSERT INTO user_feeds (user_id, feed_url, feed_title) 
            VALUES (:user_id, :feed_url, :feed_title)
        ");
        
        foreach ($data['feeds'] as $feed) {
            if (isset($feed['url']) && isset($feed['title'])) {
                $insert_stmt->execute([
                    'user_id' => $user['id'],
                    'feed_url' => $feed['url'],
                    'feed_title' => $feed['title']
                ]);
            }
        }
        
        http_response_code(200);
        echo json_encode(['message' => 'Feeds mis à jour']);
    }
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erreur serveur']);
}
