import * as vscode from 'vscode';
import { Client as MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import { CallToolRequest, Tool } from "@modelcontextprotocol/sdk/types.js";
import { Logger } from '../utils/Logger';

/**
 * A proxy tool that forwards calls to an MCP tool.
 * Implements the VSCode LanguageModelChatTool interface to bridge
 * MCP tools with VSCode's language model API.
 */
export class McpProxyTool implements vscode.LanguageModelChatTool {
    private _client: MCPClient;
    private _tool: Tool;
    private logger: Logger;
    private _serverName: string;
    private _allServerNames?: string[];
    public name: string;
    public inputSchema: Tool['inputSchema'];
    public description: string;
    public tags: string[];

    constructor(client: MCPClient, tool: Tool, serverName?: string, allServerNames?: string[]) {
        this._client = client;
        this._tool = tool;
        this._serverName = serverName || client.getServerVersion()?.name || 'unknown';
        this._allServerNames = allServerNames;
        this.name = tool.name;
        this.inputSchema = tool.inputSchema;
        this.description = tool.description || '';
        this.tags = ['mcpsx', this._serverName];
        this.logger = Logger.getInstance();

        this.logger.log(`Created McpProxyTool: ${this.name} (server: ${this._serverName})`);
    }

    async prepareInvocation(options: vscode.LanguageModelToolInvocationOptions<any>): Promise<{ confirmationMessage?: string; invocationMessage?: string }> {
        return {
            confirmationMessage: `Allow tool "${this._tool.name}" from server "${this._serverName}" to run?`,
            invocationMessage: `Running "${this._tool.name}" on ${this._serverName}...`
        };
    }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<any>, token: vscode.CancellationToken): Promise<vscode.LanguageModelToolResult> {
        this.logger.log(`Invoking tool: ${this.name} on server: ${this._serverName}`);

        // Check for cancellation
        if (token.isCancellationRequested) {
            throw new Error(`Tool invocation cancelled: ${this._tool.name}`);
        }

        // Process input to replace placeholders
        const processedInput = this._processInput(options.input);

        try {
            const payload: CallToolRequest["params"] = {
                name: this._tool.name,
                arguments: processedInput
            };

            // Set up cancellation handler
            const abortController = new AbortController();
            const cancellationListener = token.onCancellationRequested(() => {
                abortController.abort();
            });

            try {
                const result = await this._client.callTool(payload);

                if (result.error) {
                    const errorDetails = typeof result.error === 'object'
                        ? JSON.stringify(result.error)
                        : String(result.error);
                    throw new Error(`Tool execution error: ${errorDetails}`);
                }

                // Convert MCP result to LanguageModelToolResult
                const content: (vscode.LanguageModelTextPart | vscode.LanguageModelPromptTsxPart)[] = [];

                if (Array.isArray(result.content)) {
                    for (const item of result.content) {
                        if (item.type === 'text' && typeof item.text === 'string') {
                            content.push(new vscode.LanguageModelTextPart(item.text));
                        } else if (item.type === 'image' && 'data' in item) {
                            // Handle image content by providing a text description
                            content.push(new vscode.LanguageModelTextPart(`[Image content returned: ${(item as any).mimeType || 'image'}]`));
                        }
                    }
                } else if (result.content) {
                    content.push(new vscode.LanguageModelTextPart(String(result.content)));
                }

                if (content.length === 0) {
                    content.push(new vscode.LanguageModelTextPart('Tool executed successfully but returned no content.'));
                }

                return new vscode.LanguageModelToolResult(content);
            } finally {
                cancellationListener.dispose();
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            // Provide user-friendly error messages
            let userMessage = `Tool "${this._tool.name}" failed`;
            if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
                userMessage = `Unable to connect to server "${this._serverName}". Please check if the server is running.`;
            } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
                userMessage = `Request to "${this._serverName}" timed out. The server may be overloaded or unresponsive.`;
            } else if (errorMessage.includes('cancelled') || errorMessage.includes('aborted')) {
                userMessage = `Tool invocation was cancelled.`;
            } else {
                userMessage = `${userMessage}: ${errorMessage}`;
            }

            this.logger.error(`Tool invocation error for ${this.name}: ${errorMessage}`);
            throw new Error(userMessage);
        }
    }
    
    /**
     * Process input arguments to replace placeholders
     * @param input The input arguments
     * @returns The processed input with placeholders replaced
     */
    private _processInput(input: any): any {
        if (!input) { return input; }
        
        // Define placeholders and their replacements
        const placeholders: Record<string, string> = {};
        
        // Add standard references
        placeholders['@mcp'] = 'MCP';
        placeholders['@mcps'] = 'MCP Servers';
        placeholders['@tool'] = 'Tool';
        placeholders['@tools'] = 'Tools';
        
        // Add the current server as a placeholder
        const serverPlaceholder = `@${this._serverName.toLowerCase().replace(/\s+/g, '')}`;
        placeholders[serverPlaceholder] = this._serverName;
        
        // Add all other servers as placeholders if provided
        if (this._allServerNames && Array.isArray(this._allServerNames)) {
            for (const name of this._allServerNames) {
                // Only add if not the current server (already added above)
                if (name !== this._serverName) {
                    const placeholder = `@${name.toLowerCase().replace(/\s+/g, '')}`;
                    placeholders[placeholder] = name;
                }
            }
        }
        
        // Helper function to replace placeholders in strings
        const replacePlaceholders = (text: string): string => {
            if (typeof text !== 'string') { return text; }
            
            let result = text;
            for (const [placeholder, value] of Object.entries(placeholders)) {
                result = result.replace(new RegExp(placeholder + '\\b', 'g'), value);
            }
            return result;
        };
        
        // Process different types of input
        if (typeof input === 'string') {
            return replacePlaceholders(input);
        } else if (Array.isArray(input)) {
            return input.map(item => this._processInput(item));
        } else if (typeof input === 'object' && input !== null) {
            const result: Record<string, any> = {};
            for (const [key, value] of Object.entries(input)) {
                result[key] = this._processInput(value);
            }
            return result;
        }
        
        return input;
    }
}