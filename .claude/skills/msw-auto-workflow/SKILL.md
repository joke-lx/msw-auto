# MSW Auto Workflow Skill

Custom skill for working with the MSW Auto project - API Contract-Driven Mock Server.

## Project Overview

MSW Auto is an **API Contract-Driven Mock Server** that treats OpenAPI/Swagger specifications as the single source of truth.

## Directory Structure

```
msw-auto/
├── src/
│   ├── server/           # Express server
│   │   ├── index.ts     # Main server class
│   │   ├── routes/      # API routes
│   │   ├── mock/        # Mock management
│   │   ├── contract/    # Contract management
│   │   ├── storage/     # SQLite database
│   │   ├── websocket/   # Real-time updates
│   │   └── llm/        # AI integration
│   ├── contract/        # Contract processing core
│   │   ├── discovery.ts # OpenAPI auto-discovery
│   │   ├── mock-generator.ts
│   │   └── type-generator.ts
│   ├── mcp/            # MCP server
│   │   ├── server.ts    # MCP main server
│   │   ├── analyzer.ts  # Project analyzer
│   │   ├── llm-service.ts
│   │   └── ast/        # AST analysis
│   └── types/          # TypeScript types
├── web/                # React frontend (Vite)
│   └── src/
│       ├── api/        # API client
│       ├── pages/      # Page components
│       ├── stores/     # Zustand stores
│       └── components/ # Reusable components
├── cli/                # CLI commands
│   ├── commands/      # Command implementations
│   └── index.js        # CLI entry
└── config/             # Configuration files
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Install web frontend dependencies
cd web && pnpm install && cd ..

# Development mode (server + CLI)
pnpm dev

# Separate server and CLI
pnpm dev:server   # Backend on port 3001
pnpm dev:cli      # CLI interactive mode

# Frontend development
cd web && pnpm dev  # Web UI on port 3000

# Build
pnpm build
```

## Key Components

### 1. Contract Discovery (`src/contract/discovery.ts`)

Discovers OpenAPI specs from:
- Live endpoints: `/api-docs`, `/swagger.json`, `/openapi.json`
- Static files: `.json`, `.yaml` in project
- Config: `package.json`, `msw-auto.config.js`

### 2. Mock Generator (`src/contract/mock-generator.ts`)

Generates mock data from OpenAPI schemas:
- Semantic-aware generation (email, UUID, dates)
- Handles allOf/oneOf/anyOf/$ref
- Boundary case generation

### 3. MCP Server (`src/mcp/server.ts`)

Provides tools for AI integration:
- `analyze_project` - Find API endpoints
- `generate_mock` - LLM-powered mock generation
- `start_mock_server` - Start mock server
- File operations: read/write/list directories

### 4. Web UI (`web/src/`)

React + Vite + Ant Design:
- Dashboard: Stats and request logs
- Explorer: Browse APIs
- Mock Editor: CRUD for mocks
- Settings: LLM and theme config

## Common Tasks

### Adding a New MCP Tool

1. Define Zod schema in `src/mcp/`
2. Register tool in `src/mcp/server.ts`
3. Use `server.registerTool()` pattern
4. Add tests in `src/mcp/*.test.ts`

### Adding a New API Route

1. Create route handler in `src/server/routes/`
2. Register in route aggregator
3. Add WebSocket broadcast if needed
4. Document in README

### Adding a New Frontend Page

1. Create component in `web/src/pages/`
2. Add route in React Router
3. Create Zustand store if needed
4. Add menu entry in Layout

## TypeScript Patterns

```typescript
// Zod schema for validation
const ToolInputSchema = z.object({
  param: z.string().min(2).describe("Parameter description")
});

// Type from schema
type ToolInput = z.infer<typeof ToolInputSchema>;

// MCP tool registration
server.registerTool(
  "tool_name",
  {
    title: "Tool Title",
    description: "Tool description",
    inputSchema: ToolInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: ToolInput) => {
    return {
      content: [{ type: "text", text: result }],
      structuredContent: result
    };
  }
);
```

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test src/mcp/analyzer.test.ts
```

## Configuration

Store config in `data/config.json`:
```json
{
  "port": 3001,
  "webPort": 3000,
  "provider": "anthropic",
  "apiKey": "sk-ant-xxx",
  "model": "claude-3-5-sonnet-20241022"
}
```

## Services

| Service | URL | Description |
| --- | --- | --- |
| Web UI | http://localhost:3000 | React frontend |
| Mock Server | http://localhost:3001 | Express backend |
| WebSocket | ws://localhost:3001/ws | Real-time updates |
