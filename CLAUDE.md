# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered git commit message generator with React frontend and Node.js backend. Uses OpenAI API to analyze git diffs and generate meaningful commit messages.

## Common Commands

### Development

```bash
# Start both frontend and backend in development mode
npm run dev

# Start individual services
npm run dev:backend    # Backend only (port 3000)
npm run dev:frontend   # Frontend only (port 5173)

# Build for production
npm run build

# Run tests
npm test               # Backend tests only
npm run test:backend   # Backend tests (Jest)
npm run test:frontend  # Frontend tests (currently not configured)
```

### Frontend-specific (in frontend/ directory)

```bash
npm run lint    # ESLint
npm run build   # TypeScript compilation + Vite build
npm run preview # Preview production build
```

### Backend-specific (in backend/ directory)

```bash
npm run dev     # Development with ts-node
npm run build   # TypeScript compilation
npm start       # Production server
npm test        # Jest tests
```

## Architecture

### Monorepo Structure

- **Root**: Workspace configuration with concurrently for dev orchestration
- **frontend/**: React + TypeScript + Vite + TailwindCSS
- **backend/**: Node.js + Express + TypeScript + OpenAI API

### Key Backend Services

- **OpenAI Service** (`services/openai.ts`): Standard commit generation
- **Enhanced OpenAI Service** (`services/enhancedOpenAI.ts`): Large diff processing with chunking
- **Diff Processor** (`utils/diffProcessor.ts`): Git diff validation and processing
- **Validation** (`utils/validation.ts`): Git diff format validation

### Key Frontend Components

- **CommitGenerator**: Main interface for diff input and commit generation
- **ThemeProvider**: Dark/light theme management
- **API Service** (`services/api.ts`): Backend communication layer

### API Endpoints

- `POST /api/generate-commit`: Standard commit generation (< 100KB diffs)
- `POST /api/generate-commit-enhanced`: Large diff processing (up to 10MB)
- `GET /health`: Health check endpoint
- `GET /metrics`: Application metrics

## Environment Setup

Required environment variables:

- `OPENAI_API_KEY`: OpenAI API key (required)
- `PORT`: Backend port (default: 3000)
- `NODE_ENV`: Environment (development/production)

Copy `.env.example` to `.env` and configure OpenAI API key.

## Testing

- Backend uses Jest with comprehensive test coverage
- Tests include unit tests, integration tests, and E2E tests
- Test files located in `backend/test/`
- Run tests with `npm test` from root or `npm test` from backend directory

## Code Style and Paradigms

**Functional Programming Preferences:**

- First and foremost focus on always doing best practices
- Favor pure functions over stateful operations when possible
- Use immutable data transformations (map, filter, reduce) over loops
- Prefer function composition and higher-order functions
- Minimize side effects and clearly isolate them when necessary
- Use functional error handling patterns (Result/Either types, optional chaining)
- Prefer declarative over imperative code style
- Apply functional principles in React (hooks, pure components, immutable state updates)
- **Use arrow functions whenever possible** instead of function declarations

**When to apply:**

- Data processing and transformation logic
- Business logic and validation functions
- Array/object manipulation
- API response processing
- State management patterns

**When OOP/imperative may be better:**

- Framework integrations (Express middleware, React class components if needed)
- Performance-critical code requiring mutation
- Complex stateful systems where encapsulation provides clarity

## Development Notes

- Rate limiting: 10 requests/minute in production, 1000 in test mode
- Large diff support: Up to 10MB with intelligent chunking
- Frontend uses React Query for API state management
- Backend includes comprehensive logging, metrics, and security middleware
- Graceful shutdown handling for production deployments

## Key Features

- Smart commit message generation based on git diff analysis
- Two processing modes: standard and enhanced for large diffs
- File prioritization algorithm for optimal processing
- Comprehensive error handling and validation
- Rate limiting and security middleware
- Dark/light theme support
- Responsive UI with modern design
