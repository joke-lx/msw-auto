/**
 * Project Analyzer
 *
 * Analyzes a project to discover API endpoints
 */
import * as fs from 'fs';
import * as path from 'path';
/**
 * Analyze a project directory to discover API endpoints
 */
export async function analyzeProject(projectPath, proxyUrl) {
    const endpoints = [];
    const frameworks = [];
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
    // If proxy URL is provided, try to get OpenAPI/Swagger spec
    if (proxyUrl) {
        try {
            const openApiEndpoints = await fetchOpenApiEndpoints(proxyUrl);
            endpoints.push(...openApiEndpoints);
        }
        catch {
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
async function analyzeDirectory(dirPath, patterns, endpoints, frameworks) {
    if (!fs.existsSync(dirPath))
        return;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        // Skip common non-source directories
        if (entry.isDirectory()) {
            if (shouldSkipDirectory(entry.name)) {
                continue;
            }
            await analyzeDirectory(fullPath, patterns, endpoints, frameworks);
        }
        else if (entry.isFile() && isSourceFile(entry.name)) {
            analyzeFile(fullPath, patterns, endpoints, frameworks);
        }
    }
}
function shouldSkipDirectory(name) {
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
function isSourceFile(filename) {
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
function analyzeFile(filePath, patterns, endpoints, frameworks) {
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
                }
                else if (framework === 'nestjs') {
                    method = match[2].toUpperCase();
                    endpointPath = match[3];
                }
                else if (framework === 'spring') {
                    method = match[1].replace('Mapping', '').toUpperCase();
                    endpointPath = match[2];
                }
                else if (framework === 'flask') {
                    method = match[1].toUpperCase();
                    endpointPath = match[2];
                }
                const endpoint = {
                    framework,
                    file: filePath,
                    method,
                    path: endpointPath,
                };
                endpoints.push(endpoint);
            }
        }
    }
    catch {
        // Ignore file read errors
    }
}
async function fetchOpenApiEndpoints(proxyUrl) {
    const endpoints = [];
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
                        for (const [method, details] of Object.entries(methods)) {
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
        }
        catch {
            // Continue to next path
        }
    }
    return endpoints;
}
function deduplicateEndpoints(endpoints) {
    const seen = new Set();
    const unique = [];
    for (const endpoint of endpoints) {
        const key = `${endpoint.method}:${endpoint.path}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(endpoint);
        }
    }
    return unique;
}
