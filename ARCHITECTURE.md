# MSW Auto Architecture

## Overview

MSW Auto is an **API Contract-Driven Mock Server** that treats OpenAPI/Swagger specifications as the single source of truth. It automatically discovers API contracts from live backends or static files, generates 100% schema-compliant mock data, and provides TypeScript type definitions for frontend development.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MSW Auto Architecture                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │   Backend   │───▶│  Contract   │───▶│    Mock     │───▶│   Frontend  │ │
│  │   (Live)    │    │  Discovery  │    │  Generator  │    │   (Types)   │ │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘ │
│         │                  │                  │                  │         │
│         ▼                  ▼                  ▼                  ▼         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │  OpenAPI    │    │   Contract  │    │   Mock      │    │  Generated  │ │
│  │  Spec JSON  │    │   Storage   │    │   Storage   │    │  .ts Types  │ │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                        Web UI Dashboard                               │ │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐            │ │
│  │  │ Contracts │ │   Mocks   │ │   Types   │ │  Request  │            │ │
│  │  │   List    │ │  Manager  │ │ Generator │ │   Logs    │            │ │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘            │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                          CLI / MCP Server                             │ │
│  │  • Auto-discovery from project files                                   │ │
│  │  • AI-powered mock generation (optional)                              │ │
│  │  • VS Code extension integration                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Contract Discovery (`src/contract/discovery.ts`)

Automatically discovers OpenAPI/Swagger specifications from multiple sources:

**Live Endpoints:**
- Checks common paths: `/api-docs`, `/swagger.json`, `/openapi.json`
- Supports custom backend URLs
- Auto-detects OpenAPI 3.x and Swagger 2.0

**Static Files:**
- Scans project directory for `.json`, `.yaml` files
- Checks common locations: `docs/`, `spec/`, `api/`

**Config Files:**
- Reads from `swagger` config in `package.json`
- Supports `msw-auto.config.js`

### 2. Schema-Based Mock Generator (`src/contract/mock-generator.ts`)

Generates mock data that is **100% compliant** with OpenAPI schemas:

**Features:**
- Semantic-aware generation (email, UUID, dates, URLs)
- Handles `allOf`, `oneOf`, `anyOf`, `$ref`
- Generates boundary cases (empty arrays, null values)
- Nested object support

**Example:**
```typescript
// Input Schema
{
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    email: { type: "string", format: "email" },
    createdAt: { type: "string", format: "date-time" }
  }
}

// Generated Mock
{
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "user@example.com",
  createdAt: "2024-01-15T10:30:00Z"
}
```

### 3. TypeScript Type Generator (`src/contract/type-generator.ts`)

Auto-generates TypeScript interfaces from OpenAPI schemas:

```typescript
// Input: OpenAPI Schema
{
  User: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" }
    }
  }
}

// Output: TypeScript
export interface User {
  id?: string
  name?: string
}
```

### 4. Contract Manager (`src/server/contract/manager.ts`)

Central manager for all contract operations:

- **CRUD**: Create, read, update, delete contracts
- **Discovery**: Auto-discover from projects
- **Sync**: Update from live sources
- **Version tracking**: Hash-based change detection
- **Diff**: Compare contract versions

### 5. Storage Layer (`src/server/storage/database.ts`)

Hybrid storage with SQLite + in-memory fallback:

```sql
-- Contracts Table
CREATE TABLE contracts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT,
  version TEXT NOT NULL,
  spec TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_synced_at TEXT
);

-- Mocks Table
CREATE TABLE mocks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  response TEXT NOT NULL,
  enabled INTEGER DEFAULT 1
);

-- Request Logs Table
CREATE TABLE request_logs (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  response_status INTEGER,
  is_mocked INTEGER DEFAULT 0
);
```

## API Routes

### Contract Management

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/contracts` | List all contracts |
| POST | `/api/contracts` | Create contract |
| GET | `/api/contracts/:id` | Get contract details |
| DELETE | `/api/contracts/:id` | Delete contract |
| POST | `/api/contracts/discover` | Auto-discover contracts |
| POST | `/api/contracts/:id/sync` | Sync from source |

### Mock Generation

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/contracts/:id/mocks` | Generate all mocks |
| POST | `/api/contracts/:id/mocks/generate` | Generate specific mock |

### Type Generation

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/contracts/:id/types` | Get TypeScript types |
| POST | `/api/contracts/:id/types/download` | Download .ts file |

## Frontend Architecture

```
web/
├── src/
│   ├── api/              # API client (Axios)
│   │   └── client.ts     # Unified API calls
│   ├── pages/            # Page components
│   │   ├── Dashboard/    # Overview & stats
│   │   ├── Contracts/    # Contract management
│   │   ├── MockEditor/   # Mock CRUD
│   │   └── Settings/     # Configuration
│   ├── stores/           # State management (Zustand)
│   │   ├── appStore.ts   # App-wide state
│   │   ├── mockStore.ts  # Mock state
│   │   └── contractStore.ts # Contract state
│   ├── components/       # Reusable components
│   │   └── Layout/       # App shell
│   └── types/            # TypeScript definitions
│       └── contract.ts   # Contract types
```

### State Management (Zustand)

```typescript
// Contract Store
interface ContractState {
  contracts: Contract[]
  selectedContract: Contract | null
  loading: boolean
  error: string | null

  // Actions
  fetchContracts: () => Promise<void>
  createContract: (dto: CreateContractDto) => Promise<Contract>
  deleteContract: (id: string) => Promise<void>
  discoverContracts: (options: DiscoverOptions) => Promise<Contract[]>
  syncContract: (id: string) => Promise<Contract | null>
}
```

## WebSocket Integration

Real-time updates for:

- New contracts discovered
- Mock status changes
- Request logs
- Validation results

```typescript
// WebSocket Message Format
{
  type: 'contract_discovered' | 'mock_updated' | 'request_logged',
  data: any,
  timestamp: string
}
```

## MCP Server Integration

Model Context Protocol server for AI-powered features:

- **Route Extraction**: Analyze frontend code to find API calls
- **Contract Validation**: Verify frontend usage against contracts
- **Smart Mock Generation**: Use LLM for complex response patterns

## Development Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Development Workflow                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Backend Developer                                                      │
│     │                                                                      │
│     ├─ Write API code with OpenAPI annotations                             │
│     ├─ Generate/publish OpenAPI spec                                       │
│     └─ Deploy backend with /api-docs endpoint                              │
│                                                                             │
│  2. Frontend Developer (with MSW Auto)                                     │
│     │                                                                      │
│     ├─ Run: msw-auto discover --backend-url https://api.example.com       │
│     ├─ Run: msw-auto types --contract MyAPI > src/types/api.ts            │
│     ├─ Run: msw-auto dev                                                   │
│     └─ Develop frontend with auto-completion & type checking               │
│                                                                             │
│  3. QA / Testing                                                           │
│     │                                                                      │
│     ├─ MSW Auto returns schema-compliant mocks                             │
│     ├─ No need for manual mock data creation                               │
│     └─ Tests are always in sync with API contracts                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Server
PORT=3001              # Mock server port
WEB_PORT=3000          # Web UI port
DB_PATH=./data/mocks.db # SQLite database path

# LLM (optional)
ANTHROPIC_API_KEY=sk-ant-xxx
PROVIDER=anthropic
MODEL=claude-3-5-sonnet-20241022
```

### Contract Discovery Config

```javascript
// msw-auto.config.js
export default {
  contracts: {
    backendUrl: 'https://api.example.com',
    projectPath: process.cwd(),
    includePatterns: ['**/*.openapi.json', '**/swagger.yaml'],
    excludePatterns: ['node_modules/**', 'dist/**']
  }
}
```

## Security Considerations

1. **API Key Storage**: LLM API keys stored in `data/config.json` (not in Git)
2. **CORS**: Configurable CORS for development
3. **Input Validation**: All OpenAPI specs validated before import
4. **Path Traversal**: File discovery restricted to project directory

## Performance

- **Database**: SQLite with WAL mode for concurrent access
- **In-Memory Cache**: Contracts cached after first load
- **Lazy Loading**: Mock data generated on-demand
- **WebSocket**: Push updates instead of polling

## Future Enhancements

- [ ] Frontend AST validation (verify API usage)
- [ ] Contract versioning & rollback
- [ ] Breaking change detection
- [ ] Multi-format support (GraphQL, gRPC)
- [ ] Docker deployment
- [ ] Cloud sync for team sharing
