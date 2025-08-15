# dbchatui-react

This is the React frontend for the database chat UI.

## Available Scripts

- `npm start` - Runs the app in development mode.
- `npm run build` - Builds the app for production.

## Setup

1. Install dependencies: `npm install`
2. Start the app: `npm start`

## API
- The frontend expects a backend API at `/api/query` (POST) with `{ "prompt": "..." }` and returns `{ "rowData": [[...]], "summary": "...", "query": "...", "error": "..." }`.
