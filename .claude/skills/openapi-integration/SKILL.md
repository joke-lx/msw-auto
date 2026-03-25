# OpenAPI Integration Skill

Best practices for working with OpenAPI/Swagger specifications in API-driven development.

## When to Apply

- Working with OpenAPI/Swagger specifications
- Building API mock servers from contracts
- Generating TypeScript types from schemas
- Converting OpenAPI specs to Agent Skills
- API-first development workflows

## Key Concepts

1. **Contract-Driven Development** - OpenAPI as single source of truth
2. **Schema-First Mocking** - Generate mocks from OpenAPI schemas
3. **Type Generation** - TypeScript interfaces from OpenAPI
4. **Contract Discovery** - Auto-discover from live backends or files

## OpenAPI to Agent Skills

Convert OpenAPI specs to modular skills for AI agents:

```bash
npx openapi-to-skills ./openapi.yaml -o ./output
```

### Output Structure

```
{skill-name}/
├── SKILL.md                 # Entry point with API overview
└── references/
    ├── resources/            # Grouped by tag
    ├── operations/           # One file per operation
    ├── schemas/              # Grouped by naming prefix
    └── authentication.md     # Auth schemes
```

### OpenAPI to Skills Features

- **Semantic Structure** - Organized by resources, operations, schemas
- **Smart Grouping** - Auto-detect tags or path prefixes
- **Filtering** - Include/exclude by tags, paths, deprecated
- **Custom Templates** - Override default templates

## Schema-Based Mock Generation

### Input: OpenAPI Schema

```yaml
User:
  type: object
  properties:
    id:
      type: string
      format: uuid
    email:
      type: string
      format: email
    createdAt:
      type: string
      format: date-time
```

### Output: Generated Mock

```typescript
{
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "user@example.com",
  createdAt: "2024-01-15T10:30:00Z"
}
```

## Schema Features

- **Semantic Generation** - email, UUID, dates from field names
- **Complex Types** - allOf, oneOf, anyOf, $ref handling
- **Boundary Cases** - Empty arrays, null values, edge cases
- **Nested Objects** - Recursive schema support

## TypeScript Type Generation

```typescript
// From OpenAPI Schema
export interface User {
  id?: string;
  email?: string;
  createdAt?: string;
}

// With required fields
export interface User {
  id: string;
  email: string;
  createdAt: string;
}
```

## Contract Discovery

### Live Backend Discovery

Check common paths:
- `/api-docs`
- `/swagger.json`
- `/openapi.json`

### Static File Discovery

Scan for:
- `**/*.json` (OpenAPI/Swagger)
- `**/*.yaml` / `**/*.yml`
- Common directories: `docs/`, `spec/`, `api/`

### Config-Based Discovery

From `package.json`:
```json
{
  "swagger": "./api/spec.json"
}
```

Or `msw-auto.config.js`:
```javascript
export default {
  contracts: {
    backendUrl: 'https://api.example.com',
    projectPath: process.cwd(),
    includePatterns: ['**/*.openapi.json']
  }
}
```

## Best Practices

1. **Always validate OpenAPI specs** before importing
2. **Use semantic field names** for better mock generation
3. **Keep schemas small** - Split large specs into resources
4. **Version your contracts** - Track changes with hashes
5. **Document breaking changes** - Use OpenAPI extensions

## OpenAPI Extensions

```yaml
x-msw-auto:
  mock:
    enabled: true
    delay: 1000
  validation:
    strict: true
```

## API-First Workflow

```
1. Backend writes OpenAPI spec
2. Frontend generates types: msw-auto types --contract MyAPI
3. Backend implements API
4. MSW Auto discovers and generates mocks
5. Frontend develops against mocks
6. Contract tests validate compliance
```

## Integration with MCP

For AI agent integration:
1. Convert OpenAPI to skills: `openapi-to-skills`
2. Register with MCP server
3. Agents can query specific operations
4. Generate mock responses from schemas
