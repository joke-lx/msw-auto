# Web Projects Skill

Standardizes development workflows and best practices for modern JavaScript and TypeScript web frameworks.

## When to Apply

- Managing dependencies with package managers
- Onboarding to new codebases
- Developing frontend components
- Setting up build/test/lint scripts
- Framework-specific configurations (React, Vite, Next.js, Vue, Angular)

## Key Features

1. **Standardized Workflows** - Development, building, testing, and linting scripts
2. **Package Manager Recognition** - npm, yarn, pnpm command consistency
3. **Configuration Maintenance** - TypeScript, linting, environment variables
4. **Component Architecture** - Naming conventions, styling approaches
5. **Framework Detection** - Next.js, Vite, React, Vue, Svelte auto-detection

## Package Manager Commands

| Action | npm | yarn | pnpm |
| --- | --- | --- | --- |
| Install | `npm install` | `yarn install` | `pnpm install` |
| Dev | `npm run dev` | `yarn dev` | `pnpm dev` |
| Build | `npm run build` | `yarn build` | `pnpm build` |
| Test | `npm test` | `yarn test` | `pnpm test` |
| Lint | `npm run lint` | `yarn lint` | `pnpm lint` |

## Project Structure Patterns

### React + Vite
```
src/
├── components/     # Reusable UI components
├── pages/          # Route pages
├── api/            # API clients
├── stores/         # State management
├── hooks/          # Custom hooks
├── types/          # TypeScript definitions
└── App.tsx         # Root component
```

### Node.js Backend
```
src/
├── routes/         # Express/Fastify routes
├── services/       # Business logic
├── middleware/     # Express middleware
├── models/         # Data models
├── utils/          # Utilities
└── index.ts        # Entry point
```

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

## Best Practices

1. **Never mix package managers** - Stick to one (pnpm recommended)
2. **Use strict TypeScript** - Enable all strict checks
3. **Consistent naming** - Follow framework conventions
4. **Environment variables** - Use `.env.example` for documentation
5. **Import order** - External → Internal → Relative

## Import Ordering

```typescript
// 1. Node.js built-ins
import { readFile } from 'fs/promises';

// 2. External packages
import express from 'express';
import { z } from 'zod';

// 3. Internal packages (msw-auto/...)
// 4. Relative imports
import { UserService } from './services/user';
import { Button } from '../components/Button';
```

## Framework-Specific Notes

### Vite (this project uses Vite)
- Use `import.meta.env` for env variables
- Use `import()` for dynamic imports
- Configure `vite.config.ts` for plugins
- Use `*.d.ts` for type declarations

### React
- Functional components with hooks
- Prop types with TypeScript interfaces
- Use `React.memo()` for expensive components
- Avoid anonymous functions in JSX

### TypeScript
- Enable strict mode
- Avoid `any` type
- Use `unknown` for external data
- Define interfaces for all data structures
