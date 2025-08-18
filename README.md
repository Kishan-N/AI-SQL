# AI-SQL

AI-SQL is a full-stack application that enables users to query databases using natural language via a chat-based interface. It features a Spring Boot backend and a React frontend.

## Project Structure

- `dbchatui-react/` — React frontend  
- `dbchatapi/` — Spring Boot backend

## Prerequisites

- Java 17 or higher  
- Maven  
- Node.js & npm
- Hugging face API Key
- Postgres DB

## Backend Setup (`dbchatapi`)

1. Navigate to the backend directory:  
   `cd dbchatapi`
2. Build the project:  
   `mvn clean install`
3. Run the backend:  
   `mvn spring-boot:run`  
   The backend will be available at `http://localhost:8080`.

## Frontend Setup (`dbchatui-react`)

1. Navigate to the frontend directory:  
   `cd dbchatui-react`
2. Install dependencies:  
   `npm install`
3. Start the frontend:  
   `npm start`  
   The app will run at `http://localhost:3000`.

## API

- **Endpoint:** `/api/query` (POST)
- **Request Body:** `{ "prompt": "..." }`
- **Response:** `{ "rowData": [[...]], "summary": "...", "query": "...", "error": "..." }`

## License

This project is licensed under the MIT License.
