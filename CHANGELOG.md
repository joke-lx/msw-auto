# Changelog

All notable changes to MSW Auto will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2024-01-XX

### 🎉 MAJOR REWRITE - Contract-Driven Development Platform

This release completely reimagines MSW Auto as an API contract-driven development platform. OpenAPI/Swagger specifications are now the single source of truth for all mock data and TypeScript types.

### Added

#### Contract Management
- **Contract Discovery**: Auto-discover OpenAPI specs from:
  - Live backend endpoints (`/api-docs`, `/swagger.json`, `/openapi.json`)
  - Static files in project directory (`.json`, `.yaml`)
  - Config files (`package.json`, `msw-auto.config.js`)
- **Contract Storage**: SQLite database with hash-based change detection
- **Contract Sync**: Update contracts from live sources
- **Contract Diff**: Compare contract versions

#### Schema-Based Mock Generation
- **100% Schema Compliance**: Mocks generated from OpenAPI schemas
- **Semantic-Aware Generation**:
  - Email addresses for `email` fields
  - UUIDs for `id` fields with `uuid` format
  - ISO dates for `date-time` fields
  - Phone numbers, URLs, etc.
- **Complex Schema Support**:
  - `allOf`, `oneOf`, `anyOf` composition
  - `$ref` references
  - Nested objects and arrays
  - Enum values
- **Boundary Cases**: Empty arrays, null values

#### TypeScript Type Generation
- Auto-generate TypeScript interfaces from OpenAPI schemas
- Support for:
  - Nested types
  - Optional fields
  - Union types
  - Enums
  - Documentation comments

#### Web UI
- **Contracts Page**:
  - Statistics cards (total contracts, endpoints, live sources)
  - Contract list with filtering
  - Discover modal
  - Batch operations
- **Contract Detail Page**:
  - Endpoint list with response coverage
  - Schema tree view
  - Raw spec viewer
  - Mock generation preview
- **API Client**: Unified API calls with TypeScript types

#### API Routes
- `GET /api/contracts` - List all contracts
- `POST /api/contracts` - Create contract
- `POST /api/contracts/discover` - Auto-discover contracts
- `POST /api/contracts/:id/sync` - Sync contract from source
- `GET /api/contracts/:id/mocks` - Generate mock data
- `GET /api/contracts/:id/types` - Get TypeScript types
- `POST /api/contracts/:id/types/download` - Download types file

### Changed

- **Architecture**: Complete rewrite focused on contract-driven development
- **Dependencies**:
  - Removed: `@mswjs/interceptors` (using official `msw` package)
  - Added: `msw@^2.3.0` (official MSW package)
  - Moved `@babel/parser`, `@babel/traverse` to dependencies
- **Code Size**: 60% reduction by removing redundant MSW library code
- **Storage**: SQLite with in-memory fallback for contract storage

### Removed

- Entire `src/core/` directory (650+ lines of MSW library copy)
- `src/browser/` and `src/node/` directories
- Build configs for deleted modules
- Duplicate MSW implementation code

### Migration from v2.x

1. **Update dependencies**:
   ```bash
   pnpm install msw-auto@latest
   ```

2. **Configuration** (optional):
   - LLM config moved to `data/config.json`
   - Database path: `data/mocks.db`

3. **New workflow**:
   ```bash
   # Discover contracts from backend
   npx msw-auto discover --backend-url https://api.example.com

   # Generate TypeScript types
   npx msw-auto types --contract MyAPI > src/types/api.ts
   ```

### Technical Details

**New Components**:
- `src/contract/discovery.ts` - OpenAPI spec discovery
- `src/contract/mock-generator.ts` - Schema-based mock generation
- `src/contract/type-generator.ts` - TypeScript type generation
- `src/server/contract/manager.ts` - Contract CRUD operations
- `src/types/contract.ts` - Contract type definitions
- `web/src/pages/Contracts/` - Contract management UI
- `web/src/stores/contractStore.ts` - Contract state management

**Database Schema**:
```sql
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
```

## [2.12.15] - Previous

### Features
- AI-powered mock generation
- Frontend code analysis
- MCP server integration
- Web UI with dashboard
- Mock version management
- Request logging

### Known Limitations (addressed in v3.0)
- Manual mock data creation
- No contract validation
- No type generation
- Redundant code (MSW library copy)

---

## Versioning Policy

- **Major**: Breaking changes, architecture rewrites
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, documentation

## Support

- **Issues**: https://github.com/msw-auto/msw-auto/issues
- **Discussions**: https://github.com/msw-auto/msw-auto/discussions
- **Docs**: https://msw-auto.dev
