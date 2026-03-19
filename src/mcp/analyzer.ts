/**
 * Project Analyzer
 *
 * Analyzes a project to discover API endpoints
 */

import * as fs from 'fs';
import * as path from 'path';

export interface Endpoint {
  method: string;
  path: string;
  file?: string;
  handler?: string;
  framework?: string;
  // OpenAPI 扩展字段
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: any;
  requestBody?: any;
  responses?: any;
  successResponse?: any;
}

export interface ProjectAnalysis {
  endpoints: Endpoint[];
  frameworks: string[];
  summary: string;
}

/**
 * Analyze a project directory to discover API endpoints
 */
export async function analyzeProject(
  projectPath: string,
  proxyUrl?: string
): Promise<ProjectAnalysis> {
  const endpoints: Endpoint[] = [];
  const frameworks: string[] = [];

  // 优先使用 AST 解析
  try {
    const { AdapterManager } = await import('./ast/index.js');
    const manager = new AdapterManager();
    const astRoutes = await manager.analyzeProject(projectPath);

    if (astRoutes.length > 0) {
      endpoints.push(...astRoutes.map(route => ({
        method: route.method,
        path: route.path,
        file: route.file,
        handler: route.handler,
        framework: route.framework,
      })));
      frameworks.push(astRoutes[0].framework);
    }
  } catch (error) {
    console.warn('AST analysis failed, falling back to regex:', error);
  }

  // 如果 AST 解析失败，回退到正则表达式
  if (endpoints.length === 0) {
    const patterns = [
      // Express routes
      { pattern: /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g, framework: 'express' },
      // Fastify routes
      { pattern: /fastify\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g, framework: 'fastify' },
      // Koa routes
      { pattern: /router\.(get|post|put|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g, framework: 'koa' },
      // Next.js API routes
      { pattern: /export\s+(default\s+)?(async\s+)?function\s+\w+\s*\(\s*req|handler\s*=/g, framework: 'nextjs', path: 'pages/api' },
      // NestJS controllers
      { pattern: /@\((['"`])[^'"`]+['"`]\)\s*\s*@(Get|Post|Put|Patch|Delete|Delete)\s*\(['"`]([^'"`]+)['"`]/g, framework: 'nestjs' },
      // Spring Boot
      { pattern: /@(GetMapping|PostMapping|PutMapping|DeleteMapping|RequestMapping)\s*\(\s*value\s*=\s*['"`]([^'"`]+)['"`]/g, framework: 'spring' },
      // Flask
      { pattern: /@(app\.)?(get|post|put|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g, framework: 'flask' },
      // Django
      { pattern: /path\s*\(\s*['"`]([^'"`]+)['"`]/g, framework: 'django' },
    ];

    await analyzeDirectory(projectPath, patterns, endpoints, frameworks);
  }

  // If proxy URL is provided, try to get OpenAPI/Swagger spec
  if (proxyUrl) {
    try {
      const openApiEndpoints = await fetchOpenApiEndpoints(proxyUrl);
      if (openApiEndpoints.length > 0) {
        endpoints.push(...openApiEndpoints);
        frameworks.push('openapi');
      }
    } catch {
      // Ignore errors from fetching OpenAPI spec
    }
  }

  // Remove duplicates
  const uniqueEndpoints = deduplicateEndpoints(endpoints);

  return {
    endpoints: uniqueEndpoints,
    frameworks: [...new Set(frameworks)],
    summary: `Found ${uniqueEndpoints.length} API endpoints across ${frameworks.length} framework(s)`,
  };
}

async function analyzeDirectory(
  dirPath: string,
  patterns: Array<{ pattern: RegExp; framework: string; path?: string }>,
  endpoints: Endpoint[],
  frameworks: string[]
): Promise<void> {
  if (!fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    // Skip common non-source directories
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }
      await analyzeDirectory(fullPath, patterns, endpoints, frameworks);
    } else if (entry.isFile() && isSourceFile(entry.name)) {
      analyzeFile(fullPath, patterns, endpoints, frameworks);
    }
  }
}

function shouldSkipDirectory(name: string): boolean {
  const skipDirs = [
    'node_modules',
    'dist',
    'build',
    '.git',
    '.next',
    '.nuxt',
    'coverage',
    '__pycache__',
    'venv',
    '.venv',
    'vendor',
  ];
  return skipDirs.includes(name);
}

function isSourceFile(filename: string): boolean {
  const sourceExtensions = [
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.py',
    '.java',
    '.go',
    '.rs',
    '.rb',
    '.php',
  ];
  return sourceExtensions.some(ext => filename.endsWith(ext));
}

function analyzeFile(
  filePath: string,
  patterns: Array<{ pattern: RegExp; framework: string; path?: string }>,
  endpoints: Endpoint[],
  frameworks: string[]
): void {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    for (const { pattern, framework } of patterns) {
      let match;
      // Reset regex state
      const regex = new RegExp(pattern.source, pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        frameworks.push(framework);

        let method = 'GET';
        let endpointPath = match[0];

        // Extract method and path based on framework
        if (framework === 'express' || framework === 'fastify' || framework === 'koa') {
          method = match[1].toUpperCase();
          endpointPath = match[2];
        } else if (framework === 'nestjs') {
          method = match[2].toUpperCase();
          endpointPath = match[3];
        } else if (framework === 'spring') {
          method = match[1].replace('Mapping', '').toUpperCase();
          endpointPath = match[2];
        } else if (framework === 'flask') {
          method = match[1].toUpperCase();
          endpointPath = match[2];
        }

        const endpoint: Endpoint = {
          framework,
          file: filePath,
          method,
          path: endpointPath,
        };

        endpoints.push(endpoint);
      }
    }
  } catch {
    // Ignore file read errors
  }
}

async function fetchOpenApiEndpoints(proxyUrl: string): Promise<Endpoint[]> {
  const { OpenAPIParser } = await import('./openapi/index.js');

  // Try common OpenAPI/Swagger endpoints
  const openApiPaths = [
    '/api-docs',
    '/swagger.json',
    '/swagger/v1/swagger.json',
    '/openapi.json',
    '/api/openapi.json',
    '/api/v1/api-docs',
    '/v2/api-docs',
    '/v3/api-docs',
  ];

  for (const openApiPath of openApiPaths) {
    try {
      const result = await OpenAPIParser.parseFromUrl(`${proxyUrl}${openApiPath}`);

      if (result.success && result.endpoints.length > 0) {
        // 转换为旧的 Endpoint 格式
        return result.endpoints.map(ep => ({
          method: ep.method,
          path: ep.path,
          framework: 'openapi',
          // 保留额外信息供后续使用
          operationId: ep.operationId,
          summary: ep.summary,
          description: ep.description,
          tags: ep.tags,
          parameters: ep.parameters,
          requestBody: ep.requestBody,
          responses: ep.responses,
          successResponse: ep.successResponse,
        }));
      }
    } catch {
      // Continue to next path
    }
  }

  return [];
}

function deduplicateEndpoints(endpoints: Endpoint[]): Endpoint[] {
  const seen = new Set<string>();
  const unique: Endpoint[] = [];

  for (const endpoint of endpoints) {
    const key = `${endpoint.method}:${endpoint.path}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(endpoint);
    }
  }

  return unique;
}
