import { config } from 'dotenv';
import { MCPClient } from './mcp-clients';

config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY is not set');
}

const pathToServerScript = 'dist/mcp-servers/file-mcp-server/index.js';

async function main() {
  const mcpClient = new MCPClient();
  try {
    await mcpClient.connectToServer(pathToServerScript);
    await mcpClient.chatLoop();
  } catch (e) {
    console.error('Error:', e);
    await mcpClient.cleanup();
    process.exit(1);
  } finally {
    await mcpClient.cleanup();
    process.exit(0);
  }
}

main();

//вызови get_user_docs с favorite-books.txt
// что находится в файле favorite-books.txt ? можешь воспользоваться get_user_docs, чтобы узнать это
