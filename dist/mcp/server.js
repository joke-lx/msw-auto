// src/mcp/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import * as fs4 from "fs";
import * as path4 from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

// src/mcp/analyzer.js
import * as fs from "fs";
import * as path from "path";
async function analyzeProject(projectPath, proxyUrl) {
  const endpoints = [];
  const frameworks = [];
  const patterns = [
    // Express routes
    { pattern: /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g, framework: "express" },
    // Fastify routes
    { pattern: /fastify\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g, framework: "fastify" },
    // Koa routes
    { pattern: /router\.(get|post|put|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g, framework: "koa" },
    // Next.js API routes
    { pattern: /export\s+(default\s+)?(async\s+)?function\s+\w+\s*\(\s*req|handler\s*=/g, framework: "nextjs", path: "pages/api" },
    // NestJS controllers
    { pattern: /@\((['"`])[^'"`]+['"`]\)\s*\s*@(Get|Post|Put|Patch|Delete|Delete)\s*\(['"`]([^'"`]+)['"`]/g, framework: "nestjs" },
    // Spring Boot
    { pattern: /@(GetMapping|PostMapping|PutMapping|DeleteMapping|RequestMapping)\s*\(\s*value\s*=\s*['"`]([^'"`]+)['"`]/g, framework: "spring" },
    // Flask
    { pattern: /@(app\.)?(get|post|put|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g, framework: "flask" },
    // Django
    { pattern: /path\s*\(\s*['"`]([^'"`]+)['"`]/g, framework: "django" }
  ];
  await analyzeDirectory(projectPath, patterns, endpoints, frameworks);
  if (proxyUrl) {
    try {
      const openApiEndpoints = await fetchOpenApiEndpoints(proxyUrl);
      endpoints.push(...openApiEndpoints);
    } catch {
    }
  }
  const uniqueEndpoints = deduplicateEndpoints(endpoints);
  return {
    endpoints: uniqueEndpoints,
    frameworks: [...new Set(frameworks)],
    summary: `Found ${uniqueEndpoints.length} API endpoints across ${frameworks.length} framework(s)`
  };
}
async function analyzeDirectory(dirPath, patterns, endpoints, frameworks) {
  if (!fs.existsSync(dirPath))
    return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
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
function shouldSkipDirectory(name) {
  const skipDirs = [
    "node_modules",
    "dist",
    "build",
    ".git",
    ".next",
    ".nuxt",
    "coverage",
    "__pycache__",
    "venv",
    ".venv",
    "vendor"
  ];
  return skipDirs.includes(name);
}
function isSourceFile(filename) {
  const sourceExtensions = [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".java",
    ".go",
    ".rs",
    ".rb",
    ".php"
  ];
  return sourceExtensions.some((ext) => filename.endsWith(ext));
}
function analyzeFile(filePath, patterns, endpoints, frameworks) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const { pattern, framework } of patterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(content)) !== null) {
        frameworks.push(framework);
        let method = "GET";
        let endpointPath = match[0];
        if (framework === "express" || framework === "fastify" || framework === "koa") {
          method = match[1].toUpperCase();
          endpointPath = match[2];
        } else if (framework === "nestjs") {
          method = match[2].toUpperCase();
          endpointPath = match[3];
        } else if (framework === "spring") {
          method = match[1].replace("Mapping", "").toUpperCase();
          endpointPath = match[2];
        } else if (framework === "flask") {
          method = match[1].toUpperCase();
          endpointPath = match[2];
        }
        const endpoint = {
          framework,
          file: filePath,
          method,
          path: endpointPath
        };
        endpoints.push(endpoint);
      }
    }
  } catch {
  }
}
async function fetchOpenApiEndpoints(proxyUrl) {
  const endpoints = [];
  const openApiPaths = [
    "/api-docs",
    "/swagger.json",
    "/swagger/v1/swagger.json",
    "/openapi.json",
    "/api/openapi.json",
    "/api/v1/api-docs"
  ];
  for (const openApiPath of openApiPaths) {
    try {
      const response = await fetch(`${proxyUrl}${openApiPath}`, {
        signal: AbortSignal.timeout(5e3)
      });
      if (response.ok) {
        const spec = await response.json();
        if (spec.paths) {
          for (const [path5, methods] of Object.entries(spec.paths)) {
            for (const [method, details] of Object.entries(methods)) {
              if (["get", "post", "put", "patch", "delete", "options", "head"].includes(method)) {
                endpoints.push({
                  method: method.toUpperCase(),
                  path: path5,
                  framework: "openapi"
                });
              }
            }
          }
        }
        break;
      }
    } catch {
    }
  }
  return endpoints;
}
function deduplicateEndpoints(endpoints) {
  const seen = /* @__PURE__ */ new Set();
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

// src/mcp/llm-service.js
import Anthropic from "@anthropic-ai/sdk";
import * as fs2 from "fs";
import * as path2 from "path";
import * as os from "os";
function getLLMConfig() {
  const isCI = process.env.CI || process.env.GITHUB_ACTIONS;
  const baseDir = isCI ? process.env.TMPDIR || "/tmp" : os.homedir();
  const configPath = path2.join(baseDir, ".msw-auto", "config.json");
  const defaultConfig = {
    provider: "anthropic",
    baseUrl: "https://api.anthropic.com",
    apiKey: "",
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.7,
    maxTokens: 4096
  };
  try {
    if (fs2.existsSync(configPath)) {
      const data = JSON.parse(fs2.readFileSync(configPath, "utf-8"));
      return { ...defaultConfig, ...data.llm };
    }
  } catch {
  }
  return defaultConfig;
}
var LLMService = class {
  config;
  anthropic;
  constructor() {
    this.config = getLLMConfig();
    if (this.config.provider === "anthropic") {
      this.anthropic = new Anthropic({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl !== "https://api.anthropic.com" ? this.config.baseUrl : void 0
      });
    }
  }
  /**
   * Reload config
   */
  reload() {
    this.config = getLLMConfig();
    if (this.config.provider === "anthropic") {
      this.anthropic = new Anthropic({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl !== "https://api.anthropic.com" ? this.config.baseUrl : void 0
      });
    }
  }
  /**
   * Check if LLM is configured
   */
  isConfigured() {
    return !!this.config.apiKey;
  }
  /**
   * Send message to LLM
   */
  async sendMessage(system, user) {
    if (!this.isConfigured()) {
      throw new Error("LLM API key not configured. Run: msw-auto setting --apikey YOUR_KEY");
    }
    if (this.config.provider === "anthropic") {
      return this.sendAnthropicMessage(system, user);
    }
    return this.sendOpenAICompatibleMessage(system, user);
  }
  async sendAnthropicMessage(system, user) {
    const message = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens || 4096,
      temperature: this.config.temperature || 0.7,
      system: [{ type: "text", text: system }],
      messages: [{ role: "user", content: [{ type: "text", text: user }] }]
    });
    return message.content[0]?.text || "";
  }
  async sendOpenAICompatibleMessage(system, user) {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 4096,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${error}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }
  /**
   * Generate mock data for an endpoint
   */
  async generateMock(method, endpointPath, context) {
    const system = `\u4F60\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684 Mock \u6570\u636E\u751F\u6210\u4E13\u5BB6\u3002\u6839\u636E API \u7AEF\u70B9\u4FE1\u606F\u751F\u6210\u7B26\u5408\u4E1A\u52A1\u903B\u8F91\u7684 JSON \u54CD\u5E94\u6570\u636E\u3002`;
    const user = `\u8BF7\u4E3A\u4EE5\u4E0B API \u7AEF\u70B9\u751F\u6210 Mock \u54CD\u5E94\u6570\u636E\uFF1A

\u65B9\u6CD5: ${method}
\u8DEF\u5F84: ${endpointPath}
${context ? `\u4E1A\u52A1\u4E0A\u4E0B\u6587: ${context}` : ""}

\u8BF7\u53EA\u8FD4\u56DE JSON \u6570\u636E\uFF0C\u4E0D\u8981\u5176\u4ED6\u89E3\u91CA\u3002`;
    const response = await this.sendMessage(system, user);
    try {
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) || response.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
      return JSON.parse(jsonStr);
    } catch {
      return { message: response };
    }
  }
  /**
   * Get current config
   */
  getConfig() {
    return this.config;
  }
};
var llmService = new LLMService();

// src/mcp/project-manager.js
import * as fs3 from "fs";
import * as path3 from "path";
import * as os2 from "os";
var ProjectManager = class {
  configPath;
  projects;
  constructor() {
    const isCI = process.env.CI || process.env.GITHUB_ACTIONS;
    const baseDir = isCI ? process.env.TMPDIR || "/tmp" : os2.homedir();
    this.configPath = path3.join(baseDir, ".msw-auto", "config.json");
    this.projects = /* @__PURE__ */ new Map();
    this.load();
  }
  /**
   * Load projects from config file
   */
  load() {
    try {
      if (fs3.existsSync(this.configPath)) {
        const data = JSON.parse(fs3.readFileSync(this.configPath, "utf-8"));
        for (const [name, project] of Object.entries(data.projects)) {
          this.projects.set(project.path, project);
        }
      }
    } catch {
    }
  }
  /**
   * Save projects to config file
   */
  save() {
    const dir = path3.dirname(this.configPath);
    if (!fs3.existsSync(dir)) {
      fs3.mkdirSync(dir, { recursive: true });
    }
    const data = {
      projects: Object.fromEntries(this.projects)
    };
    fs3.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
  }
  /**
   * Add a new project
   */
  addProject(project) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newProject = {
      ...project,
      status: "stopped",
      createdAt: now,
      updatedAt: now
    };
    this.projects.set(project.path, newProject);
    this.save();
  }
  /**
   * Remove a project
   */
  removeProject(projectPath) {
    this.projects.delete(projectPath);
    this.save();
  }
  /**
   * Get a project by path
   */
  getProject(projectPath) {
    return this.projects.get(projectPath);
  }
  /**
   * Check if a project exists
   */
  hasProject(projectPath) {
    return this.projects.has(projectPath);
  }
  /**
   * Update a project
   */
  updateProject(projectPath, updates) {
    const project = this.projects.get(projectPath);
    if (project) {
      Object.assign(project, updates, { updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
      this.save();
    }
  }
  /**
   * List all projects
   */
  listProjects() {
    return Array.from(this.projects.values());
  }
  /**
   * Set project status
   */
  setProjectStatus(projectPath, status) {
    const project = this.projects.get(projectPath);
    if (project) {
      project.status = status;
      project.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.save();
    }
  }
  /**
   * Get the config file path
   */
  getConfigPath() {
    return this.configPath;
  }
};

// src/mcp/server.ts
var projectManager = new ProjectManager();
var runningServers = /* @__PURE__ */ new Map();
var projectRoot = path4.resolve(path4.dirname(fileURLToPath(import.meta.url)), "../..");
var MSWAutoMCPServer = class {
  server;
  constructor() {
    this.server = new Server(
      {
        name: "msw-auto",
        version: "1.0.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    this.setupHandlers();
  }
  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // File operations
          {
            name: "read_file",
            description: "Read content of a file",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Absolute or relative path to the file"
                }
              },
              required: ["path"]
            }
          },
          {
            name: "write_file",
            description: "Write content to a file (creates or overwrites)",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Absolute or relative path for the file"
                },
                content: {
                  type: "string",
                  description: "Content to write to the file"
                }
              },
              required: ["path", "content"]
            }
          },
          {
            name: "list_directory",
            description: "List files and directories",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Directory path to list"
                }
              },
              required: ["path"]
            }
          },
          {
            name: "create_directory",
            description: "Create a new directory",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Directory path to create"
                }
              },
              required: ["path"]
            }
          },
          {
            name: "file_exists",
            description: "Check if a file or directory exists",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to check"
                }
              },
              required: ["path"]
            }
          },
          // Project operations
          {
            name: "analyze_project",
            description: "Analyze a project to discover API endpoints",
            inputSchema: {
              type: "object",
              properties: {
                projectPath: {
                  type: "string",
                  description: "Path to the project directory to analyze"
                },
                proxyUrl: {
                  type: "string",
                  description: "Optional URL of the frontend service to proxy"
                }
              },
              required: ["projectPath"]
            }
          },
          {
            name: "generate_mock",
            description: "Generate mock data for discovered API endpoints using AI",
            inputSchema: {
              type: "object",
              properties: {
                projectPath: {
                  type: "string",
                  description: "Path to the project directory"
                },
                outputPath: {
                  type: "string",
                  description: "Output file path for generated mocks"
                },
                endpoints: {
                  type: "array",
                  description: "Optional specific endpoints to generate mocks for",
                  items: {
                    type: "object",
                    properties: {
                      method: { type: "string" },
                      path: { type: "string" }
                    }
                  }
                }
              },
              required: ["projectPath"]
            }
          },
          {
            name: "start_mock_server",
            description: "Start the mock server for a project",
            inputSchema: {
              type: "object",
              properties: {
                projectPath: {
                  type: "string",
                  description: "Path to the project directory"
                },
                port: {
                  type: "number",
                  description: "Port number for the mock server (default: 3001)",
                  default: 3001
                }
              },
              required: ["projectPath"]
            }
          },
          {
            name: "list_projects",
            description: "List all managed projects",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "get_llm_config",
            description: "Get current LLM configuration",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "reload_llm_config",
            description: "Reload LLM configuration from file",
            inputSchema: {
              type: "object",
              properties: {}
            }
          }
        ]
      };
    });
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        switch (name) {
          // File operations
          case "read_file":
            return this.handleReadFile(args);
          case "write_file":
            return this.handleWriteFile(args);
          case "list_directory":
            return this.handleListDirectory(args);
          case "create_directory":
            return this.handleCreateDirectory(args);
          case "file_exists":
            return this.handleFileExists(args);
          // Project operations
          case "analyze_project":
            return this.handleAnalyzeProject(args);
          case "generate_mock":
            return this.handleGenerateMock(args);
          case "start_mock_server":
            return this.handleStartMockServer(args);
          case "list_projects":
            return this.handleListProjects();
          case "get_llm_config":
            return this.handleGetLLMConfig();
          case "reload_llm_config":
            return this.handleReloadLLMConfig();
          default:
            return {
              content: [{ type: "text", text: `Unknown tool: ${name}` }],
              isError: true
            };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    });
  }
  // File operation handlers
  handleReadFile(args) {
    const { path: filePath } = args;
    const content = fs4.readFileSync(filePath, "utf-8");
    return {
      content: [{ type: "text", text: content }]
    };
  }
  handleWriteFile(args) {
    const { path: filePath, content } = args;
    const dir = path4.dirname(filePath);
    if (!fs4.existsSync(dir)) {
      fs4.mkdirSync(dir, { recursive: true });
    }
    fs4.writeFileSync(filePath, content, "utf-8");
    return {
      content: [{ type: "text", text: `File written: ${filePath}` }]
    };
  }
  handleListDirectory(args) {
    const { path: dirPath } = args;
    const entries = fs4.readdirSync(dirPath, { withFileTypes: true });
    const result = entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file"
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
  handleCreateDirectory(args) {
    const { path: dirPath } = args;
    fs4.mkdirSync(dirPath, { recursive: true });
    return {
      content: [{ type: "text", text: `Directory created: ${dirPath}` }]
    };
  }
  handleFileExists(args) {
    const { path: targetPath } = args;
    const exists = fs4.existsSync(targetPath);
    const stat = exists ? fs4.statSync(targetPath) : null;
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          exists,
          isDirectory: exists ? stat.isDirectory() : null,
          isFile: exists ? stat.isFile() : null
        }, null, 2)
      }]
    };
  }
  async handleAnalyzeProject(args) {
    const { projectPath, proxyUrl } = args;
    const analysis = await analyzeProject(projectPath, proxyUrl);
    if (!projectManager.hasProject(projectPath)) {
      projectManager.addProject({
        name: projectPath.split(/[\\/]/).pop() || "unnamed",
        path: projectPath,
        proxyUrl,
        endpoints: analysis.endpoints
      });
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            endpoints: analysis.endpoints.length,
            frameworks: analysis.frameworks,
            summary: analysis.summary
          }, null, 2)
        }
      ]
    };
  }
  async handleGenerateMock(args) {
    const { projectPath, outputPath, endpoints } = args;
    const project = projectManager.getProject(projectPath);
    if (!project) {
      return {
        content: [{ type: "text", text: `Project not found: ${projectPath}` }],
        isError: true
      };
    }
    const endpointsToGenerate = endpoints || project.endpoints;
    if (!endpointsToGenerate?.length) {
      return {
        content: [{ type: "text", text: "No endpoints to generate mocks for" }],
        isError: true
      };
    }
    if (!llmService.isConfigured()) {
      return {
        content: [{
          type: "text",
          text: "LLM not configured. Please run: msw-auto setting --apikey YOUR_API_KEY"
        }],
        isError: true
      };
    }
    const mocks = [];
    for (const endpoint of endpointsToGenerate) {
      const mockData = await llmService.generateMock(
        endpoint.method,
        endpoint.path
      );
      mocks.push({
        method: endpoint.method,
        path: endpoint.path,
        status: 200,
        response: mockData,
        headers: { "Content-Type": "application/json" }
      });
    }
    projectManager.updateProject(projectPath, { mocks });
    if (outputPath) {
      const content = `// Auto-generated mocks
${JSON.stringify(mocks, null, 2)}`;
      fs4.writeFileSync(outputPath, content, "utf-8");
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            generated: mocks.length,
            outputPath: outputPath || null,
            mocks: mocks.map((m) => ({
              method: m.method,
              path: m.path,
              status: m.status
            }))
          }, null, 2)
        }
      ]
    };
  }
  handleStartMockServer(args) {
    const { projectPath, port } = args;
    const mockPort = port || 3001;
    const serverKey = projectPath || "default";
    if (runningServers.has(serverKey)) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: `Mock server already running for ${serverKey}`,
              port: mockPort,
              url: `http://localhost:${mockPort}`
            }, null, 2)
          }
        ]
      };
    }
    const serverPath = path4.resolve(projectRoot, "src/server/index.ts");
    if (!fs4.existsSync(serverPath)) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              message: `Server not found at ${serverPath}`
            }, null, 2)
          }
        ],
        isError: true
      };
    }
    const serverProcess = spawn("npx", ["tsx", serverPath, "--port", mockPort.toString()], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PORT: mockPort.toString()
      }
    });
    runningServers.set(serverKey, serverProcess);
    serverProcess.stdout?.on("data", (data) => {
      console.error(`[Mock Server] ${data}`);
    });
    serverProcess.stderr?.on("data", (data) => {
      console.error(`[Mock Server Error] ${data}`);
    });
    serverProcess.on("exit", (code) => {
      runningServers.delete(serverKey);
      console.error(`[Mock Server] Exited with code ${code}`);
    });
    setTimeout(() => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Mock server started`,
              port: mockPort,
              url: `http://localhost:${mockPort}`
            }, null, 2)
          }
        ]
      };
    }, 1e3);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Mock server starting...`,
            port: mockPort,
            url: `http://localhost:${mockPort}`
          }, null, 2)
        }
      ]
    };
  }
  handleListProjects() {
    const projects = projectManager.listProjects();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            projects: projects.map((p) => ({
              name: p.name,
              path: p.path,
              status: p.status,
              endpointCount: p.endpoints?.length || 0
            }))
          }, null, 2)
        }
      ]
    };
  }
  handleGetLLMConfig() {
    const config = llmService.getConfig();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            provider: config.provider,
            baseUrl: config.baseUrl,
            model: config.model,
            configured: !!config.apiKey
          }, null, 2)
        }
      ]
    };
  }
  handleReloadLLMConfig() {
    llmService.reload();
    const config = llmService.getConfig();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            config: {
              provider: config.provider,
              baseUrl: config.baseUrl,
              model: config.model
            }
          }, null, 2)
        }
      ]
    };
  }
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("MSW Auto MCP Server running on stdio");
  }
};
var server = new MSWAutoMCPServer();
server.run().catch(console.error);
//# sourceMappingURL=server.js.map