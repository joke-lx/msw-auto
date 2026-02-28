/**
 * MCP Client
 *
 * Provides a client to connect to Claude Code or other MCP-compatible AI tools
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
export interface MCPClientConfig {
    command?: string;
    args?: string[];
}
/**
 * Create an MCP client to connect to the MSW Auto MCP server
 */
export declare function createMCPClient(config?: MCPClientConfig): Client;
/**
 * Connect to the MCP server and run a tool
 */
export declare function runTool(toolName: string, args: Record<string, any>): Promise<any>;
/**
 * Example: List available tools
 */
export declare function listTools(): Promise<any>;
