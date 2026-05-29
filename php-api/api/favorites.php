<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Extraire le token
$headers = getallheaders();
$token = $headers['Authorization'] ?? $headers['authorization'] ?? null;

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
    // Vérifier le token
    $user_stmt = $db->prepare("SELECT id FROM users WHERE token = :token");
    $user_stmt->execute(['token' => $token]);
    $user = $user_stmt->fetch();
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Token invalide']);
        exit();
    }
    
    // GET - Récupérer les favoris
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $db->prepare("
            SELECT article_url, article_title, article_source, 
                   article_image, article_published_at, added_at
            FROM favorites 
            WHERE user_id = :user_id 
            ORDER BY added_at DESC
        ");
        $stmt->execute(['user_id' => $user['id']]);
        $favorites = $stmt->fetchAll();
        
        http_response_code(200);
        echo json_encode(['favorites' => $favorites]);
    }
    
    // POST - Ajouter un favori
    elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents("php://input"), true);
        
        if (!isset($data['article_url'])) {
            http_response_code(400);
            echo json_encode(['error' => 'article_url requis']);
            exit();
        }
        
        $stmt = $db->prepare("
            INSERT INTO favorites 
            (user_id, article_url, article_title, article_source, article_image, article_published_at) 
            VALUES (:user_id, :article_url, :article_title, :article_source, :article_image, :article_published_at)
            ON DUPLICATE KEY UPDATE added_at = CURRENT_TIMESTAMP
        ");
        
        $stmt->execute([
            'user_id' => $user['id'],
            'article_url' => $data['article_url'],
            'article_title' => $data['article_title'] ?? null,
            'article_source' => $data['article_source'] ?? null,
            'article_image' => $data['article_image'] ?? null,
            'article_published_at' => $data['article_published_at'] ?? null
        ]);
        
        http_response_code(201);
        echo json_encode(['message' => 'Favori ajouté']);
    }
    
    // DELETE - Supprimer un favori
    elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $data = json_decode(file_get_contents("php://input"), true);
        
        if (!isset($data['article_url'])) {
            http_response_code(400);
            echo json_encode(['error' => 'article_url requis']);
            exit();
        }
        
        $stmt = $db->prepare("DELETE FROM favorites WHERE user_id = :user_id AND article_url = :article_url");
        $stmt->execute([
            'user_id' => $user['id'],
            'article_url' => $data['article_url']
        ]);
        
        http_response_code(200);
        echo json_encode(['message' => 'Favori supprimé']);
    }
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erreur serveur: ' . $e->getMessage()]);
}
