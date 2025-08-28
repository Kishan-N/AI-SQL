package com.horhge.sql.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.UUID;

@Service
public class ConnectionManager {
    private static final Logger logger = LoggerFactory.getLogger(ConnectionManager.class);

    // Store active connections with their IDs
    private final Map<String, JdbcTemplate> activeConnections = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> connectionConfigs = new ConcurrentHashMap<>();

    /**
     * Create and store a new database connection
     * @param dbConfig Database configuration including credentials
     * @return Connection ID for future use, or null if connection failed
     */
    public String createConnection(Map<String, Object> dbConfig) {
        if (dbConfig == null) {
            logger.warn("Database config is null");
            return null;
        }

        String type = (String) dbConfig.getOrDefault("type", "mysql");
        String host = (String) dbConfig.getOrDefault("host", "localhost");
        String port = (String) dbConfig.getOrDefault("port", "3306");
        String database = (String) dbConfig.getOrDefault("database", "");
        String username = (String) dbConfig.getOrDefault("username", "");
        String encryptedKey = (String) dbConfig.getOrDefault("encryptedKey", "");
        // Log the encrypted value for debugging
        if (encryptedKey != null && !encryptedKey.isEmpty()) {
            logger.debug("Attempting to decrypt encryptedKey (base64): {}", encryptedKey);
            try {
                encryptedKey = AesEncryptionUtil.decrypt(encryptedKey);
            } catch (Exception e) {
                logger.error("Failed to decrypt encryptedKey: {}. Such issues can arise if a bad key is used during decryption.", e.getMessage());
                // Return a clear error message for the frontend
                throw new RuntimeException("Failed to decrypt database secret. Please re-enter your database configuration.");
            }
        }

        if (host.isEmpty() || database.isEmpty() || username.isEmpty()) {
            logger.warn("Missing required connection parameters");
            return null;
        }

        try {
            String url = buildJdbcUrl(type, host, port, database);
            String driverClass = getDriverClass(type);

            if (url == null || driverClass == null) {
                logger.error("Unsupported database type: {}", type);
                return null;
            }

            logger.info("Creating connection to: {} with user: {}", url, username);

            DriverManagerDataSource dataSource = new DriverManagerDataSource();
            dataSource.setDriverClassName(driverClass);
            dataSource.setUrl(url);
            dataSource.setUsername(username);
            dataSource.setPassword(encryptedKey);

            JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);

            // Test the connection
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);

            // Generate unique connection ID
            String connectionId = UUID.randomUUID().toString();

            // Store the connection and config (without password for security)
            activeConnections.put(connectionId, jdbcTemplate);

            Map<String, Object> safeConfig = Map.of(
                "type", type,
                "host", host,
                "port", port,
                "database", database,
                "username", username,
                "url", url
            );
            connectionConfigs.put(connectionId, safeConfig);

            logger.info("Connection created successfully with ID: {}", connectionId);
            return connectionId;

        } catch (Exception e) {
            logger.error("Failed to create database connection: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Get an active connection by ID
     * @param connectionId Connection ID
     * @return JdbcTemplate instance or null if not found
     */
    public JdbcTemplate getConnection(String connectionId) {
        if (connectionId == null || connectionId.isEmpty()) {
            return null;
        }
        return activeConnections.get(connectionId);
    }

    /**
     * Get connection configuration (without password)
     * @param connectionId Connection ID
     * @return Safe configuration map
     */
    public Map<String, Object> getConnectionConfig(String connectionId) {
        if (connectionId == null || connectionId.isEmpty()) {
            return null;
        }
        return connectionConfigs.get(connectionId);
    }

    /**
     * Test if a connection is still valid
     * @param connectionId Connection ID
     * @return true if connection is valid
     */
    public boolean testConnection(String connectionId) {
        JdbcTemplate jdbc = getConnection(connectionId);
        if (jdbc == null) {
            return false;
        }

        try {
            jdbc.queryForObject("SELECT 1", Integer.class);
            return true;
        } catch (Exception e) {
            logger.warn("Connection {} is no longer valid: {}", connectionId, e.getMessage());
            // Remove invalid connection
            removeConnection(connectionId);
            return false;
        }
    }

    /**
     * Remove a connection from the manager
     * @param connectionId Connection ID to remove
     */
    public void removeConnection(String connectionId) {
        if (connectionId != null) {
            activeConnections.remove(connectionId);
            connectionConfigs.remove(connectionId);
            logger.info("Connection {} removed", connectionId);
        }
    }

    /**
     * Get all active connection IDs with their safe configs
     * @return Map of connection ID to safe config
     */
    public Map<String, Map<String, Object>> getAllConnections() {
        return Map.copyOf(connectionConfigs);
    }

    private String buildJdbcUrl(String type, String host, String port, String database) {
        switch (type) {
            case "mysql":
                return "jdbc:mysql://" + host + ":" + port + "/" + database + "?useSSL=false&serverTimezone=UTC";
            case "postgresql":
                return "jdbc:postgresql://" + host + ":" + port + "/" + database;
            case "mssql":
                return "jdbc:sqlserver://" + host + ":" + port + ";databaseName=" + database;
            case "oracle":
                return "jdbc:oracle:thin:@" + host + ":" + port + ":" + database;
            default:
                return null;
        }
    }

    private String getDriverClass(String type) {
        return switch (type) {
            case "mysql" -> "com.mysql.cj.jdbc.Driver";
            case "postgresql" -> "org.postgresql.Driver";
            case "mssql" -> "com.microsoft.sqlserver.jdbc.SQLServerDriver";
            case "oracle" -> "oracle.jdbc.driver.OracleDriver";
            default -> null;
        };
    }
}
