# DB Chat UI (React Frontend)

This is the React frontend for the AI-powered database chat UI.

---

## Features

- Ask questions in plain English about your database.
- AI generates SQL, executes it, and returns results.
- AI-generated summaries and insights in Markdown (tables, lists, etc.).
- Chart generation (bar, pie, line, etc.) for suitable data.
- Test Hugging Face and image generation APIs from the UI (Advanced toggle).
- Modern, polished, responsive design.

---

## Prerequisites

- Node.js 16+ and npm
- Backend API running (see `dbchatapi`)

---

## Setup

1. `Install dependencies:` npm install
2. `Start the app:` npm start  
The app runs on [http://localhost:3000](http://localhost:3000) and proxies API requests to the backend.

---

## Usage

- Enter a question (e.g., `Show total sales by region last month`) and submit.
- The app:
    1. Shows the generated SQL.
    2. Displays query results in a table.
    3. Renders a Markdown summary/insight.
    4. Shows a chart if enabled and applicable.
- Use the **Advanced** toggle in the navbar to test Hugging Face and image generation APIs.

---

## API Integration

- The frontend expects a backend API at `/api/query` (POST) with:
  ```json
  { "prompt": "your question", "enableChart": true }