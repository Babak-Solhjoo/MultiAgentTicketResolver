# Multi Agent Ticket Resolver (MATR)

## Overview

**MATR** is a proof-of-concept Multi-Agent Ticketing System that revolutionizes incident resolution by leveraging domain expert agents rather than traditional IT teams. 

### Architecture

The system uses a **collaborative multi-agent framework** where:
- **Domain Expert Agents**: Each agent is specialized in a specific domain (e.g., billing, authentication, infrastructure, frontend, backend)
- **Autonomous Analysis**: Agents independently analyze tickets from their domain perspective
- **Agent Debate**: Agents engage in structured debate to validate severity, duplicate detection, routing, and resolution strategies
- **Evidence-Based Decisions**: All decisions are grounded in extracted ticket data and agent expertise
- **Consensus Resolution**: The system reaches agreement through agent negotiation before proposing solutions

### How It Works

1. **Intake**: Raw incident reports are ingested and structured using LLM-powered extraction
2. **Triage**: Multiple domain expert agents analyze the ticket in parallel
3. **Debate**: Agents discuss severity, duplicates, impact, and routing across evidence transcripts
4. **Resolution**: Consensus-driven resolution proposals are generated
5. **Tracking**: Full audit trail of agent decisions and negotiations stored in database

### Technology Stack

- **Frontend**: Angular (TypeScript) - modern, responsive UI at `http://localhost:4200`
- **Backend**: Node.js with Express - API server at `http://localhost:3001`
- **LLM Integration**: LangChain with OpenAI (gpt-4o-mini) for agent intelligence
- **Database**: MySQL - persistent storage of tickets, agents, and negotiation transcripts
- **Fallback**: Deterministic heuristics when LLM is unavailable

## Quick Start (Local Development)

### Prerequisites
- Node.js 16+
- MySQL 8.0+
- OpenAI API key (optional - system works without it)

### Setup Steps

1. **Database Setup**
   ```bash
   mysql -u root < db/setup-local.sql
   # Or manually create user/database as in db/init.sql
   ```

2. **Backend Configuration**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your credentials and optional OpenAI key
   npm install
   npm start
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm start
   ```

4. **Access the Application**
   - Frontend: http://localhost:4200
   - API: http://localhost:3001
   - Docs: See routes in backend/src/routes/

### Environment Variables

Create `backend/.env`:
```
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=ticket_handler
DB_PASSWORD=ticket_handler_pass
DB_NAME=ticket_handler
JWT_SECRET=local_jwt_secret
OPENAI_API_KEY=sk-xxx...        # Optional
OPENAI_BASE_URL=                # Optional (for custom endpoints)
```

## Features

- Multi-agent debate framework with domain experts
- Automatic ticket triage and duplicate detection
- Evidence-based severity assessment
- Intelligent routing to specialized teams
- Full negotiation transcript storage
- Fallback heuristics (no LLM required)
- Role-based access (Agent, Manager, Engineer)
- Real-time statistics dashboard
- Ticket history and audit trails

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Register new user

### Tickets
- `GET /api/tickets` - List all tickets
- `POST /api/tickets` - Create new ticket
- `GET /api/tickets/:id` - Get ticket details
- `PUT /api/tickets/:id` - Update ticket

### Agents
- `GET /api/agents` - List all agents
- `POST /api/agents/intake` - Intake raw report

### Negotiations
- `GET /api/negotiations/:ticketId` - Get agent debate transcript

## Project Structure

```
.
├── frontend/           # Angular SPA
│   ├── src/
│   │   └── app/
│   │       ├── pages/        # Stats, Create, History
│   │       ├── services/     # API, Auth
│   │       └── app.*         # Root component
│   └── package.json
├── backend/            # Node.js Express API
│   ├── src/
│   │   ├── routes/     # API endpoints
│   │   ├── services/   # LLM, orchestration, policy
│   │   ├── middleware/ # auth, validation
│   │   └── db.js       # Database connection
│   └── package.json
├── db/                 # Database schemas
│   ├── init.sql
│   └── setup-local.sql
└── docker-compose.yml  # Container orchestration
```

## Notes

- **LLM Optional**: If `OPENAI_API_KEY` is empty, the backend uses deterministic heuristics for ticket analysis
- **Agent Debate**: All agent decisions are logged in the `negotiations` table for audit and transparency
- **Extensible**: New domain agents can be added by extending the orchestrator service
- **Docker Support**: Use `docker-compose up` to run the stack in containers

## Developer Info

**Version**: 1.0.0  
**Author**: Babak Solhjoo  
**LinkedIn**: [Babak Solhjoo](https://www.linkedin.com/in/babak-solhjoo-533938a2/)

## License

See LICENSE file for details.
