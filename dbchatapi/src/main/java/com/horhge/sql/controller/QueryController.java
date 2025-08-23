package com.horhge.sql.controller;

import  com.horhge.sql.service.AiService;
import com.horhge.sql.service.HuggingFaceClient;
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

    @PostMapping("/query")
    public ResponseEntity<Map<String, Object>> query(@RequestBody Map<String, String> body) {
        String prompt = body.getOrDefault("prompt", "");
        logger.info("/api/query called with prompt: {}", prompt);
        Map<String, Object> response = aiService.queryAi(prompt);
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
