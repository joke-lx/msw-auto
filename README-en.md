# MSW Auto

<p align="center">
  <a href="README.md">中文</a> |
  <a href="README-en.md">English</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/msw-auto">
    <img src="https://img.shields.io/npm/v/msw-auto.svg" alt="npm version" />
  </a>
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/node/v/msw-auto.svg" alt="node" />
  </a>
  <a href="https://github.com/msw-auto/msw-auto/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/msw-auto/msw-auto.svg" alt="license" />
  </a>
</p>

> Intelligent automated Mock server built on MSW (Mock Service Worker) with Web UI management and AI generation capabilities.

## Features

- **Powerful Mocking** - Built on MSW, supports REST, GraphQL, and WebSocket
- **Global Toggle** - One-click enable/disable all Mock interceptions
- **Web UI Management** - Intuitive graphical interface for managing Mock configurations
- **AI Generation** - Auto-generate Mock data using LLM
- **Frontend Analysis** - Auto-analyze API calls in frontend projects (axios/fetch/XHR)
- **MCP Tool Service** - Provides local file operations and AI integration tools
- **Multi-LLM Support** - Supports Anthropic, OpenAI, and more
- **Import Support** - Import API definitions from Postman and Swagger
- **Theme Switching** - Light/Dark theme with one-click toggle
- **Internationalization** - Support for Chinese and English interfaces
- **Request Logging** - Real-time recording and viewing of all requests
- **Version Management** - Support for Mock version history and rollback

## Table of Contents

- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [CLI Commands](#cli-commands)
- [Web UI Guide](#web-ui-guide)
- [AI Configuration](#ai-configuration)
- [MCP Service](#mcp-service)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Architecture](#architecture)

---

## Quick Start

### Installation

```bash
npm install msw-auto
# or
pnpm add msw-auto
# or
yarn add msw-auto
```

### Basic Usage

```bash
# Start interactive menu (recommended for first-time users)
npx msw-auto

# Or start server directly
npx msw-auto server

# Start Web UI (requires separate terminal)
npx msw-auto web
```

Then visit http://localhost:3000 to use the Web UI.

---

## Development Setup

### Running from Source

If you've cloned this repository:

```bash
# 1. Install dependencies
pnpm install

# 2. Install web frontend dependencies
cd web && pnpm install && cd ..

# 3. Development mode (starts both CLI and server)
pnpm dev

# 4. Or start separately
pnpm dev:server   # Start backend server (port 3001)
pnpm dev:cli      # Start CLI interactive mode

# 5. In a new terminal, start Web UI
cd web && pnpm dev   # Start frontend (port 3000)
```

### Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Web UI | http://localhost:3000 | React frontend interface |
| Mock Server | http://localhost:3001 | Express backend service |
| WebSocket | ws://localhost:3001/ws | Real-time updates |

---

## CLI Commands

### Interactive Mode

```bash
npx msw-auto
# or
npx msw-auto interactive
```

Provides a graphical menu with options to:
- Start/stop server
- Launch Web UI
- Configure LLM
- View configuration
- Exit

### init - Initialize MSW

```bash
# Initialize to current directory
npx msw-auto init

# Specify public directory
npx msw-auto init ./public

# Save config to package.json
npx msw-auto init --save
```

### server - Start Mock Server

```bash
# Use default port (3001)
npx msw-auto server

# Specify port
npx msw-auto server --port 8080

# Disable file watching
npx msw-auto server --watch false
```

### web - Start Web UI

```bash
# Use default port (3000)
npx msw-auto web

# Specify port
npx msw-auto web --port 8080
```

### generate - AI Generate Mock

```bash
# Basic usage
npx msw-auto generate --prompt "User list API"

# Specify output file
npx msw-auto generate --prompt "Product catalog" --output ./mocks/products.ts

# Short form
npx msw-auto generate -p "Order API" -o ./mocks/orders.ts
```

### import - Import API Definitions

```bash
# Import Postman collection
npx msw-auto import ./postman_collection.json

# Import Swagger/OpenAPI
npx msw-auto import ./swagger.yaml

# Specify output directory
npx msw-auto import ./api.json --output ./mocks
```

### config - View Configuration

```bash
# Show current LLM configuration
npx msw-auto config
```

### setting - Configure LLM

```bash
# Set provider
npx msw-auto setting --provider anthropic
npx msw-auto setting --provider openai
npx msw-auto setting --provider custom

# Set API Key
npx msw-auto setting --apikey sk-ant-xxx
npx msw-auto setting --apikey sk-openai-xxx

# Set custom Base URL
npx msw-auto setting --provider custom --baseurl https://api.example.com/v1
```

### model - Switch Model

```bash
# Switch Claude model
npx msw-auto model claude-3-5-sonnet-20241022
npx msw-auto model claude-3-opus-20240229

# Switch GPT model
npx msw-auto model gpt-4o
npx msw-auto model gpt-4-turbo
```

### mcp - Start MCP Server

```bash
npx msw-auto mcp
```

### Language Switch

```bash
# Chinese interface
npx msw-auto --lang zh

# English interface
npx msw-auto --lang en
```

---

## Web UI Guide

### 1. Dashboard

Visit http://localhost:3000/dashboard

**Features**:
- View Mock statistics overview (total, enabled, today's requests)
- View recent request logs
- Global toggle control (enable/disable all Mocks with one click)
- Quick create new Mock

**Actions**:
- Click global toggle button to switch all Mock status
- Click "Create Mock" button to add new Mock
- Request logs update in real-time, showing recent API calls

### 2. API Explorer

Visit http://localhost:3000/explorer

**Features**:
- Browse all configured Mock APIs
- Filter by method, path
- View detailed information for each Mock
- Create Mock from actual requests

**Actions**:
- Use search box to quickly find APIs
- Click API card to view details
- Click "Enable/Disable" to toggle individual Mock
- Click "Edit" to modify Mock configuration

### 3. Mock Editor

Visit http://localhost:3000/mocks

**Features**:
- Visual Mock creation and editing
- JSON editor support
- Request/response configuration
- Delay simulation settings

**Configuration Options**:
- **Name**: Mock display name
- **Method**: HTTP method (GET/POST/PUT/DELETE, etc.)
- **Path**: Request path, supports parameters (e.g., `/api/users/:id`)
- **Status Code**: Response status code (default 200)
- **Headers**: Custom response headers
- **Response Body**: JSON response data
- **Delay**: Simulate network delay (milliseconds)
- **Tags**: Category tags
- **Description**: Detailed description

### 4. Documentation

Visit http://localhost:3000/docs

**Features**:
- AI auto-generates API documentation
- One-click copy documentation content
- Markdown format export

**Actions**:
- Select Mock and click "Generate Documentation"
- AI automatically analyzes and generates documentation
- Click "Copy" button to copy documentation

### 5. Settings

Visit http://localhost:3000/settings

**Features**:
- LLM configuration management
- Theme switching (Light/Dark)
- Language switching (Chinese/English)
- Server connection settings

**LLM Configuration**:
- Select provider (Anthropic/OpenAI/Custom)
- Enter API Key
- Configure Base URL (for custom provider)
- Select model

---

## AI Configuration

### Supported Providers

| Provider | Default Model | Base URL |
|----------|---------------|----------|
| Anthropic | claude-3-5-sonnet-20241022 | https://api.anthropic.com |
| OpenAI | gpt-4o | https://api.openai.com/v1 |
| Custom | - | User specified |

### Configuration Steps

#### 1. Configure via CLI

```bash
# Anthropic Claude
npx msw-auto setting --provider anthropic --apikey sk-ant-xxx

# OpenAI
npx msw-auto setting --provider openai --apikey sk-xxx

# Custom API
npx msw-auto setting --provider custom --baseurl https://api.example.com/v1 --apikey your-key
```

#### 2. Configure via Web UI

1. Visit http://localhost:3000/settings
2. In the LLM configuration section:
   - Select provider
   - Enter API Key
   - Configure Base URL (if needed)
   - Click "Save Configuration"

#### 3. Verify Configuration

```bash
npx msw-auto config
```

Or visit http://localhost:3000/settings to view configuration status.

### AI Features Usage

#### Generate Mock

1. Click "Create Mock" in Web UI
2. Enter API description, e.g., "User list API, returns paginated user data"
3. Click "AI Generate" button
4. AI automatically generates response data and configuration

#### Improve Mock

1. Open existing Mock edit page
2. Click "AI Improve" button
3. Enter improvement requirements, e.g., "Add more fields and more realistic data"
4. AI automatically optimizes Mock configuration

#### Generate Documentation

1. Select a Mock from the Mock list
2. Click "Generate Documentation" button
3. AI automatically generates API documentation
4. Copy or export documentation

---

## MCP Service

MCP (Model Context Protocol) server allows any MCP-compatible LLM tool to directly call MSW Auto features.

### MCP Tools List

#### File Operation Tools

| Tool | Description |
|------|-------------|
| `read_file` | Read file content |
| `write_file` | Write file content |
| `list_directory` | List directory contents |
| `create_directory` | Create a directory |
| `file_exists` | Check if file/directory exists |

#### Project Operation Tools

| Tool | Description |
|------|-------------|
| `analyze_project` | Analyze project to discover API endpoints |
| `generate_mock` | Generate Mock data using LLM |
| `start_mock_server` | Start Mock server |
| `list_projects` | List all projects |
| `get_llm_config` | Get LLM configuration |
| `reload_llm_config` | Reload LLM configuration |

### Configure MCP

Configure in Claude Desktop or other MCP-compatible applications:

```json
{
  "mcpServers": {
    "msw-auto": {
      "command": "npx",
      "args": ["msw-auto", "mcp"]
    }
  }
}
```

### Usage Example

In Claude Desktop:
```
Please analyze my frontend project and generate Mocks for all APIs
```

Claude will automatically call MCP tools to:
1. Analyze project structure
2. Identify all API calls
3. Generate corresponding Mock data
4. Start Mock server

---

## API Reference

### Base URL

```
http://localhost:3001/api
```

### Global Control

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/global-toggle` | GET | Get global toggle status |
| `/api/global-toggle` | POST | Set global toggle `{enabled: boolean}` |
| `/api/stats` | GET | Get statistics |

### Mock Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mocks` | GET | Get all Mocks |
| `/api/mocks` | POST | Create Mock |
| `/api/mocks/:id` | GET | Get single Mock |
| `/api/mocks/:id` | PUT | Update Mock |
| `/api/mocks/:id` | DELETE | Delete Mock |
| `/api/mocks/:id/toggle` | POST | Toggle single Mock status |
| `/api/mocks/:id/duplicate` | POST | Duplicate Mock |

### Version Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mocks/:id/versions` | GET | Get version history |
| `/api/mocks/:id/versions` | POST | Create version snapshot |
| `/api/mocks/:id/versions/:version/rollback` | POST | Rollback to specific version |
| `/api/mocks/:id/versions/compare` | GET | Compare two versions |

### AI Features

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/generate` | POST | AI generate Mock |
| `/api/ai/improve/:id` | POST | AI improve Mock |
| `/api/ai/docs/:id` | POST | AI generate documentation |
| `/api/ai/chat` | POST | AI chat |
| `/api/ai/status` | GET | AI service status |

### Import/Export

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/import/openapi` | POST | Import OpenAPI |
| `/api/import/postman` | POST | Import Postman |
| `/api/export/openapi` | GET | Export OpenAPI |
| `/api/export/postman` | GET | Export Postman |
| `/api/export/json` | GET | Export JSON |

### Request Monitoring

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/requests` | GET | Get request logs |

---

## Configuration

### Environment Variables

Create `.env` file or set environment variables:

```bash
# Server configuration
PORT=3001                    # Mock server port
WEB_PORT=3000                # Web UI port

# LLM configuration
ANTHROPIC_API_KEY=sk-ant-xxx # Claude API key
OPENAI_API_KEY=sk-xxx        # OpenAI API key

# Database configuration
DB_PATH=./data/mocks.db      # SQLite database path

# Proxy configuration
BACKEND_URL=https://api.example.com  # Backend API URL (for proxy)
```

### Configuration File

Configuration is saved in `data/config.json`:

```json
{
  "port": 3001,
  "webPort": 3000,
  "provider": "anthropic",
  "apiKey": "sk-ant-xxx",
  "baseUrl": "https://api.anthropic.com",
  "model": "claude-3-5-sonnet-20241022",
  "dbPath": "./data/mocks.db"
}
```

### Database

Uses SQLite to store Mock data, file location: `data/mocks.db`

**Data Tables**:
- `mocks` - Mock configurations
- `request_logs` - Request logs
- `mock_versions` - Version history

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        MSW Auto                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐    ┌─────────────┐                        │
│   │   CLI       │    │   Web UI    │                        │
│   │  (Terminal) │    │  (React)    │                        │
│   └──────┬──────┘    └──────┬──────┘                        │
│          │                  │                                │
│          └──────────┬───────┘                                │
│                     ▼                                        │
│   ┌─────────────────────────────────────┐                   │
│   │         Express Server              │                   │
│   │         (Port 3001)                 │                   │
│   ├─────────────────────────────────────┤                   │
│   │  ┌─────────────┐  ┌──────────────┐ │                   │
│   │  │ Mock Manager│  │ Claude Client│ │                   │
│   │  │  (Mock Mgmt)│  │  (AI Integ)  │ │                   │
│   │  └──────┬──────┘  └──────┬───────┘ │                   │
│   │         │                │          │                   │
│   │  ┌──────▼──────┐  ┌──────▼───────┐ │                   │
│   │  │  Database   │  │   WebSocket  │ │                   │
│   │  │  (SQLite)   │  │  (Real-time) │ │                   │
│   │  └─────────────┘  └──────────────┘ │                   │
│   └─────────────────────────────────────┘                   │
│                     │                                        │
│                     ▼                                        │
│   ┌─────────────────────────────────────┐                   │
│   │         MCP Server                  │                   │
│   │    (Model Context Protocol)         │                   │
│   │                                     │                   │
│   │  • File Operation Tools             │                   │
│   │  • Project Analysis Tools           │                   │
│   │  • Mock Generation Tools            │                   │
│   └─────────────────────────────────────┘                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + TypeScript + Ant Design + Vite
- **Database**: SQLite (better-sqlite3)
- **Real-time**: WebSocket (ws)
- **AI Integration**: Anthropic Claude SDK
- **CLI**: yargs + inquirer
- **Build**: tsup + esbuild

---

## FAQ

### Q: How to reset configuration?

```bash
# Delete configuration file
rm data/config.json

# Reconfigure
npx msw-auto setting --provider anthropic --apikey your-key
```

### Q: Where is data stored?

All data is stored in the `data/` directory:
- `mocks.db` - SQLite database
- `config.json` - Configuration file

### Q: How to backup Mock data?

```bash
# Method 1: Export JSON
curl http://localhost:3001/api/export/json > mocks-backup.json

# Method 2: Copy database
cp data/mocks.db data/mocks-backup.db
```

### Q: Port already in use?

```bash
# Use different ports
npx msw-auto server --port 8080
npx msw-auto web --port 8081
```

---

## Contributing

Pull requests are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) first.

## License

MIT License - See [LICENSE](LICENSE.md) for more information.

## Acknowledgments

- [MSW](https://mswjs.io/) - Core mocking library
- [Ant Design](https://ant.design/) - UI component library
- [Vite](https://vitejs.dev/) - Build tool
- [Anthropic](https://www.anthropic.com/) - Claude AI
