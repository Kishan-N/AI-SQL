package com.horhge.sql.service;


import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;

public class HuggingFaceClient {
    private static final String API_URL = "https://router.huggingface.co/v1/chat/completions";
    private static final String API_TOKEN =  System.getenv("API_KEY");;

    public static String generateText(String prompt) throws IOException {
        URL url = new URL(API_URL);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", "Bearer " + API_TOKEN);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);

        String jsonInput = "{"
            + "\"messages\": ["
            + "    {\"role\": \"user\", \"content\": \"" + prompt.replace("\"", "\\\"") + "\"}"
            + "],"
            + "\"model\": \"openai/gpt-oss-120b:groq\","
            + "\"stream\": false"
            + "}";

        try (OutputStream os = conn.getOutputStream()) {
            byte[] input = jsonInput.getBytes("utf-8");
            os.write(input, 0, input.length);
        }

        int code = conn.getResponseCode();
        InputStream is = (code == 200) ? conn.getInputStream() : conn.getErrorStream();
        BufferedReader br = new BufferedReader(new InputStreamReader(is, "utf-8"));
        StringBuilder response = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            response.append(line.trim());
        }
        br.close();
        return response.toString();
    }
}
