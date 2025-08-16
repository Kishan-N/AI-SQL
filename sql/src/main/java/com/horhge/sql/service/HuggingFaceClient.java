package com.horhge.sql.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;

public class HuggingFaceClient {
    private static final String API_URL = "https://router.huggingface.co/v1/chat/completions";
    private static final String API_TOKEN = System.getenv("API_KEY");

    private static final ObjectMapper mapper = new ObjectMapper();

    public static String generateText(String prompt) throws IOException {
        URL url = new URL(API_URL);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", "Bearer " + API_TOKEN);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);

        // system instruction
        String systemTemplate = """
            You are an AI assistant that helps with SQL databases.
            Always respond in JSON with the following keys:
            Summary, SQL, Explanation, Data
            """;

        // build request payload safely (no string concat)
        Map<String, Object> systemMsg = Map.of("role", "system", "content", systemTemplate);
        Map<String, Object> userMsg = Map.of("role", "user", "content", prompt);

        Map<String, Object> payload = new HashMap<>();
        payload.put("messages", List.of(systemMsg, userMsg));
        payload.put("model", "openai/gpt-oss-120b:groq");
        payload.put("stream", false);

        String jsonInput = mapper.writeValueAsString(payload);

        // send request
        try (OutputStream os = conn.getOutputStream()) {
            os.write(jsonInput.getBytes("utf-8"));
        }

        // read response
        int code = conn.getResponseCode();
        InputStream is = (code == 200) ? conn.getInputStream() : conn.getErrorStream();

        try (BufferedReader br = new BufferedReader(new InputStreamReader(is, "utf-8"))) {
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) {
                response.append(line);
            }
            return response.toString();
        }
    }
}
