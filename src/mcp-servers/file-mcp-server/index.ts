import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
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

const getDocPath = (docName: string) => {
  const normalizedDocName = docName.toLowerCase();
  return path.join(docsPath, normalizedDocName);
};

server.registerTool(
  'get_user_docs',
  {
    title: 'Get users docs',
    description: 'Get users local documents',
    inputSchema: {
      docName: z.string().describe("The name of the user's document"),
    },
  },
  async ({ docName }) => {
    let docContent = '';

    try {
      const pathToDocument = getDocPath(docName);
      docContent = await readFile(pathToDocument, 'utf8');
    } catch (e) {
      console.error(e);
      throw new Error(`no file with these name ${docName} was found`);
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

server.registerTool(
  'edit_user_docs',
  {
    title: 'Edit users docs',
    description:
      'Edit a document by replacing a string in the documents content with a new string',
    inputSchema: {
      docName: z.string().describe("The name of the user's document"),
      oldString: z.string().describe('The text to replace. Must match exactly'),
      newString: z
        .string()
        .describe('The text to insert in place of the old text'),
    },
  },
  async ({ docName, oldString, newString }) => {
    let newDocContent = '';

    try {
      const pathToDocument = getDocPath(docName);
      const docContent = await readFile(pathToDocument, 'utf-8');
      newDocContent = docContent.replace(oldString, newString);
      await writeFile(pathToDocument, newDocContent);
    } catch (e) {
      console.error(e);
      throw new Error(`error while editing file with these name ${docName}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: newDocContent,
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
