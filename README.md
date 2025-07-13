# AI Git Commit Generator &middot; [![Node.js](https://img.shields.io/badge/Node.js-24+-339933.svg)]() [![Express](https://img.shields.io/badge/Express-5.1.0-000000.svg)]() [![React](https://img.shields.io/badge/React-19.1.0-61DAFB.svg)]() [![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6.svg)]() [![Vite](https://img.shields.io/badge/Vite-7.0.0-646CFF.svg)]() [![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1.11-06B6D4.svg)]() [![OpenAI](https://img.shields.io/badge/OpenAI-5.8.2-412991.svg)]() [![Jest](https://img.shields.io/badge/Jest-30.0.4-C21325.svg)]()

An AI-powered tool that automatically generates meaningful git commit messages based on your code changes using OpenAI's GPT models.

# See it in action

https://www.git-commit-ai.com

## Features

- **Smart Commit Generation**: Analyzes git diffs and generates contextual commit messages
- **Web Interface**: Clean, responsive React frontend for easy interaction
- **REST API**: Backend API for programmatic access
- **Validation**: Comprehensive git diff validation and error handling
- **Rate Limiting**: Built-in protection against API abuse
- **Multiple Format Support**: Handles various git diff scenarios (additions, deletions, renames, binary files)
- **Large Diff Support**: Intelligent handling of extremely large diffs up to 10MB with chunking and summarization
- **File Prioritization**: Smart algorithm to focus on most important changes in large codebases

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **AI Integration**: OpenAI GPT API
- **Testing**: Jest with comprehensive test coverage

## Prerequisites

- Node.js 24+ and npm
- OpenAI API key
- Git (for development)

## Quick Start

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd git-commit-ai
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your OpenAI API key:

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3000
   ```

4. **Start the development servers**

   ```bash
   npm run dev
   ```

   This starts both frontend (http://localhost:5173) and backend (http://localhost:3000) servers.

## Project Structure

```
git-commit-ai/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API service layer
│   │   └── types/         # TypeScript type definitions
│   └── package.json
├── backend/               # Node.js backend application
│   ├── src/
│   │   ├── services/      # Business logic services
│   │   ├── utils/         # Utility functions
│   │   └── index.ts       # Main server file
│   ├── test/              # Test files
│   └── package.json
├── docs/                  # Documentation
├── examples/              # Example files
└── package.json           # Root package.json
```

## Development

### Frontend Development

```bash
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Backend Development

```bash
cd backend
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm start            # Start production server
npm test             # Run tests
```

### Running Tests

```bash
# Run all tests
npm test

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend
```

## API Usage

### Generate Commit Message

**POST** `/api/generate-commit`

Standard endpoint for regular-sized diffs (recommended for diffs < 100KB):

```json
{
  "diff": "diff --git a/file.ts b/file.ts\nindex 1234567..abcdefg 100644\n--- a/file.ts\n+++ b/file.ts\n@@ -1,3 +1,6 @@\n export function example() {\n   return 'hello';\n }\n+\n+export function newFunction() {\n+  return 'world';\n+}"
}
```

**Response:**

```json
{
  "success": true,
  "commitMessage": "feat: add newFunction to return world",
  "description": "Added a new function that returns 'world' alongside the existing example function",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 25,
    "total_tokens": 175
  }
}
```

### Generate Commit Message (Enhanced)

**POST** `/api/generate-commit-enhanced`

Enhanced endpoint for large diffs with intelligent processing (recommended for diffs > 100KB):

```json
{
  "diff": "your-large-git-diff-here"
}
```

**Enhanced Response:**

```json
{
  "success": true,
  "commitMessage": "feat: implement user authentication system",
  "description": "Added comprehensive user authentication with JWT tokens, password hashing, and role-based access control across multiple components.",
  "summary": "Large-scale authentication implementation",
  "usage": {
    "promptTokens": 2450,
    "completionTokens": 85,
    "totalTokens": 2535
  },
  "processingInfo": {
    "originalSize": 2457600,
    "processedSize": 307200,
    "filesAnalyzed": 15,
    "totalFiles": 47,
    "wasTruncated": true,
    "processingStrategy": "chunked"
  }
}
```

### Health Check

**GET** `/health`

```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

## Configuration

### Environment Variables

| Variable         | Description                          | Default     |
| ---------------- | ------------------------------------ | ----------- |
| `OPENAI_API_KEY` | OpenAI API key (required)            | -           |
| `PORT`           | Backend server port                  | 3000        |
| `NODE_ENV`       | Environment (development/production) | development |

### Rate Limiting

The API includes rate limiting to prevent abuse:

- **Development**: 50 requests per minute
- **Production**: 10 requests per minute

## Error Handling

The application handles various error scenarios:

- **Invalid Git Diff**: Returns validation errors with specific details
- **Missing API Key**: Returns 401 with configuration error
- **Rate Limit Exceeded**: Returns 429 with retry information
- **Large Payloads**: Returns 413 for requests over 2MB
- **OpenAI API Errors**: Returns appropriate HTTP status codes

## Performance Considerations

- **Request Size**: Limited to 10MB with intelligent processing for large diffs
- **Large Diff Handling**: Automatic chunking and prioritization for diffs > 100KB
- **Rate Limiting**: Prevents API abuse and manages costs
- **Caching**: Consider implementing caching for repeated requests
- **Monitoring**: Use the health endpoint for uptime monitoring

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for type safety
- Follow existing code conventions
- Add tests for new features
- Update documentation as needed

## Documentation

- **[API Documentation](docs/API.md)** - Complete API reference with examples
- **[Deployment Guide](docs/DEPLOYMENT.md)** - AWS EC2 and Docker deployment instructions
- **[Large Diff Handling](docs/LARGE-DIFFS.md)** - Guide for processing extremely large git diffs

## License

MIT License - see the LICENSE file for details.

## Support

For issues and questions:

- Check the [troubleshooting guide](docs/DEPLOYMENT.md#troubleshooting)
- Review the [API documentation](docs/API.md)
- See [large diff handling guide](docs/LARGE-DIFFS.md) for performance optimization
- Open an issue on GitHub

## Changelog

### v1.0.0

- Initial release with basic commit generation
- React frontend with modern UI
- Express backend with OpenAI integration
- Comprehensive test coverage
- Rate limiting and error handling
- Large diff support with intelligent chunking (up to 10MB)
- File prioritization algorithm for optimal processing
- Enhanced API endpoint for large codebases
- Complete documentation and deployment guides
