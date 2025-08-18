package com.horhge.sql.controller;

import  com.horhge.sql.service.AiService;
import com.horhge.sql.service.HuggingFaceClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import org.springframework.http.ResponseEntity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api")
public class QueryController {
    @Autowired
    private AiService aiService;

    @PostMapping("/query")
    public ResponseEntity<Map<String, Object>> query(@RequestBody Map<String, String> body) {
        String prompt = body.getOrDefault("prompt", "");
        Map<String, Object> response = aiService.queryAi(prompt);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/huggingface")
    public ResponseEntity<Map<String, Object>> huggingFace(@RequestBody Map<String, String> body) {
        String prompt = body.getOrDefault("prompt", "");
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
        } catch (Exception e) {
            result.put("error", e.getMessage());
        }
        return ResponseEntity.ok(result);
    }
}
