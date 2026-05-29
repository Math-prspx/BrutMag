<?php
// Configuration base de données MySQL OVH
class Database {
    private $host = "localhost"; // ou votre host MySQL OVH
    private $db_name = "brutmag_db"; // à créer sur OVH
    private $username = "votre_user_mysql"; // à remplacer
    private $password = "votre_password_mysql"; // à remplacer
    private $conn;

    public function getConnection() {
        $this->conn = null;
        
        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=utf8mb4",
                $this->username,
                $this->password,
                array(
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                )
            );
        } catch(PDOException $e) {
            error_log("Connection error: " . $e->getMessage());
            return null;
        }
        
        return $this->conn;
    }
}
