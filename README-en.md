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

> **API Contract-Driven Mock Server** — Auto-generate 100% spec-compliant Mock data from OpenAPI/Swagger specs, with automatic TypeScript type generation.

## Features

### Core Features
- **Contract-Driven** — OpenAPI/Swagger as the single source of truth
- **Auto-Discovery** — Discover API specs from live backend `/api-docs` or static files
- **Precise Mocking** — Schema-based Mock generation, 100% spec-compliant
- **Type Generation** — Auto-generate TypeScript interfaces from contracts
- **Version Management** — Contract versioning, change detection, diff & rollback

### Mocking Capabilities
- **Semantic Awareness** — Intelligent data generation based on field names (email, uuid, dates, etc.)
- **Complex Types** — Supports allOf/oneOf/anyOf, $ref, nested objects
- **Boundary Testing** — Auto-generates edge cases (empty arrays, null values, etc.)
- **Multi-Format** — Supports OpenAPI 3.x and Swagger 2.0

### User Experience
- **Web UI** — Intuitive GUI for managing contracts and Mocks
- **Real-time Updates** — WebSocket push for contract changes
- **Internationalization** — Chinese and English interfaces
- **Theme Switching** — Light/Dark theme

### Developer Tools
- **MCP Integration** — Model Context Protocol server for AI tool access
- **REST API** — Full RESTful API for integration

## Table of Contents

- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
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
```

### Start Services

```bash
# Start backend Mock server (port 3001)
npx msw-auto server

# In a new terminal, start frontend Web UI (port 3000)
cd web && pnpm install && pnpm dev
```

Then visit http://localhost:3000.

---

## Development Setup

If you've cloned this repository:

```bash
# 1. Install dependencies
pnpm install

# 2. Install web frontend dependencies
cd web && pnpm install && cd ..

# 3. Start backend server
pnpm dev:server   # port 3001

# 4. In a new terminal, start frontend
cd web && pnpm dev   # port 3000
```

### Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Web UI | http://localhost:3000 | React frontend interface |
| Mock Server | http://localhost:3001 | Express backend service |
| WebSocket | ws://localhost:3001/ws | Real-time updates |

---

## Web UI Guide

### 1. Dashboard

Visit http://localhost:3000/dashboard

**Features**:
- Mock statistics overview (total, enabled, today's requests)
- Recent request logs
- Global toggle control (enable/disable all Mocks)
- Quick create new Mock

### 2. API Explorer

Visit http://localhost:3000/explorer

**Features**:
- Browse all configured Mock APIs
- Filter by method, path
- View detailed Mock information
- Create Mock from actual requests

### 3. Mock Editor

Visit http://localhost:3000/mocks

**Features**:
- Visual Mock creation and editing
- JSON editor support
- Request/response configuration
- Delay simulation

**Configuration Options**:
- **Name**: Mock display name
- **Method**: HTTP method (GET/POST/PUT/DELETE, etc.)
- **Path**: Request path with parameter support (e.g., `/api/users/:id`)
- **Status Code**: Response status code (default 200)
- **Headers**: Custom response headers
- **Response Body**: JSON response data
- **Delay**: Simulate network delay (ms)
- **Tags**: Category tags
- **Description**: Detailed description

### 4. Documentation

Visit http://localhost:3000/docs

**Features**:
- AI auto-generates API documentation
- One-click copy
- Markdown export

### 5. Settings

Visit http://localhost:3000/settings

**Features**:
- LLM configuration management
- Theme switching (Light/Dark)
- Language switching (Chinese/English)
- Server connection settings

---

## AI Configuration

### Supported Providers

| Provider | Default Model | Base URL |
|----------|---------------|----------|
| Anthropic | claude-3-5-sonnet-20241022 | https://api.anthropic.com |
| OpenAI | gpt-4o | https://api.openai.com/v1 |
| Custom | - | User specified |

### Configuration via Web UI (Recommended)

1. Visit http://localhost:3000/settings
2. In the LLM configuration section:
   - Select provider
   - Enter API Key
   - Configure Base URL (for custom provider)
   - Click "Save Configuration"

### AI Features Usage

#### Generate Mock

1. Click "Create Mock" in Web UI
2. Enter API description, e.g., "User list API, returns paginated user data"
3. Click "AI Generate" button
4. AI automatically generates response data and configuration

#### Improve Mock

1. Open existing Mock edit page
2. Click "AI Improve" button
3. Enter improvement requirements
4. AI automatically optimizes Mock configuration

#### Generate Documentation

1. Select a Mock from the list
2. Click "Generate Documentation" button
3. AI generates API documentation
4. Copy or export

---

## MCP Service

MCP (Model Context Protocol) server allows any MCP-compatible LLM tool to directly call MSW Auto features.

### MCP Tools

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
3. Generate Mock data
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
DB_PATH=./data/mocks.db     # SQLite database path

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

SQLite storage at `data/mocks.db`.

**Tables**:
- `mocks` — Mock configurations
- `request_logs` — Request logs
- `mock_versions` — Version history

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        MSW Auto                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│   │   Web UI    │    │   REST API  │    │ MCP Server  │   │
│   │  (React)   │    │   /api/*    │    │   (MCP)     │   │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘   │
│          │                   │                   │            │
│          └───────────────────┼───────────────────┘            │
│                              ▼                                  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │              Express Server (Port 3001)                │  │
│   │                                                         │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│   │  │Mock Manager │  │Contract Mgr │  │Claude Client│   │  │
│   │  │  (mock/)   │  │(contract/)  │  │ (llm/)      │   │  │
│   │  └─────────────┘  └─────────────┘  └─────────────┘   │  │
│   │                                                         │  │
│   │  ┌─────────────┐  ┌─────────────────────────────────┐  │  │
│   │  │  Database   │  │          WebSocket             │  │  │
│   │  │  (SQLite)   │  │        (Real-time)             │  │  │
│   │  └─────────────┘  └─────────────────────────────────┘  │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + TypeScript + Ant Design + Vite
- **Database**: SQLite (better-sqlite3)
- **Real-time**: WebSocket (ws)
- **AI Integration**: Anthropic Claude SDK
- **Build**: tsup + esbuild

---

## FAQ

### Q: How to reset configuration?

Delete `data/config.json` and restart the server, then reconfigure via Web UI at http://localhost:3000/settings.

### Q: Where is data stored?

- `data/mocks.db` — SQLite database
- `data/config.json` — Configuration file

### Q: How to backup Mock data?

```bash
# Export JSON
curl http://localhost:3001/api/export/json > mocks-backup.json

# Copy database
cp data/mocks.db data/mocks-backup.db
```

### Q: Port already in use?

```bash
PORT=8080 npx msw-auto server
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
