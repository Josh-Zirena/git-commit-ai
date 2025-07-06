# AI Git Commit Generator - Implementation Spec

## Project Overview

Build a simple Express.js API that analyzes git diffs and generates meaningful commit messages using OpenAI's API. Deploy to EC2 with basic HTML frontend for testing.

## Technical Requirements

### Stack

- Node.js + Express.js with TypeScript
- OpenAI API for AI processing
- Basic HTML/CSS frontend for testing
- Deploy to EC2 (t2.micro sufficient)

### Project Structure

Create a project with these folders and files:

- `src/` directory containing the main TypeScript server files
- `public/` directory for static HTML frontend and compiled TypeScript
- Main server file, OpenAI service wrapper, and validation utilities in TypeScript
- Frontend TypeScript files that compile to JavaScript for the browser
- Package.json with proper dependencies and scripts
- TypeScript configuration for both Node.js server and browser client
- Environment variables example file

## Core Implementation Details

### Main Express Server

Create the main server file that:

- Sets up Express with CORS and JSON parsing middleware
- Implements rate limiting (10 requests per minute to prevent abuse)
- Serves static files from the public directory
- Has a single POST endpoint `/api/generate-commit` that:
  - Accepts a JSON body with a `diff` field containing the git diff text
  - Validates the input to ensure it's a valid git diff format
  - Calls the OpenAI service to generate the commit message
  - Returns JSON with the generated commit message and optional description
  - Handles errors gracefully with proper HTTP status codes

### OpenAI Service Module

Create a service module that:

- Initializes the OpenAI client with API key from environment variables
- Has a function that takes a git diff string and generates a commit message
- Uses a carefully crafted prompt that instructs the AI to:
  - Follow conventional commit format (type(scope): description)
  - Use appropriate types like feat, fix, docs, style, refactor, test, chore
  - Keep the subject line under 50 characters
  - Be specific about what changed without including unnecessary file names
  - Generate both a commit message and optional longer description for complex changes
- Uses GPT-4o-mini model with low temperature for consistent results
- Parses the AI response to extract clean commit message and description
- Returns structured data with the commit message, description, and usage info

### Input Validation

Create a validation utility that:

- Checks if the input looks like a valid git diff
- Looks for common git diff indicators like "diff --git", "+++", "---", "@@", and lines starting with + or -
- Returns boolean indicating if the diff appears valid
- Helps prevent processing of invalid or malicious input

### Frontend Interface

Create a simple HTML page that:

- Has a clean, professional design with a text area for pasting git diffs
- Includes a submit button to generate commit messages
- Shows loading state while processing
- Displays the generated commit message in a formatted code block
- Shows optional description if provided by the AI
- Handles and displays errors appropriately
- Uses vanilla TypeScript compiled to JavaScript for API calls to the backend

### TypeScript Configuration

Create TypeScript configurations for:

- Server-side code targeting Node.js with CommonJS modules
- Client-side code targeting modern browsers with ES modules
- Separate tsconfig files or paths for server vs client compilation
- Proper type definitions for DOM manipulation and Node.js APIs
- Build process that compiles both server and client TypeScript files

### Environment Setup

Create environment configuration that:

- Requires OPENAI_API_KEY environment variable
- Sets default port to 3000
- Includes example environment file for easy setup

## Deployment Instructions

### EC2 Setup

The deployment should:

- Work on a basic t2.micro EC2 instance
- Use Node.js LTS version
- Install dependencies with npm
- Build the TypeScript code
- Start the server with proper process management
- Set up basic security groups allowing HTTP traffic on port 3000
- Configure environment variables for OpenAI API key

### Simple Deployment Process

- Clone the repository to EC2
- Install Node.js and npm
- Install project dependencies
- Set the OpenAI API key in environment variables
- Build both server and client TypeScript code
- Start the server
- Access via EC2 public IP on port 3000

## Usage Flow

1. Developer runs `git diff` locally to see their changes
2. Copies the diff output to clipboard
3. Visits the web interface hosted on EC2
4. Pastes the diff into the text area
5. Clicks generate to get AI-powered commit message
6. Copies the generated message for use with `git commit -m "message"`

## Key Features

- Simple single-endpoint API design
- Rate limiting to prevent abuse
- Input validation for security
- Clean, professional web interface
- Structured JSON responses
- Error handling throughout
- Conventional commit format compliance
- Minimal dependencies for easy deployment

This implementation can be completed in one day and provides immediate value to developers who want better commit messages without the complexity of IDE plugins or command-line tools.
