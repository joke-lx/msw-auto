# MSW Auto

<p align="center">
  <img src="media/msw-logo.svg" alt="MSW Auto Logo" width="200" />
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
- **AI Generation** - Auto-generate Mock data using AI
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

### Initialize

```bash
npx msw-auto init
```

### Start Web UI

```bash
npx msw-auto web
```

Open http://localhost:3000 in your browser to access the Web UI.

### Create Mock

Create mocks via Web UI or code:

```typescript
import { http, HttpResponse } from 'msw-auto'

export const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'John Doe' },
      { id: 2, name: 'Jane Doe' }
    ])
  })
]
```

## Commands

| Command | Description |
|---------|-------------|
| `msw-auto init` | Initialize MSW |
| `msw-auto server` | Start Mock server |
| `msw-auto web` | Start Web UI |
| `msw-auto generate` | AI generate Mock |
| `msw-auto import` | Import from Postman/Swagger |

## Web UI Features

- **Dashboard** - View request statistics and recent requests
- **API Explorer** - Browse and search all Mock APIs
- **Mock Management** - Create, edit, delete, and enable/disable mocks
- **Settings** - Theme, language, and API configuration

## Configuration

### Theme

Web UI supports three theme modes:
- Light mode
- Dark mode
- System default

### Language

Support for Chinese and English interface switching.

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
