import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const docsPath = path.resolve(
  process.cwd(),
  'src',
  'mcp-servers',
  'file-mcp-server',
  'docs'
);

const server = new McpServer({
  name: 'file-mcp-server',
  version: '1.0.0',
});

server.registerTool(
  'get_user_docs',
  {
    description: 'Get users local documents',
    inputSchema: {
      docName: z.string().describe("The name of the user's document"),
    },
  },
  async ({ docName }) => {
    const normalizedDocName = docName.toLowerCase();
    let docContent = '';

    try {
      const pathToDocument = path.join(docsPath, normalizedDocName);
      docContent = await readFile(pathToDocument, 'utf8');
    } catch (e) {
      console.error(e);
    }

    return {
      content: [
        {
          type: 'text',
          text: docContent,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Local file MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
