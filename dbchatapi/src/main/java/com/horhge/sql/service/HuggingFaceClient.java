package com.horhge.sql.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class HuggingFaceClient {
    private static final Logger logger = LoggerFactory.getLogger(HuggingFaceClient.class);
    private static final String API_URL = "https://router.huggingface.co/v1/chat/completions";
    //private static final String API_URL = "http://localhost:11434/api/chat"; // Local Ollama Server
    private static final String API_TOKEN = System.getenv("API_KEY");
    private static final ObjectMapper mapper = new ObjectMapper();

    public static String generateText(String prompt) throws IOException {
        logger.info("Sending prompt to AI service");
        URL url = new URL(API_URL);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", "Bearer " + API_TOKEN); // Comment In case of using local
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);

        // system instruction
        String systemTemplate = """
            You are an AI assistant that helps with SQL databases.
            Always respond in JSON with the following keys:
            Summary, SQL, Explanation, Data, ChartType
            Generate SQL only if possible if not just keep the filed empty.
            Always prefix table names with the schema name (e.g., schema.table) while generating the SQL.
            ChartType should be one of: bar, pie, line, scatter, histogram, or leave blank if not applicable.
            If the data is suitable for a chart, suggest the most appropriate chart type.
            Do not enter anything else after the JSON.
            """;

        // build request payload safely (no string concat)
        Map<String, Object> systemMsg = Map.of("role", "system", "content", systemTemplate);
        Map<String, Object> userMsg = Map.of("role", "user", "content", prompt);

        Map<String, Object> payload = new HashMap<>();
        payload.put("messages", List.of(systemMsg, userMsg));
        payload.put("model", "openai/gpt-oss-120b:groq");
        //payload.put("model", "hf.co/bartowski/Qwen2.5-3B-Instruct-GGUF:Q4_K_M"); // Local Ollama Server
        payload.put("stream", false);

        String jsonInput = mapper.writeValueAsString(payload);
        logger.debug("Request payload: {}", jsonInput);

        // send request
        try (OutputStream os = conn.getOutputStream()) {
            os.write(jsonInput.getBytes("utf-8"));
        }

        // read response
        int code = conn.getResponseCode();
        logger.debug("Response code: {}", code);
        InputStream is = (code == 200) ? conn.getInputStream() : conn.getErrorStream();

        StringBuilder response = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(is, "utf-8"))) {
            String line;
            while ((line = br.readLine()) != null) {
                response.append(line);
            }
            return response.toString();
        } catch (Exception e) {
            logger.error("Error reading API response: {}", e.getMessage());
            throw new IOException("Error reading API response: " + e.getMessage(), e);
        }
    }

    // Add this method for image generation
    public static String generateImage(String prompt) throws IOException {
        logger.info("Sending image generation prompt: {}", prompt);
        String IMAGE_API_URL = "https://router.huggingface.co/nebius/v1/images/generations";
        String model = "sd-legacy/stable-diffusion-v1-5";

        URL url = new URL(IMAGE_API_URL);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", "Bearer " + API_TOKEN);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);

        // Build payload
        String payload = String.format(
                "{\"response_format\":\"b64_json\",\"prompt\":%s,\"model\":\"%s\"}",
                mapper.writeValueAsString(prompt), model
        );
        logger.debug("Image request payload: {}", payload);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(payload.getBytes("utf-8"));
        }

        int code = conn.getResponseCode();
        logger.debug("Image response code: {}", code);
        InputStream is = (code == 200) ? conn.getInputStream() : conn.getErrorStream();

        // Read response as string
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, "utf-8"))) {
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
        }
        String responseStr = sb.toString();

        if (responseStr.isEmpty()) {
            throw new IOException("Empty response from image generation API");
        }

        // Parse JSON and extract base64 image
        JsonNode node = mapper.readTree(responseStr);
        // The API returns: { "data": [ { "b64_json": "..." } ] }
        if (node.has("data") && node.get("data").isArray() && node.get("data").size() > 0) {
            JsonNode imgNode = node.get("data").get(0);
            if (imgNode.has("b64_json")) {
                logger.info("Image base64 string extracted from response");
                return imgNode.get("b64_json").asText();
            }
        }
        // If error message present, propagate it
        if (node.has("error")) {
            String errMsg = node.get("error").asText();
            logger.warn("Image API error: {}", errMsg);
            throw new IOException(errMsg);
        }
        logger.warn("No image found in response");
        throw new IOException("No image found in response");
    }
}
