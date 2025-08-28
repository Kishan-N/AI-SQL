package com.horhge.sql.service;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class AiService {
    private static final Logger logger = LoggerFactory.getLogger(AiService.class);

    @Autowired(required = false)
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ConnectionManager connectionManager;

    private final ObjectMapper mapper = new ObjectMapper();

    public Map<String, Object> queryAiTest(String prompt, boolean enableChart, Map<String, Object> dbConfig) {
        Map<String, Object> result = new HashMap<>();
        DriverManagerDataSource ds = null;
        JdbcTemplate dynamicJdbc = null;
        try {
            logger.info("Received prompt: {} (enableChart={})", prompt, enableChart);
            if (dbConfig == null) {
                result.put("error", "Database configuration is missing.");
                return result;
            }
            // Build JDBC URL based on dbConfig.type
            String type = (String) dbConfig.getOrDefault("type", "mysql");
            String host = (String) dbConfig.getOrDefault("host", "localhost");
            String port = (String) dbConfig.getOrDefault("port", "3306");
            String database = (String) dbConfig.getOrDefault("database", "");
            String username = (String) dbConfig.getOrDefault("username", "");
            String encryptedKey = (String) dbConfig.getOrDefault("encryptedKey", "");
            String url = "";
            String driverClass = "";
            switch (type) {
                case "mysql":
                    url = "jdbc:mysql://" + host + ":" + port + "/" + database + "?useSSL=false&serverTimezone=UTC";
                    driverClass = "com.mysql.cj.jdbc.Driver";
                    break;
                case "postgresql":
                    url = "jdbc:postgresql://" + host + ":" + port + "/" + database;
                    driverClass = "org.postgresql.Driver";
                    break;
                case "mssql":
                    url = "jdbc:sqlserver://" + host + ":" + port + ";databaseName=" + database;
                    driverClass = "com.microsoft.sqlserver.jdbc.SQLServerDriver";
                    break;
                case "oracle":
                    url = "jdbc:oracle:thin:@" + host + ":" + port + ":" + database;
                    driverClass = "oracle.jdbc.driver.OracleDriver";
                    break;
                default:
                    result.put("error", "Unsupported database type: " + type);
                    return result;
            }
            ds = new DriverManagerDataSource();
            ds.setDriverClassName(driverClass);
            ds.setUrl(url);
            ds.setUsername(username);
            ds.setPassword(encryptedKey);
            dynamicJdbc = new JdbcTemplate(ds);
            // Use dynamicJdbc for all DB operations below
            String schemaInfo = getDatabaseSchema(dynamicJdbc);
            String fullPrompt = "Database schema:\n" + schemaInfo + "\n\nUser question: " + prompt;
            return result;
        } catch (Exception ex) {
            logger.error("Error creating dynamic DB connection: {}", ex.getMessage(), ex);
            result.put("error", "Failed to connect to database: " + ex.getMessage());
            return result;
        }
    }

    public Map<String, Object> queryAi(String prompt, boolean enableChart, Map<String, Object> dbConfig) {
        Map<String, Object> result = new HashMap<>();
        JdbcTemplate jdbc = null;
        boolean usedFallback = false;
        try {
            logger.info("Received prompt: {} (enableChart={})", prompt, enableChart);
            if (dbConfig != null) {
                // Build JDBC URL based on dbConfig.type
                String type = (String) dbConfig.getOrDefault("type", "mysql");
                String host = (String) dbConfig.getOrDefault("host", "localhost");
                String port = (String) dbConfig.getOrDefault("port", "3306");
                String database = (String) dbConfig.getOrDefault("database", "");
                String username = (String) dbConfig.getOrDefault("username", "");
                String encryptedKey = (String) dbConfig.getOrDefault("encryptedKey", "");
                String url = "";
                String driverClass = "";
                switch (type) {
                    case "mysql":
                        url = "jdbc:mysql://" + host + ":" + port + "/" + database + "?useSSL=false&serverTimezone=UTC";
                        driverClass = "com.mysql.cj.jdbc.Driver";
                        break;
                    case "postgresql":
                        url = "jdbc:postgresql://" + host + ":" + port + "/" + database;
                        driverClass = "org.postgresql.Driver";
                        break;
                    case "mssql":
                        url = "jdbc:sqlserver://" + host + ":" + port + ";databaseName=" + database;
                        driverClass = "com.microsoft.sqlserver.jdbc.SQLServerDriver";
                        break;
                    case "oracle":
                        url = "jdbc:oracle:thin:@" + host + ":" + port + ":" + database;
                        driverClass = "oracle.jdbc.driver.OracleDriver";
                        break;
                    default:
                        result.put("error", "Unsupported database type: " + type);
                        return result;
                }
                DriverManagerDataSource ds = new DriverManagerDataSource();
                ds.setDriverClassName(driverClass);
                ds.setUrl(url);
                ds.setUsername(username);
                ds.setPassword(encryptedKey);
                jdbc = new JdbcTemplate(ds);
                logger.info("Using dynamic DB connection for queryAi.");
            } else {
                jdbc = this.jdbcTemplate;
                usedFallback = true;
                logger.warn("No dbConfig provided, using fallback DataSource for queryAi.");
            }
            // Build schema-aware prompt
            String schemaInfo = getDatabaseSchema(jdbc);
            String fullPrompt = "Database schema:\n" + schemaInfo + "\n\nUser question: " + prompt;
            // 1st AI call: generate SQL
            logger.debug("Sending prompt to HuggingFace for SQL generation");
            String hfResponse = HuggingFaceClient.generateText(fullPrompt);

            // Check for API error in the response JSON
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
                List<List<Object>> rowData = executeSqlQueryWithJdbc(sql, jdbc);
                result.put("rowData", rowData);

                // Build JSON array of results for insights
                String dataJson = buildJsonFromRowData(rowData);

                // 2nd AI call: ask for summary/insights based on data
                String insightsPrompt = "Given the following SQL result data and the original question, provide a concise summary or insights in markdown format.\n"
                        + "Original question: " + prompt + "\n"
                        + "Data: " + dataJson;

                logger.debug("Sending data to HuggingFace for summary/insights");
                String insightsResponse = HuggingFaceClient.generateText(insightsPrompt);

                // Check for API error in the insights response
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
                    String chartType = (aiChartType != null && !aiChartType.isBlank()) ?
                                      aiChartType : extractChartTypeFromPrompt(prompt);
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
        if (usedFallback) {
            result.put("warning", "No database configuration provided. Used fallback DataSource.");
        }
        return result;
    }

    // New secure queryAi method that uses connection ID
    public Map<String, Object> queryAi(String prompt, boolean enableChart, String connectionId) {
        Map<String, Object> result = new HashMap<>();
        JdbcTemplate jdbc = null;

        try {
            logger.info("Received prompt: {} (enableChart={}, connectionId={})", prompt, enableChart, connectionId);

            if (connectionId != null && !connectionId.isEmpty()) {
                // Use secure connection by ID
                jdbc = connectionManager.getConnection(connectionId);
                if (jdbc == null) {
                    result.put("error", "Invalid or expired connection ID. Please reconnect to the database.");
                    return result;
                }
                logger.info("Using secure connection ID: {}", connectionId);
            } else {
                // Check if fallback connection is available
                if (this.jdbcTemplate != null) {
                    jdbc = this.jdbcTemplate;
                    logger.warn("No connectionId provided, using fallback DataSource for queryAi.");
                    result.put("warning", "No database connection provided. Used fallback DataSource.");
                } else {
                    result.put("error", "No database connection available. Please configure a database connection first.");
                    return result;
                }
            }

            // Build schema-aware prompt
            String schemaInfo = getDatabaseSchema(jdbc);
            String fullPrompt = "Database schema:\n" + schemaInfo + "\n\nUser question: " + prompt;

            // 1st AI call: generate SQL
            logger.debug("Sending prompt to HuggingFace for SQL generation");
            String hfResponse = HuggingFaceClient.generateText(fullPrompt);

            // Check for API error in the response JSON
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
            result.put("aiResponse", aiContent);

            // Extract SQL code
            String sql = extractSqlFromMarkdown(aiContent);
            if (sql != null && !sql.isEmpty()) {
                logger.info("Extracted SQL");
                result.put("query", sql);

                // Execute query and fetch results
                List<List<Object>> rowData = executeSqlQueryWithJdbc(sql, jdbc);
                result.put("rowData", rowData);

                // Build JSON array of results for insights
                String dataJson = buildJsonFromRowData(rowData);

                // 2nd AI call: ask for summary/insights based on data
                String insightsPrompt = "Given the following SQL result data and the original question, provide a concise summary or insights in markdown format.\n"
                        + "Original question: " + prompt + "\n"
                        + "Data: " + dataJson;

                logger.debug("Sending data to HuggingFace for summary/insights");
                String insightsResponse = HuggingFaceClient.generateText(insightsPrompt);

                // Check for API error in the insights response
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
                    String chartType = (aiChartType != null && !aiChartType.isBlank()) ?
                                      aiChartType : extractChartTypeFromPrompt(prompt);
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
                result.put("summary", aiContent);
            }
        } catch (IOException e) {
            logger.error("Error in queryAi: {}", e.getMessage(), e);
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
            JsonNode node = mapper.readTree(text);
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

        // Security check - only allow SELECT queries
        if (trimmed.startsWith("create") || trimmed.startsWith("insert") ||
            trimmed.startsWith("update") || trimmed.startsWith("delete") ||
            trimmed.startsWith("drop") || trimmed.startsWith("alter")) {
            logger.warn("Blocked forbidden SQL command: {}", sql);
            rows.add(List.of("SQL Error: Only SELECT queries are allowed for security reasons."));
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

    // Execute query with headers using a specific JdbcTemplate
    private List<List<Object>> executeSqlQueryWithJdbc(String sql, JdbcTemplate jdbc) {
        List<List<Object>> rows = new ArrayList<>();
        String trimmed = sql.trim().toLowerCase(Locale.ROOT);
        // Security check - only allow SELECT queries
        if (trimmed.startsWith("create") || trimmed.startsWith("insert") ||
            trimmed.startsWith("update") || trimmed.startsWith("delete") ||
            trimmed.startsWith("drop") || trimmed.startsWith("alter")) {
            logger.warn("Blocked forbidden SQL command: {}", sql);
            rows.add(List.of("SQL Error: Only SELECT queries are allowed for security reasons."));
            return rows;
        }
        try {
            logger.debug("Executing SQL query: {}", sql);
            jdbc.query(sql, rs -> {
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
            for (int j = 0; j < Math.min(headers.size(), rowData.get(i).size()); j++) {
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

    // Overload getDatabaseSchema to accept JdbcTemplate
    private String getDatabaseSchema(JdbcTemplate jdbc) {
        StringBuilder schema = new StringBuilder();
        try (var conn = jdbc.getDataSource().getConnection()) {
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

    // Extracts assistant response text from AI response
    private String extractContent(JsonNode root) {
        if (root.has("choices") && root.get("choices").isArray() && root.get("choices").size() > 0) {
            JsonNode choice = root.get("choices").get(0);
            if (choice.has("message") && choice.get("message").has("content")) {
                return choice.get("message").get("content").asText();
            } else if (choice.has("text")) {
                return choice.get("text").asText();
            }
        }

        // Handle Ollama response format
        if (root.has("message") && root.get("message").has("content")) {
            return root.get("message").get("content").asText();
        }

        if (root.has("content")) {
            return root.get("content").asText();
        }

        return "";
    }

    // Extract chart type from prompt if user suggests one
    private String extractChartTypeFromPrompt(String prompt) {
        String lower = prompt.toLowerCase();
        if (lower.contains("bar chart")) return "bar";
        if (lower.contains("pie chart")) return "pie";
        if (lower.contains("line chart")) return "line";
        if (lower.contains("scatter plot")) return "scatter";
        if (lower.contains("histogram")) return "histogram";
        return "bar"; // Default chart type
    }

    // Test database connection with provided configuration
    public boolean testDatabaseConnection(Map<String, Object> dbConfig) {
        if (dbConfig == null) {
            logger.warn("Database config is null for connection test");
            return false;
        }

        String type = (String) dbConfig.getOrDefault("type", "mysql");
        String host = (String) dbConfig.getOrDefault("host", "localhost");
        String port = (String) dbConfig.getOrDefault("port", "3306");
        String database = (String) dbConfig.getOrDefault("database", "");
        String username = (String) dbConfig.getOrDefault("username", "");
        String encryptedKey = (String) dbConfig.getOrDefault("encryptedKey", "");
        if (host.isEmpty() || database.isEmpty() || username.isEmpty()) {
            logger.warn("Missing required connection parameters for test");
            return false;
        }

        String url = "";
        String driverClass = "";

        try {
            switch (type) {
                case "mysql":
                    url = "jdbc:mysql://" + host + ":" + port + "/" + database + "?useSSL=false&serverTimezone=UTC";
                    driverClass = "com.mysql.cj.jdbc.Driver";
                    break;
                case "postgresql":
                    url = "jdbc:postgresql://" + host + ":" + port + "/" + database;
                    driverClass = "org.postgresql.Driver";
                    break;
                case "mssql":
                    url = "jdbc:sqlserver://" + host + ":" + port + ";databaseName=" + database;
                    driverClass = "com.microsoft.sqlserver.jdbc.SQLServerDriver";
                    break;
                case "oracle":
                    url = "jdbc:oracle:thin:@" + host + ":" + port + ":" + database;
                    driverClass = "oracle.jdbc.driver.OracleDriver";
                    break;
                default:
                    logger.error("Unsupported database type for connection test: {}", type);
                    return false;
            }

            logger.info("Testing connection to: {} with user: {}", url, username);

            DriverManagerDataSource testDataSource = new DriverManagerDataSource();
            testDataSource.setDriverClassName(driverClass);
            testDataSource.setUrl(url);
            testDataSource.setUsername(username);
            testDataSource.setPassword(encryptedKey);

            JdbcTemplate testJdbc = new JdbcTemplate(testDataSource);

            // Try a simple query to test the connection
            testJdbc.queryForObject("SELECT 1", Integer.class);

            logger.info("Database connection test successful");
            return true;

        } catch (Exception e) {
            logger.error("Database connection test failed: {}", e.getMessage(), e);
            return false;
        }
    }
}
