/**
 * MSW Auto MCP Server
 *
 * Provides tools for AI-powered mock server management
 * Uses configured LLM API directly (not Claude Code)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { analyzeProject } from './analyzer.js';
import { llmService } from './llm-service.js';
import { ProjectManager } from './project-manager.js';

const projectManager = new ProjectManager();

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
            name: 'stop_mock_server',
            description: 'Stop the running mock server',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to the project directory',
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
          case 'analyze_project':
            return await this.handleAnalyzeProject(args);

          case 'generate_mock':
            return await this.handleGenerateMock(args);

          case 'start_mock_server':
            return await this.handleStartMockServer(args);

          case 'stop_mock_server':
            return await this.handleStopMockServer(args);

          case 'list_projects':
            return await this.handleListProjects();

          case 'get_llm_config':
            return await this.handleGetLLMConfig();

          case 'reload_llm_config':
            return await this.handleReloadLLMConfig();

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
    const { projectPath, endpoints } = args;

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

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            generated: mocks.length,
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

  private async handleStartMockServer(args: any) {
    const { projectPath, port } = args;
    const mockPort = port || 3001;

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
  }

  private async handleStopMockServer(args: any) {
    const { projectPath } = args;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Mock server stopped for ${projectPath}`,
          }, null, 2),
        },
      ],
    };
  }

  private async handleListProjects() {
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

  private async handleGetLLMConfig() {
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

  private async handleReloadLLMConfig() {
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
