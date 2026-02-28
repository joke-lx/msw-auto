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
- **Web UI Management** - Intuitive graphical interface for managing Mock configurations
- **AI Generation** - Auto-generate Mock data using LLM
- **MCP Tool Service** - Provides local file operations and AI integration tools
- **Multi-LLM Support** - Supports Anthropic, OpenAI, and more
- **Import Support** - Import API definitions from Postman and Swagger
- **Theme Switching** - Light/Dark theme with one-click toggle
- **Internationalization** - Support for Chinese and English

## Quick Start

### Installation

```bash
npm install msw-auto
# or
pnpm add msw-auto
```

### Configure LLM

```bash
# Set API Key
npx msw-auto setting --apikey YOUR_API_KEY

# Choose provider (anthropic, openai, custom)
npx msw-auto setting --provider anthropic

# Switch model
npx msw-auto model claude-3-5-sonnet-20241022
```

### Start Services

```bash
# Start Mock server
npx msw-auto server --port 3001

# Start Web UI (another terminal)
npx msw-auto web --port 3000
```

Or use interactive menu:

```bash
npx msw-auto interactive
```

Open http://localhost:3000 in your browser to access the Web UI.

## Commands

| Command | Description |
|---------|-------------|
| `msw-auto init` | Initialize MSW |
| `msw-auto server` | Start Mock server |
| `msw-auto web` | Start Web UI |
| `msw-auto generate` | AI generate Mock |
| `msw-auto import` | Import from Postman/Swagger |
| `msw-auto config` | Show LLM configuration |
| `msw-auto setting` | Configure LLM (--provider, --apikey, --baseurl) |
| `msw-auto model` | Switch LLM model |
| `msw-auto interactive` | Start interactive menu |

## LLM Configuration

### Supported Providers

| Provider | Default Model | Base URL |
|----------|---------------|----------|
| Anthropic | claude-3-5-sonnet-20241022 | https://api.anthropic.com |
| OpenAI | gpt-4o | https://api.openai.com/v1 |
| Custom | - | User specified |

### Configuration Examples

```bash
# Anthropic (Claude)
npx msw-auto setting --provider anthropic --apikey sk-ant-xxx

# OpenAI
npx msw-auto setting --provider openai --apikey sk-xxx

# Custom API
npx msw-auto setting --provider custom --baseurl https://api.example.com/v1 --apikey xxx
```

## MCP Service

MCP Server provides the following tools, any MCP-compatible LLM can call:

### File Operations

| Tool | Description |
|------|-------------|
| `read_file` | Read file content |
| `write_file` | Write file content |
| `list_directory` | List directory contents |
| `create_directory` | Create a directory |
| `file_exists` | Check if file/directory exists |

### Project Operations

| Tool | Description |
|------|-------------|
| `analyze_project` | Analyze project to discover API endpoints |
| `generate_mock` | Generate Mock data using LLM |
| `start_mock_server` | Start Mock server |
| `list_projects` | List all projects |
| `get_llm_config` | Get LLM configuration |
| `reload_llm_config` | Reload LLM configuration |

### MCP Configuration

Configure LLM to use MCP tools:

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

## Web UI Features

- **Dashboard** - View request statistics and recent requests
- **API Explorer** - Browse and search all Mock APIs
- **Mock Management** - Create, edit, delete, and enable/disable mocks
- **Settings** - Theme, language, and API configuration

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        MSW Auto                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   CLI / Web UI                                              │
│       │                                                      │
│       ├── setting --provider xxx   → Configure LLM            │
│       └── interactive             → Interactive menu          │
│               │                                              │
│               ▼                                              │
│       MCP Server (Local Tool Service)                       │
│               │                                              │
│               ├── File Operations                           │
│               │   ├── read_file                             │
│               │   ├── write_file                            │
│               │   ├── list_directory                        │
│               │   └── create_directory                      │
│               │                                              │
│               ├── AI Generation                             │
│               │   └── generate_mock ──► LLM API            │
│               │                                              │
│               └── Project Analysis                          │
│                   └── analyze_project                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Documentation

For detailed documentation, visit [Documentation](https://msw-auto.dev/docs).

## Contributing

Pull requests are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) first.

## License

MIT License - See [LICENSE](LICENSE.md) for more information.

## Acknowledgments

- [MSW](https://mswjs.io/) - Core mocking library
- [Ant Design](https://ant.design/) - UI component library
- [Vite](https://vitejs.dev/) - Build tool
- [Anthropic](https://www.anthropic.com/) - Claude AI
