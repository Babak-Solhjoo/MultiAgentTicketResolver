Incident Triage + Resolution Ticketing System

Overview
Multi-agent ticketing system with Angular frontend, Node.js backend, LangChain integration, and MySQL storage. The system ingests raw reports, runs agent debate, and produces structured tickets with negotiation transcripts.

Quick start (local dev)
1) Ensure MySQL is running locally.
2) Create the database/user (see db/setup-local.sql) or run db/init.sql manually.
3) Copy backend/.env.example to backend/.env and confirm credentials.
4) Start the backend and frontend locally.

Services
- Frontend (Angular): http://localhost:4200
- Backend API: http://localhost:3001
- MySQL: 3306 (local)

Local commands
- Backend: cd backend, npm install, npm start
- Frontend: cd frontend, npm install, npm start

Notes
- If no OpenAI key is set, the backend falls back to deterministic heuristics.
- Human approvals are represented by ticket fields and require explicit API calls.
