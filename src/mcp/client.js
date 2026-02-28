/**
 * MCP Client
 *
 * Provides a client to connect to Claude Code or other MCP-compatible AI tools
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
/**
 * Create an MCP client to connect to the MSW Auto MCP server
 */
export function createMCPClient(config = {}) {
    const command = config.command || 'node';
    const args = config.args || ['src/mcp/server.ts'];
    const transport = new StdioClientTransport({
        command,
        args,
    });
    const client = new Client({
        name: 'msw-auto-client',
        version: '1.0.0',
    }, {
        capabilities: {},
    });
    return { client, transport };
}
/**
 * Connect to the MCP server and run a tool
 */
export async function runTool(toolName, args) {
    const { client, transport } = createMCPClient();
    try {
        await client.connect(transport);
        const result = await client.callTool({
            name: toolName,
            arguments: args,
        });
        return result;
    }
    finally {
        await client.close();
    }
}
/**
 * Example: List available tools
 */
export async function listTools() {
    const { client, transport } = createMCPClient();
    try {
        await client.connect(transport);
        const result = await client.listTools();
        return result;
    }
    finally {
        await client.close();
    }
}
