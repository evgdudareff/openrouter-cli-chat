import { OpenRouter } from '@openrouter/sdk';

export class OpenRouterClient {
  client: OpenRouter;
  model: string;

  constructor(model: string = 'meta-llama/llama-3.2-3b-instruct:free') {
    this.client = new OpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    this.model = model;
  }

  async sendMessage(inputStr: string) {
    const response = await this.client.chat.send({
      model: this.model,
      messages: [
        {
          role: 'user',
          content: inputStr,
        },
      ],
      stream: false,
    });
    return response.choices[0].message.content;
  }
}
