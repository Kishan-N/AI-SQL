# AI Database Chat UI

A full-stack application for natural language querying of SQL databases, with AI-generated summaries, insights, and charting.  
**Tech stack:** Java (Spring Boot), React, PostgreSQL, Hugging Face Inference API.

---

## Features

- **Ask questions in plain English** about your database.
- **AI generates SQL**, executes it, and returns results.
- **AI-generated summaries and insights** in Markdown (tables, lists, etc.).
- **Chart generation** (bar, pie, line, etc.) for suitable data.
- **Prevents execution of CREATE, INSERT, UPDATE commands** for safety.
- **Test Hugging Face and image generation APIs** from the UI.
- **Modern, polished frontend** with responsive design.

---

## Prerequisites

- Java 17+
- Node.js 16+ and npm
- PostgreSQL database (or compatible JDBC DB)
- Hugging Face API key (set as `API_KEY` environment variable)

---

## Backend Setup (`dbchatapi`)

1. **Configure database:**
   - Set your DB connection in `application.properties` (Spring Boot standard).
2. **Set Hugging Face API key:**
   - Export your key:  
     `set API_KEY=your_hf_token` (Windows)  
     `export API_KEY=your_hf_token` (Linux/Mac)
3. **Build and run:**
   - `cd dbchatapi`
   - `mvn clean package`
   - `java -jar target/dbchatui-java-0.0.1-SNAPSHOT.jar`
   - App runs on `http://localhost:8080`

---

## Frontend Setup (`dbchatui-react`)

1. `cd dbchatui-react`
2. `npm install`
3. `npm start`
   - Runs on `http://localhost:3000`
   - Proxies API requests to backend

---

## Usage

- Enter a question (e.g., `Show total sales by region last month`) and submit.
- The app:
   1. Shows the generated SQL.
   2. Displays query results in a table.
   3. Renders a Markdown summary/insight.
   4. Shows a chart if enabled and applicable.
- Use the **Advanced** toggle for testing Hugging Face and image APIs.

---

## Security

- Only `SELECT` queries are allowed.  
  `CREATE`, `INSERT`, and `UPDATE` commands are blocked at the backend for safety.

---

## Customization

- **Database:**  
  Edit DB config in `application.properties`.
- **AI prompt/system message:**  
  See `HuggingFaceClient.java` for the system prompt template.
- **Charting:**  
  Uses JFreeChart; see `ChartGenerator.java` for chart logic.

---

## Project Structure

- `dbchatapi/` — Spring Boot backend (Java)
- `dbchatui-react/` — React frontend (JavaScript)
- `dbchatapi/src/main/java/com/horhge/sql/service/HuggingFaceClient.java` — Hugging Face API integration
- `dbchatapi/src/main/java/com/horhge/sql/service/AiService.java` — Main AI logic and SQL execution
- `dbchatapi/src/main/java/com/horhge/sql/service/ChartGenerator.java` — Chart image generation

---

## License

MIT (or your preferred license)