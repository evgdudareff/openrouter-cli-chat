import { config } from 'dotenv';

import { OpenRouter } from '@openrouter/sdk';

config();

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

try {
  const response = await openrouter.chat.send({
    model: 'meta-llama/llama-3.2-3b-instruct:free',
    messages: [
      {
        role: 'user',
        content: 'What is the meaning of life?',
      },
    ],
    stream: false,
  });
  console.log(response);
  console.log(response.choices[0].message.content);
} catch (error) {
  console.log(error);
}
