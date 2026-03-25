# TypeScript MCP Skill

Production-ready patterns for building Model Context Protocol (MCP) servers using TypeScript and Node.js.

## When to Apply

- Building MCP servers for Claude Code integration
- Implementing tool registration with Zod validation
- Setting up TypeScript MCP server projects
- Working with `@modelcontextprotocol/sdk`

## Rule Categories

### 1. Server Initialization (critical)

- `server-naming` - Name format: `{service}-mcp` (lowercase with hyphens)
- `server-register-tool` - Use `server.registerTool()` not deprecated APIs
- `server-transport` - Choose stdio (local) or streamable HTTP (remote)

### 2. Tool Registration (critical)

- `tool-naming` - Use snake_case with service context prefix
- `tool-schema` - Use Zod schemas with `.strict()` for input validation
- `tool-annotations` - Set readOnlyHint, destructiveHint, idempotentHint, openWorldHint
- `tool-description` - Explicit description field, not JSDoc

### 3. Zod Schemas (critical)

- `zod-basic` - Basic validation with min/max, email, optional
- `zod-enums` - Use `z.nativeEnum()` for enum types
- `zod-strict` - Always use `.strict()` to forbid extra fields
- `zod-error-messages` - Descriptive error messages for all validations

### 4. TypeScript Best Practices (high)

- `ts-strict` - Enable strict mode in tsconfig.json
- `ts-interfaces` - Define interfaces for all data structures
- `ts-no-any` - Use `unknown` or proper types instead of `any`
- `ts-async` - Use async/await, explicit Promise return types

### 5. Error Handling (high)

- `error-axios` - Handle AxiosError with status code switching
- `error-timeout` - Handle ECONNABORTED with retry suggestion
- `error-structured` - Return structured error messages

### 6. Response Formatting (medium)

- `response-markdown` - Human-readable markdown format
- `response-json` - Machine-readable JSON format
- `response-pagination` - Implement limit/offset pagination
- `response-truncation` - Check CHARACTER_LIMIT constant

## Quick Reference

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "example-mcp",
  version: "1.0.0"
});

server.registerTool(
  "tool_name",
  {
    title: "Tool Display Name",
    description: "What the tool does",
    inputSchema: z.object({ param: z.string() }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params) => {
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Project Structure

```
{service}-mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # Main entry point
│   ├── types.ts          # Type definitions
│   ├── tools/            # One file per domain
│   ├── services/         # API clients
│   ├── schemas/          # Zod validation
│   └── constants.ts      # Shared constants
└── dist/                 # Built output
```

## Package Configuration

```json
{
  "name": "{service}-mcp",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.6.1",
    "axios": "^1.7.9",
    "zod": "^3.23.8"
  }
}
```

## Character Limits

```typescript
export const CHARACTER_LIMIT = 25000;

if (result.length > CHARACTER_LIMIT) {
  const truncatedData = data.slice(0, Math.max(1, data.length / 2));
  return {
    content: [{ type: "text", text: JSON.stringify({
      data: truncatedData,
      truncated: true,
      truncation_message: `Response truncated. Use offset or filters.`
    })]
  };
}
```

## Full Documentation

For complete rule implementations, see `rules/` directory.
