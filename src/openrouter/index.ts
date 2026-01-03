import { OpenRouter } from '@openrouter/sdk';
import { MessageParam } from '../mcp-clients/types';
import { ToolDefinitionJson } from '@openrouter/sdk/esm/models';

export class OpenRouterClient {
  client: OpenRouter;
  model: string;

  constructor(model: string = 'meta-llama/llama-3.2-3b-instruct:free') {
    this.client = new OpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    this.model = model;
  }

  async sendMessage(
    messages: MessageParam[],
    tools: ToolDefinitionJson[] = []
  ) {
    return await this.client.chat.send({
      model: this.model,
      messages,
      tools,
    });
  }
}
