package com.horhge.sql.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AiService {
    @Value("${ai.endpoint.url}")
    private String aiEndpointUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public Map<String, Object> queryAi(String prompt) {
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
            result.put("summary", content);

            // Try to extract SQL code block from the content
            String sql = extractSqlFromMarkdown(content);
            if (sql != null && !sql.isEmpty()) {
                result.put("query", sql);
                // Execute the SQL and fetch results (with headers)
                List<List<Object>> rowData = executeSqlQuery(sql);
                result.put("rowData", rowData);
            }
        } catch (Exception e) {
            result.put("error", e.getMessage());
        }
        return result;
    }

    // Extracts the first SQL code block from markdown text
    private String extractSqlFromMarkdown(String text) {
        Pattern pattern = Pattern.compile("```sql\\s*([\\s\\S]*?)```", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        return null;
    }

    // Dummy implementation: Replace with your actual DB query logic
    private List<List<Object>> executeSqlQuery(String sql) {
        List<List<Object>> rows = new ArrayList<>();
        try {
            jdbcTemplate.query(sql, rs -> {
                int columnCount = rs.getMetaData().getColumnCount();
                // Add headers as the first row
                if (rows.isEmpty()) {
                    List<Object> headers = new ArrayList<>();
                    for (int i = 1; i <= columnCount; i++) {
                        headers.add(rs.getMetaData().getColumnLabel(i));
                    }
                    rows.add(headers);
                }
                List<Object> row = new ArrayList<>();
                for (int i = 1; i <= columnCount; i++) {
                    row.add(rs.getObject(i));
                }
                rows.add(row);
            });
        } catch (Exception e) {
            // Optionally, handle or log the exception
        }
        return rows;
    }
}
