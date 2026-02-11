# Prompt Engineer Audit Application

This application audits code compliance using AI (LLMs) and the Model Context Protocol (MCP). It follows the architecture defined in the project plan.

## Architecture

- **Backend**: FastAPI (Python) with LangGraph for orchestration.
- **Frontend**: Next.js 15 (React) with Tailwind CSS.
- **Infrastructure**: Docker Compose (PostgreSQL, Redis).
- **AI/MCP**: Integration with GitHub MCP Server and LLMs (OpenAI/Anthropic).

## Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Python 3.11+
- GitHub Personal Access Token (PAT)
- OpenAI or Anthropic API Key

## Setup Instructions

### 1. Backend Setup

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. Copy `.env.example` to `.env` and fill in your API keys:
   ```bash
   cp .env.example .env
   ```

### 2. Frontend Setup

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   Access the frontend at `http://localhost:3000`.

### 3. Infrastructure (Docker)

To run the database and Redis services:

```bash
docker-compose up -d db redis
```

Or to run the entire backend stack in Docker:

```bash
docker-compose up --build
```

## Running the Audit

1. Retrieve a GitHub repository URL you want to audit.
2. Open the frontend (`http://localhost:3000`).
3. Enter the repository URL in the form.
4. View the audit results mock (or real if backend is fully configured with LLM).

## MCP Server Integration

To use the real GitHub MCP Server:

1. Follow instructions at [GitHub MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/github) to run it locally or via Docker.
2. Update `MCP_SERVER_URL` in `backend/.env` to point to your running MCP server instance.
