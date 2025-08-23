package com.horhge.sql.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class AiService {
    private static final Logger logger = LoggerFactory.getLogger(AiService.class);

    @Value("${ai.endpoint.url}")
    private String aiEndpointUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final ObjectMapper mapper = new ObjectMapper();

    public Map<String, Object> queryAi(String prompt, boolean enableChart) {
        Map<String, Object> result = new HashMap<>();
        try {
            logger.info("Received prompt: {} (enableChart={})", prompt, enableChart);
            // Build schema-aware prompt
            String schemaInfo = getDatabaseSchema();
            String fullPrompt = "Database schema:\n" + schemaInfo + "\n\nUser question: " + prompt;

            // 1st AI call: generate SQL
            logger.debug("Sending prompt to HuggingFace for SQL generation");
            String hfResponse = HuggingFaceClient.generateText(fullPrompt);
            logger.debug("HuggingFace SQL response: {}", hfResponse);

            // Check for Hugging Face API error in the response JSON
            try {
                JsonNode errorCheck = mapper.readTree(hfResponse);
                if (errorCheck.has("error")) {
                    String errMsg = errorCheck.get("error").asText();
                    logger.error("Hugging Face API error: {}", errMsg);
                    result.put("error", errMsg);
                    return result;
                }
            } catch (Exception e) {
                logger.warn("Could not parse Hugging Face response for error: {}", e.getMessage());
            }

            JsonNode root = mapper.readTree(hfResponse);
            String aiContent = extractContent(root);
            result.put("aiResponse", aiContent); // keep original AI response for reference

            // Extract SQL code
            String sql = extractSqlFromMarkdown(aiContent);
            if (sql != null && !sql.isEmpty()) {
                logger.info("Extracted SQL");
                result.put("query", sql);

                // Execute query and fetch results
                List<List<Object>> rowData = executeSqlQuery(sql);
                result.put("rowData", rowData);

                // Build JSON array of results for insights
                String dataJson = buildJsonFromRowData(rowData);

                // 2nd AI call: ask for summary/insights based on data
                String insightsPrompt = "Given the following SQL result data and the original question, provide a concise summary or insights in markdown format.\n"
                        + "Original question: " + prompt + "\n"
                        + "Data: " + dataJson;

                logger.debug("Sending data to HuggingFace for summary/insights");
                String insightsResponse = HuggingFaceClient.generateText(insightsPrompt);
                logger.debug("HuggingFace summary response: {}", insightsResponse);

                // Check for Hugging Face API error in the insights response
                try {
                    JsonNode errorCheck = mapper.readTree(insightsResponse);
                    if (errorCheck.has("error")) {
                        String errMsg = errorCheck.get("error").asText();
                        logger.error("Hugging Face API error (insights): {}", errMsg);
                        result.put("error", errMsg);
                        return result;
                    }
                } catch (Exception e) {
                    logger.warn("Could not parse Hugging Face insights response for error: {}", e.getMessage());
                }

                JsonNode insightsRoot = mapper.readTree(insightsResponse);
                String insightsContent = extractContent(insightsRoot);
                result.put("summary", insightsContent);

                // Try to extract ChartType from the AI's JSON response
                String aiChartType = null;
                try {
                    // Try to parse the summary as JSON and extract ChartType
                    JsonNode summaryJson = null;
                    try { summaryJson = mapper.readTree(insightsContent); } catch (Exception ignore) {}
                    if (summaryJson != null && summaryJson.has("ChartType")) {
                        aiChartType = summaryJson.get("ChartType").asText();
                        logger.info("AI suggested chart type: {}", aiChartType);
                    }
                } catch (Exception e) {
                    logger.warn("Could not extract ChartType from AI summary: {}", e.getMessage());
                }

                // 3rd: generate chart image if data exists and charting is enabled
                if (enableChart && rowData.size() > 1) {
                    String chartType = (aiChartType != null && !aiChartType.isBlank()) ? aiChartType : extractChartTypeFromPrompt(prompt);
                    try {
                        String chartImage = ChartGenerator.generateChart(rowData, chartType);
                        logger.info("Chart generated using JFreeChart, type: {}", chartType);
                        result.put("chartImage", chartImage);
                    } catch (Exception e) {
                        logger.error("Error generating chart image: {}", e.getMessage(), e);
                        result.put("chartImageError", e.getMessage());
                    }
                }
            } else {
                logger.warn("No SQL extracted from AI content. Returning AI content as summary.");
                // If no SQL, just return the original AI response as summary
                result.put("summary", aiContent);
            }
        } catch (IOException e) {
            logger.error("Error in queryAi: {}", e.getMessage(), e);
            // Propagate Hugging Face API error to frontend
            result.put("error", e.getMessage());
        } catch (Exception e) {
            logger.error("Error in queryAi: {}", e.getMessage(), e);
            result.put("error", e.getMessage());
        }
        return result;
    }

    // Extract SQL from JSON or markdown text
    private String extractSqlFromMarkdown(String text) {
        // Try to parse as JSON and extract "SQL" field
        try {
            ObjectMapper om = new ObjectMapper();
            JsonNode node = om.readTree(text);
            if (node.has("SQL")) {
                return node.get("SQL").asText();
            }
        } catch (Exception ignore) {
            // Not JSON, fall through to markdown extraction
        }
        // Try to match ```sql ... ```
        var patternSql = java.util.regex.Pattern.compile("```\\s*sql\\s*([\\s\\S]*?)```", java.util.regex.Pattern.CASE_INSENSITIVE);
        var matcherSql = patternSql.matcher(text);
        if (matcherSql.find()) {
            return matcherSql.group(1).trim();
        }
        // Fallback: match any triple-backtick code block
        var patternAny = java.util.regex.Pattern.compile("```([\\s\\S]*?)```");
        var matcherAny = patternAny.matcher(text);
        if (matcherAny.find()) {
            return matcherAny.group(1).trim();
        }
        return null;
    }

    // Extract SQL from JSON or markdown text
    private String extractSqlFromMarkdownLocal(String text) {
        // Try to parse as JSON and extract "SQL" field
        try {
            ObjectMapper om = new ObjectMapper();
            JsonNode node = om.readTree(text);
            if (node.has("SQL")) {
                return node.get("SQL").asText();
            }
        } catch (Exception ignore) {
            // Not JSON, fall through to markdown extraction
        }
        var patternJson = java.util.regex.Pattern.compile("```\\s*json\\s*([\\s\\S]*?)```", java.util.regex.Pattern.CASE_INSENSITIVE);
        var matcherJson = patternJson.matcher(text);
        if (matcherJson.find()) {
            String jsonBlock = matcherJson.group(1).trim();
            try {
                ObjectMapper om = new ObjectMapper();
                JsonNode node = om.readTree(jsonBlock);
                if (node.has("SQL")) {
                    return node.get("SQL").asText();
                }
            } catch (Exception ignore) {}
        }
        // Try to match ```sql ... ```
        var patternSql = java.util.regex.Pattern.compile("```\\s*sql\\s*([\\s\\S]*?)```", java.util.regex.Pattern.CASE_INSENSITIVE);
        var matcherSql = patternSql.matcher(text);
        if (matcherSql.find()) {
            return matcherSql.group(1).trim();
        }
        // Fallback: match any triple-backtick code block
        var patternAny = java.util.regex.Pattern.compile("```([\\s\\S]*?)```");
        var matcherAny = patternAny.matcher(text);
        if (matcherAny.find()) {
            return matcherAny.group(1).trim();
        }
        return null;
    }


    // Execute query with headers
    private List<List<Object>> executeSqlQuery(String sql) {
        List<List<Object>> rows = new ArrayList<>();
        String trimmed = sql.trim().toLowerCase(Locale.ROOT);
        if (trimmed.startsWith("create") || trimmed.startsWith("insert") || trimmed.startsWith("update")) {
            logger.warn("Blocked forbidden SQL command: {}", sql);
            rows.add(List.of("SQL Error: Only SELECT queries are allowed. CREATE, INSERT, and UPDATE are not permitted."));
            return rows;
        }
        try {
            logger.debug("Executing SQL query: {}", sql);
            jdbcTemplate.query(sql, rs -> {
                int columnCount = rs.getMetaData().getColumnCount();
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
            logger.error("SQL execution error: {}", e.getMessage(), e);
            rows.add(List.of("SQL Error: " + e.getMessage()));
        }
        return rows;
    }

    // Convert query result into JSON string
    private String buildJsonFromRowData(List<List<Object>> rowData) throws Exception {
        if (rowData.isEmpty()) return "[]";
        List<Object> headers = rowData.get(0);
        List<Map<String, Object>> jsonRows = new ArrayList<>();
        for (int i = 1; i < rowData.size(); i++) {
            Map<String, Object> rowObj = new LinkedHashMap<>();
            for (int j = 0; j < headers.size(); j++) {
                rowObj.put(headers.get(j).toString(), rowData.get(i).get(j));
            }
            jsonRows.add(rowObj);
        }
        return mapper.writeValueAsString(jsonRows);
    }

    // Read DB schema
    private String getDatabaseSchema() {
        StringBuilder schema = new StringBuilder();
        try (var conn = jdbcTemplate.getDataSource().getConnection()) {
            var meta = conn.getMetaData();
            var tables = meta.getTables(null, null, "%", new String[]{"TABLE"});
            while (tables.next()) {
                String schemaName = tables.getString("TABLE_SCHEM");
                String tableName = tables.getString("TABLE_NAME");
                schema.append("Schema: ").append(schemaName)
                      .append(" | Table: ").append(tableName).append("\n");
                var columns = meta.getColumns(null, schemaName, tableName, "%");
                while (columns.next()) {
                    String colName = columns.getString("COLUMN_NAME");
                    String colType = columns.getString("TYPE_NAME");
                    schema.append("  - ").append(colName).append(" (").append(colType).append(")\n");
                }
            }
            tables.close();
            logger.debug("Database schema read successfully");
        } catch (Exception e) {
            logger.error("Could not read schema: {}", e.getMessage(), e);
            schema.append("Could not read schema: ").append(e.getMessage());
        }
        return schema.toString();
    }

    // Extracts assistant response text (supports both message.content and text)
    private String extractContent(JsonNode root) {
        if (root.has("choices") && root.get("choices").isArray() && root.get("choices").size() > 0) {
            JsonNode choice = root.get("choices").get(0);
            if (choice.has("message") && choice.get("message").has("content")) {
                return choice.get("message").get("content").asText();
            } else if (choice.has("text")) {
                return choice.get("text").asText();
            }
        }
        return "";
    }

    private String extractContentLocal(JsonNode root) {
        if (root.has("message") && root.get("message").has("content")) {
            return root.get("message").get("content").asText();
        }
        if (root.has("content")) {
            return root.get("content").asText();
        }
        if (root.has("choices") && root.get("choices").isArray() && root.get("choices").size() > 0) {
            JsonNode choice = root.get("choices").get(0);
            if (choice.has("message") && choice.get("message").has("content")) {
                return choice.get("message").get("content").asText();
            } else if (choice.has("text")) {
                return choice.get("text").asText();
            }
        }
        return "";
    }

    // Extract chart type from prompt if user suggests one
    private String extractChartTypeFromPrompt(String prompt) {
        String lower = prompt.toLowerCase();
        if (lower.contains("bar chart")) return "bar chart";
        if (lower.contains("pie chart")) return "pie chart";
        if (lower.contains("line chart")) return "line chart";
        if (lower.contains("scatter plot")) return "scatter plot";
        if (lower.contains("histogram")) return "histogram";
        // Add more as needed
        return "";
    }

    // Extract image from AI response (base64 or URL)
    private String extractImageFromResponse(String response) {
        try {
            JsonNode node = mapper.readTree(response);
            if (node.has("image")) {
                return node.get("image").asText();
            }
            // fallback: if response is just base64 string
            if (response.trim().startsWith("iVBOR")) return response.trim();
        } catch (Exception error) {logger.error(String.valueOf(error));}
        return "";
    }
}
