import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { OpenRouterClient } from '../openrouter';
import { MessageParam, Tool } from './types';
import readline from 'readline/promises';
import { ToolDefinitionJson } from '@openrouter/sdk/esm/models';

interface Prompt {
  name: string;
  description?: string;
}

export class MCPClient {
  private mcp: Client;
  private llmClient: OpenRouterClient;
  private transport: StdioClientTransport | null = null;
  private tools: Tool[] = [];
  private prompts: Prompt[] = [];

  constructor() {
    this.llmClient = new OpenRouterClient(
      'mistralai/mistral-small-3.1-24b-instruct:free'
    );
    this.mcp = new Client({ name: 'mcp-client-cli', version: '1.0.0' });
  }

  async connectToServer(serverScriptPath: string) {
    try {
      const isJs = serverScriptPath.endsWith('.js');
      const isTs = serverScriptPath.endsWith('.ts');
      if (!isJs && !isTs) {
        throw new Error('Server script must be a .js or .ts file');
      }

      this.transport = new StdioClientTransport({
        command: process.execPath,
        args: [serverScriptPath],
      });
      await this.mcp.connect(this.transport);

      const toolsResult = await this.mcp.listTools();
      this.tools = toolsResult.tools.map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        };
      });
      console.log(
        'Connected to server with tools:',
        this.tools.map(({ name }) => name)
      );

      // Загрузить доступные промпты
      await this.loadPrompts();
    } catch (e) {
      console.log('Failed to connect to MCP server: ', e);
      throw e;
    }
  }

  async loadPrompts() {
    try {
      const promptsResult = await this.mcp.listPrompts();
      this.prompts = promptsResult.prompts.map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
      }));
      if (this.prompts.length > 0) {
        console.log(
          'Available prompts:',
          this.prompts.map(({ name }) => name)
        );
      }
    } catch (e) {
      console.log('Failed to load prompts:', e);
    }
  }

  async getPrompt(promptName: string, args: Record<string, string>) {
    try {
      return await this.mcp.getPrompt({
        name: promptName,
        arguments: args,
      });
    } catch (e) {
      console.error(`Failed to get prompt ${promptName}:`, e);
      throw e;
    }
  }

  async processQuery(query: string) {
    const messages: MessageParam[] = [
      {
        role: 'user',
        content: query,
      },
    ];

    const finalText = [];

    const tools: ToolDefinitionJson[] = this.tools.map((tool) => {
      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      };
    });
    const response = await this.llmClient.sendMessage(messages, tools);
    const responseChatMessage = response.choices[0].message;
    const isToolCall = responseChatMessage.toolCalls?.length;
    const isText = typeof responseChatMessage.content === 'string';

    if (isToolCall) {
      const askedTools = responseChatMessage.toolCalls || [];
      for (const tool of askedTools) {
        const toolName = tool.function.name;
        const toolArgs = this.parseToolArguments(tool.function.arguments);

        const result = await this.mcp.callTool({
          name: toolName,
          arguments: toolArgs,
        });
        finalText.push(
          `[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`
        );

        messages.push({
          role: 'user',
          content: result.content as string,
        });

        const response = await this.llmClient.sendMessage(messages);
        const content = response.choices[0].message.content;
        finalText.push(typeof content === 'string' ? content : '');
      }
    } else if (isText) {
      finalText.push(responseChatMessage.content);
    } else {
      console.error('Failed to process query: ', query);
    }

    return finalText.join('\n');
  }

  async chatLoop() {
    const rl = readline.createInterface(process.stdin, process.stdout);

    try {
      console.log('\nMCP Client Started!');
      console.log('Commands:');
      console.log(
        '  /prompt <name> <arg1=value1> [arg2=value2] - Use a prompt'
      );
      console.log('  exit - Exit the chat\n');

      while (true) {
        const userQuery = await rl.question(
          '> Введите ваш вопрос к LLM или exit, чтобы закончить.\n'
        );

        if (userQuery.toLowerCase() === 'exit') {
          console.log('closing...');
          break;
        }

        if (userQuery.startsWith('/prompt ')) {
          const promptCommand = userQuery.substring(8).trim();
          const [promptName, ...argStrings] = promptCommand.split(' ');

          const args: Record<string, string> = {};
          for (const argStr of argStrings) {
            const [key, value] = argStr.split('=');
            if (key && value) {
              args[key] = value;
            }
          }

          try {
            const promptResult = await this.getPrompt(promptName, args);
            const firstMessage = promptResult.messages[0];
            let promptText = '';

            if (
              firstMessage.content &&
              typeof firstMessage.content === 'object'
            ) {
              const content = firstMessage.content as Record<string, unknown>;
              promptText = (content.text as string) || '';
            }

            const response = await this.processQuery(promptText);
            console.log('\n' + response);
          } catch (error) {
            console.error('Error executing prompt:', error);
          }
          continue;
        }

        const response = await this.processQuery(userQuery);
        console.log('\n' + response);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error('something went wrong');
      }
    } finally {
      rl.close();
    }
  }

  async cleanup() {
    await this.mcp.close();
  }

  parseToolArguments(argumentsStr: string): Record<string, unknown> {
    if (!argumentsStr) return {};

    try {
      return JSON.parse(argumentsStr);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      // Попытка исправить распространенные ошибки
      const cleaned = this.cleanJsonString(argumentsStr);

      try {
        return JSON.parse(cleaned);
      } catch (e) {
        console.error('Failed to parse tool arguments:', {
          original: argumentsStr,
          cleaned,
          error: (e as Error).message,
        });
        return {};
      }
    }
  }

  cleanJsonString(jsonStr: string): string {
    let cleaned = jsonStr.trim();

    // Убираем лишние скобки в начале и конце
    if (cleaned.startsWith('{}{')) {
      cleaned = cleaned.substring(2); // Убираем {} в начале
    }

    if (cleaned.startsWith('"{') && cleaned.endsWith('}"')) {
      cleaned = cleaned.substring(1, cleaned.length - 1); // Убираем кавычки
    }

    // Заменяем некорректные символы
    cleaned = cleaned
      .replace(/“/g, '"') // Заменяем "умные" кавычки
      .replace(/”/g, '"')
      .replace(/‘/g, "'")
      .replace(/’/g, "'")
      .replace(/\n/g, ' ') // Убираем переносы строк
      .replace(/\\"/g, '"') // Исправляем экранирование
      .replace(/\\\\/g, '\\');

    // Проверяем баланс скобок
    const openBraces = (cleaned.match(/{/g) || []).length;
    const closeBraces = (cleaned.match(/}/g) || []).length;

    if (openBraces > closeBraces) {
      cleaned += '}'.repeat(openBraces - closeBraces);
    }

    return cleaned;
  }
}
