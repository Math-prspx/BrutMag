<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST");
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
    // Vérifier le token
    $user_stmt = $db->prepare("SELECT id FROM users WHERE token = :token");
    $user_stmt->execute(['token' => $token]);
    $user = $user_stmt->fetch();
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Token invalide']);
        exit();
    }
    
    // GET - Récupérer les articles lus
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $db->prepare("
            SELECT article_url, read_at 
            FROM read_articles 
            WHERE user_id = :user_id 
            ORDER BY read_at DESC
        ");
        $stmt->execute(['user_id' => $user['id']]);
        $read_articles = $stmt->fetchAll();
        
        // Retourner juste les URLs pour simplicité
        $urls = array_column($read_articles, 'article_url');
        
        http_response_code(200);
        echo json_encode(['read_articles' => $urls]);
    }
    
    // POST - Marquer un article comme lu
    elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents("php://input"), true);
        
        if (!isset($data['article_url'])) {
            http_response_code(400);
            echo json_encode(['error' => 'article_url requis']);
            exit();
        }
        
        $stmt = $db->prepare("
            INSERT INTO read_articles (user_id, article_url) 
            VALUES (:user_id, :article_url)
            ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP
        ");
        
        $stmt->execute([
            'user_id' => $user['id'],
            'article_url' => $data['article_url']
        ]);
        
        http_response_code(201);
        echo json_encode(['message' => 'Article marqué comme lu']);
    }
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erreur serveur']);
}
