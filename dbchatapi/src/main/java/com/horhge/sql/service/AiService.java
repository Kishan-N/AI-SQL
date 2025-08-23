package com.horhge.sql.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.*;

@Service
public class AiService {
    @Value("${ai.endpoint.url}")
    private String aiEndpointUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final ObjectMapper mapper = new ObjectMapper();

    public Map<String, Object> queryAi(String prompt) {
        Map<String, Object> result = new HashMap<>();
        try {
            // Build schema-aware prompt
            String schemaInfo = getDatabaseSchema();
            String fullPrompt = "Database schema:\n" + schemaInfo + "\n\nUser question: " + prompt;

            // 1st AI call: generate SQL
            String hfResponse = HuggingFaceClient.generateText(fullPrompt);
            JsonNode root = mapper.readTree(hfResponse);
            String aiContent = extractContent(root);
            result.put("aiResponse", aiContent); // keep original AI response for reference

            // Extract SQL code
            String sql = extractSqlFromMarkdown(aiContent);
            if (sql != null && !sql.isEmpty()) {
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

                String insightsResponse = HuggingFaceClient.generateText(insightsPrompt);
                JsonNode insightsRoot = mapper.readTree(insightsResponse);
                String insightsContent = extractContent(insightsRoot);
                result.put("summary", insightsContent);

                // 3rd AI call: generate chart image if data exists
                if (rowData.size() > 1) {
                    String chartType = extractChartTypeFromPrompt(prompt);
                    String chartPrompt = "Given the following data in JSON, generate a " +
                        (chartType.isEmpty() ? "chart" : chartType) +
                        " that best visualizes the data for a presentation. " +
                        "Return a base64-encoded PNG image. Data: " + dataJson;

                    String chartResponse = HuggingFaceClient.generateImage(chartPrompt);
                    // Assume generateImage returns a base64 string or a JSON with { "image": "..." }
                    String chartImage = extractImageFromResponse(chartResponse);
                    result.put("chartImage", chartImage);
                }
            } else {
                // If no SQL, just return the original AI response as summary
                result.put("summary", aiContent);
            }
        } catch (Exception e) {
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

    // Execute query with headers
    private List<List<Object>> executeSqlQuery(String sql) {
        List<List<Object>> rows = new ArrayList<>();
        try {
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
        } catch (Exception e) {
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
        } catch (Exception ignore) {}
        return "";
    }
}
