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
  source?: 'frontend' | 'backend';
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

  // Check for common API patterns
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

  // Analyze directory recursively
  await analyzeDirectory(projectPath, patterns, endpoints, frameworks);

  // Analyze frontend API calls (axios, fetch, XMLHttpRequest)
  await analyzeFrontendCalls(projectPath, endpoints, frameworks);

  // If proxy URL is provided, try to get OpenAPI/Swagger spec
  if (proxyUrl) {
    try {
      const openApiEndpoints = await fetchOpenApiEndpoints(proxyUrl);
      endpoints.push(...openApiEndpoints);
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

/**
 * Analyze frontend code for API calls (axios, fetch, XMLHttpRequest)
 */
async function analyzeFrontendCalls(
  dirPath: string,
  endpoints: Endpoint[],
  frameworks: string[]
): Promise<void> {
  if (!fs.existsSync(dirPath)) return;

  const frontendPatterns = [
    // axios.get(url), axios.post(url), etc.
    { pattern: /axios\.(get|post|put|patch|delete|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/g, library: 'axios' },
    // axios.request({ url, method })
    { pattern: /axios\.request\s*\(\s*\{\s*[^}]*url:\s*['"`]([^'"`]+)['"`][^}]*method:\s*['"`]([^'"`]+)['"`]/g, library: 'axios' },
    // fetch(url, options)
    { pattern: /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g, library: 'fetch' },
    // XMLHttpRequest.open(method, url)
    { pattern: /(?:xhr|request|xmlHttp)\.open\s*\(\s*['"`](GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)['"`]?\s*,\s*['"`]([^'"`]+)['"`]/g, library: 'xhr' },
  ];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) continue;
      await analyzeFrontendCalls(fullPath, endpoints, frameworks);
    } else if (entry.isFile() && isSourceFile(entry.name)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');

        for (const { pattern, library } of frontendPatterns) {
          let match;
          const regex = new RegExp(pattern.source, pattern.flags);

          while ((match = regex.exec(content)) !== null) {
            frameworks.push(`frontend-${library}`);

            let method = 'GET';
            let endpointPath = match[1];

            // Extract method and path based on library
            if (library === 'axios') {
              if (match[2] && ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(match[1])) {
                method = match[1].toUpperCase();
                endpointPath = match[2];
              } else if (match[2] && match[3]) {
                method = match[2].toUpperCase();
                endpointPath = match[1];
              }
            } else if (library === 'fetch') {
              method = 'GET';
              endpointPath = match[1];
            } else if (library === 'xhr') {
              method = match[1].toUpperCase();
              endpointPath = match[2];
            }

            // Clean up template literals like `/api/users/${id}`
            endpointPath = endpointPath.replace(/\$\{[^}]+\}/g, ':param');

            const endpoint: Endpoint = {
              framework: library,
              source: 'frontend',
              file: fullPath,
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
  }
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
  const endpoints: Endpoint[] = [];

  // Try common OpenAPI/Swagger endpoints
  const openApiPaths = [
    '/api-docs',
    '/swagger.json',
    '/swagger/v1/swagger.json',
    '/openapi.json',
    '/api/openapi.json',
    '/api/v1/api-docs',
  ];

  for (const openApiPath of openApiPaths) {
    try {
      const response = await fetch(`${proxyUrl}${openApiPath}`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const spec = await response.json();

        // Parse OpenAPI spec
        if (spec.paths) {
          for (const [path, methods] of Object.entries(spec.paths)) {
            for (const [method, details] of Object.entries(methods as Record<string, any>)) {
              if (['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method)) {
                endpoints.push({
                  method: method.toUpperCase(),
                  path,
                  framework: 'openapi',
                });
              }
            }
          }
        }
        break;
      }
    } catch {
      // Continue to next path
    }
  }

  return endpoints;
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
