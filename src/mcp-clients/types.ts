export type Tool = {
  name: string;
  description: string | undefined;
  input_schema: {
    [p: string]: unknown;
    type: 'object';
    properties?: Record<string, object> | undefined;
    required?: string[] | undefined;
  };
};

export type MessageParam = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};
