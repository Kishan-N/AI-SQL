package com.horhge.sql.controller;

import  com.horhge.sql.service.AiService;
import com.horhge.sql.service.HuggingFaceClient;
import com.horhge.sql.service.ConnectionManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api")
public class QueryController {
    private static final Logger logger = LoggerFactory.getLogger(QueryController.class);

    @Autowired
    private AiService aiService;

    @Autowired
    private ConnectionManager connectionManager;

    @PostMapping("/query")
    public ResponseEntity<Map<String, Object>> query(@RequestBody Map<String, Object> body) {
        String prompt = (String) body.getOrDefault("prompt", "");
        boolean enableChart = body.get("enableChart") instanceof Boolean ? (Boolean) body.get("enableChart") : true;
        String connectionId = (String) body.get("connectionId");

        logger.info("/api/query called with prompt: {} (enableChart={}, connectionId={})", prompt, enableChart, connectionId);

        Map<String, Object> response = aiService.queryAi(prompt, enableChart, connectionId);
        logger.info("/api/query response: {}", response.keySet());

        if (response.containsKey("error")) {
            logger.error("/api/query error: {}", response.get("error"));
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
        if (response.containsKey("chartImageError")) {
            logger.error("/api/query chart image error: {}", response.get("chartImageError"));
            // Still return 200, but log the error for chart image only
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/create-connection")
    public ResponseEntity<Map<String, Object>> createConnection(@RequestBody Map<String, Object> dbConfig) {
        Map<String, Object> result = new HashMap<>();
        logger.info("/api/create-connection called");

        try {
            String connectionId = connectionManager.createConnection(dbConfig);

            if (connectionId != null) {
                result.put("success", true);
                result.put("connectionId", connectionId);
                result.put("message", "Database connection created successfully");
                logger.info("/api/create-connection: Connection created with ID: {}", connectionId);
            } else {
                result.put("success", false);
                result.put("message", "Failed to create database connection");
                logger.warn("/api/create-connection: Connection creation failed");
            }

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("/api/create-connection error: {}", e.getMessage(), e);
            result.put("success", false);
            result.put("message", "Connection creation failed: " + e.getMessage());
            return ResponseEntity.ok(result);
        }
    }

    @PostMapping("/test-connection")
    public ResponseEntity<Map<String, Object>> testConnection(@RequestBody Map<String, Object> dbConfig) {
        Map<String, Object> result = new HashMap<>();
        logger.info("/api/test-connection called");

        try {
            // Create a temporary connection just for testing
            String tempConnectionId = connectionManager.createConnection(dbConfig);

            if (tempConnectionId != null) {
                result.put("success", true);
                result.put("message", "Database connection test successful");
                logger.info("/api/test-connection: Connection successful");

                // Clean up the temporary connection
                connectionManager.removeConnection(tempConnectionId);
            } else {
                result.put("success", false);
                result.put("message", "Database connection test failed");
                logger.warn("/api/test-connection: Connection failed");
            }

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("/api/test-connection error: {}", e.getMessage(), e);
            result.put("success", false);
            result.put("message", "Connection test failed: " + e.getMessage());
            return ResponseEntity.ok(result);
        }
    }

    @GetMapping("/connections")
    public ResponseEntity<Map<String, Object>> getConnections() {
        Map<String, Object> result = new HashMap<>();
        try {
            Map<String, Map<String, Object>> connections = connectionManager.getAllConnections();
            result.put("connections", connections);
            logger.info("/api/connections: Returned {} connections", connections.size());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("/api/connections error: {}", e.getMessage(), e);
            result.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
        }
    }

    @DeleteMapping("/connections/{connectionId}")
    public ResponseEntity<Map<String, Object>> removeConnection(@PathVariable String connectionId) {
        Map<String, Object> result = new HashMap<>();
        try {
            connectionManager.removeConnection(connectionId);
            result.put("success", true);
            result.put("message", "Connection removed successfully");
            logger.info("/api/connections/{}: Connection removed", connectionId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("/api/connections/{} error: {}", connectionId, e.getMessage(), e);
            result.put("success", false);
            result.put("message", "Failed to remove connection: " + e.getMessage());
            return ResponseEntity.ok(result);
        }
    }

    @PostMapping("/huggingface")
    public ResponseEntity<Map<String, Object>> huggingFace(@RequestBody Map<String, String> body) {
        String prompt = body.getOrDefault("prompt", "");
        logger.info("/api/huggingface called with prompt: {}", prompt);
        Map<String, Object> result = new HashMap<>();
        try {
            String hfResponse = HuggingFaceClient.generateText(prompt);
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(hfResponse);
            String content = "";
            if (root.has("choices") && root.get("choices").isArray() && root.get("choices").size() > 0) {
                JsonNode message = root.get("choices").get(0).get("message");
                if (message != null && message.has("content")) {
                    content = message.get("content").asText();
                }
            }
            result.put("huggingface", content);
            logger.info("/api/huggingface response: content length {}", content.length());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("/api/huggingface error: {}", e.getMessage(), e);
            result.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
        }
    }

    @PostMapping("/generate-image")
    public ResponseEntity<Map<String, Object>> generateImage(@RequestBody Map<String, String> body) {
        Map<String, Object> result = new HashMap<>();
        try {
            String prompt = body.get("prompt");
            logger.info("/api/generate-image called with prompt: {}", prompt);
            String image = HuggingFaceClient.generateImage(prompt);
            result.put("image", image);
            logger.info("/api/generate-image response: image length {}", image != null ? image.length() : 0);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("/api/generate-image error: {}", e.getMessage(), e);
            result.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
        }
    }
}
