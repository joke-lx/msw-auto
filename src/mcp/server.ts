/**
 * MSW Auto MCP Server
 *
 * Provides tools for AI-powered mock server management
 * Tools include: file operations, project analysis, mock generation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { analyzeProject } from './analyzer.js';
import { llmService } from './llm-service.js';
import { ProjectManager } from './project-manager.js';

const projectManager = new ProjectManager();

// Store running mock servers
const runningServers: Map<string, ChildProcess> = new Map();

// Get project root directory
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * MCP Server instance
 */
class MSWAutoMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'msw-auto',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // File operations
          {
            name: 'read_file',
            description: 'Read content of a file',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Absolute or relative path to the file',
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'write_file',
            description: 'Write content to a file (creates or overwrites)',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Absolute or relative path for the file',
                },
                content: {
                  type: 'string',
                  description: 'Content to write to the file',
                },
              },
              required: ['path', 'content'],
            },
          },
          {
            name: 'list_directory',
            description: 'List files and directories',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Directory path to list',
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'create_directory',
            description: 'Create a new directory',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Directory path to create',
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'file_exists',
            description: 'Check if a file or directory exists',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Path to check',
                },
              },
              required: ['path'],
            },
          },
          // Project operations
          {
            name: 'analyze_project',
            description: 'Analyze a project to discover API endpoints',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to the project directory to analyze',
                },
                proxyUrl: {
                  type: 'string',
                  description: 'Optional URL of the frontend service to proxy',
                },
              },
              required: ['projectPath'],
            },
          },
          {
            name: 'generate_mock',
            description: 'Generate mock data for discovered API endpoints using AI',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to the project directory',
                },
                outputPath: {
                  type: 'string',
                  description: 'Output file path for generated mocks',
                },
                endpoints: {
                  type: 'array',
                  description: 'Optional specific endpoints to generate mocks for',
                  items: {
                    type: 'object',
                    properties: {
                      method: { type: 'string' },
                      path: { type: 'string' },
                    },
                  },
                },
              },
              required: ['projectPath'],
            },
          },
          {
            name: 'start_mock_server',
            description: 'Start the mock server for a project',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to the project directory',
                },
                port: {
                  type: 'number',
                  description: 'Port number for the mock server (default: 3001)',
                  default: 3001,
                },
              },
              required: ['projectPath'],
            },
          },
          {
            name: 'list_projects',
            description: 'List all managed projects',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_llm_config',
            description: 'Get current LLM configuration',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'reload_llm_config',
            description: 'Reload LLM configuration from file',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // File operations
          case 'read_file':
            return this.handleReadFile(args);
          case 'write_file':
            return this.handleWriteFile(args);
          case 'list_directory':
            return this.handleListDirectory(args);
          case 'create_directory':
            return this.handleCreateDirectory(args);
          case 'file_exists':
            return this.handleFileExists(args);
          // Project operations
          case 'analyze_project':
            return this.handleAnalyzeProject(args);
          case 'generate_mock':
            return this.handleGenerateMock(args);
          case 'start_mock_server':
            return this.handleStartMockServer(args);
          case 'list_projects':
            return this.handleListProjects();
          case 'get_llm_config':
            return this.handleGetLLMConfig();
          case 'reload_llm_config':
            return this.handleReloadLLMConfig();
          default:
            return {
              content: [{ type: 'text', text: `Unknown tool: ${name}` }],
              isError: true,
            };
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  // File operation handlers
  private handleReadFile(args: any) {
    const { path: filePath } = args;
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      content: [{ type: 'text', text: content }],
    };
  }

  private handleWriteFile(args: any) {
    const { path: filePath, content } = args;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return {
      content: [{ type: 'text', text: `File written: ${filePath}` }],
    };
  }

  private handleListDirectory(args: any) {
    const { path: dirPath } = args;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const result = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
    }));
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }

  private handleCreateDirectory(args: any) {
    const { path: dirPath } = args;
    fs.mkdirSync(dirPath, { recursive: true });
    return {
      content: [{ type: 'text', text: `Directory created: ${dirPath}` }],
    };
  }

  private handleFileExists(args: any) {
    const { path: targetPath } = args;
    const exists = fs.existsSync(targetPath);
    const stat = exists ? fs.statSync(targetPath) : null;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          exists,
          isDirectory: exists ? stat!.isDirectory() : null,
          isFile: exists ? stat!.isFile() : null,
        }, null, 2),
      }],
    };
  }

  private async handleAnalyzeProject(args: any) {
    const { projectPath, proxyUrl } = args;

    const analysis = await analyzeProject(projectPath, proxyUrl);

    // Save project
    if (!projectManager.hasProject(projectPath)) {
      projectManager.addProject({
        name: projectPath.split(/[\\/]/).pop() || 'unnamed',
        path: projectPath,
        proxyUrl,
        endpoints: analysis.endpoints,
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            endpoints: analysis.endpoints.length,
            frameworks: analysis.frameworks,
            summary: analysis.summary,
          }, null, 2),
        },
      ],
    };
  }

  private async handleGenerateMock(args: any) {
    const { projectPath, outputPath, endpoints } = args;

    const project = projectManager.getProject(projectPath);
    if (!project) {
      return {
        content: [{ type: 'text', text: `Project not found: ${projectPath}` }],
        isError: true,
      };
    }

    const endpointsToGenerate = endpoints || project.endpoints;
    if (!endpointsToGenerate?.length) {
      return {
        content: [{ type: 'text', text: 'No endpoints to generate mocks for' }],
        isError: true,
      };
    }

    // Check if LLM is configured
    if (!llmService.isConfigured()) {
      return {
        content: [{
          type: 'text',
          text: 'LLM not configured. Please run: msw-auto setting --apikey YOUR_API_KEY'
        }],
        isError: true,
      };
    }

    // Generate mocks using LLM
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
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update project
    projectManager.updateProject(projectPath, { mocks });

    // Write to file if outputPath provided
    if (outputPath) {
      const content = `// Auto-generated mocks\n${JSON.stringify(mocks, null, 2)}`;
      fs.writeFileSync(outputPath, content, 'utf-8');
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            generated: mocks.length,
            outputPath: outputPath || null,
            mocks: mocks.map(m => ({
              method: m.method,
              path: m.path,
              status: m.status,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private handleStartMockServer(args: any) {
    const { projectPath, port } = args;
    const mockPort = port || 3001;
    const serverKey = projectPath || 'default';

    // Check if server is already running
    if (runningServers.has(serverKey)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              message: `Mock server already running for ${serverKey}`,
              port: mockPort,
              url: `http://localhost:${mockPort}`,
            }, null, 2),
          },
        ],
      };
    }

    // Find the server entry point
    const serverPath = path.resolve(projectRoot, 'src/server/index.ts');

    if (!fs.existsSync(serverPath)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              message: `Server not found at ${serverPath}`,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }

    // Start the mock server
    const serverProcess = spawn('npx', ['tsx', serverPath, '--port', mockPort.toString()], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: mockPort.toString(),
      },
    });

    // Store the process
    runningServers.set(serverKey, serverProcess);

    // Handle process output
    serverProcess.stdout?.on('data', (data) => {
      console.error(`[Mock Server] ${data}`);
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error(`[Mock Server Error] ${data}`);
    });

    serverProcess.on('exit', (code) => {
      runningServers.delete(serverKey);
      console.error(`[Mock Server] Exited with code ${code}`);
    });

    // Give it a moment to start
    setTimeout(() => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Mock server started`,
              port: mockPort,
              url: `http://localhost:${mockPort}`,
            }, null, 2),
          },
        ],
      };
    }, 1000);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Mock server starting...`,
            port: mockPort,
            url: `http://localhost:${mockPort}`,
          }, null, 2),
        },
      ],
    };
  }

  private handleListProjects() {
    const projects = projectManager.listProjects();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            projects: projects.map(p => ({
              name: p.name,
              path: p.path,
              status: p.status,
              endpointCount: p.endpoints?.length || 0,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private handleGetLLMConfig() {
    const config = llmService.getConfig();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            provider: config.provider,
            baseUrl: config.baseUrl,
            model: config.model,
            configured: !!config.apiKey,
          }, null, 2),
        },
      ],
    };
  }

  private handleReloadLLMConfig() {
    llmService.reload();
    const config = llmService.getConfig();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            config: {
              provider: config.provider,
              baseUrl: config.baseUrl,
              model: config.model,
            },
          }, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MSW Auto MCP Server running on stdio');
  }
}

// Run the server
const server = new MSWAutoMCPServer();
server.run().catch(console.error);
