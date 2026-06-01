# FitMind AI

FitMind AI is a React + Vite application for managing daily routines, connecting to MongoDB, and using Gemini AI.

This project includes a React frontend and an Express backend using MongoDB and Gemini AI.

## Running the app

1. Install frontend dependencies:

```bash
npm install
```

2. Install backend dependencies:

```bash
npm run backend:install
```

3. Create `backend/.env` from `backend/.env.example` and set your MongoDB, JWT, and AI provider values. By default the backend uses Gemini (`AI_PROVIDER=gemini`) and can switch to OpenAI by setting `AI_PROVIDER=openai`.

4. Start the backend:

```bash
npm run backend:dev
```

5. Start the frontend:

```bash
npm run dev
```

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
