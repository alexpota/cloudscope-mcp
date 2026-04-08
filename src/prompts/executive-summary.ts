import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const PROMPT_TEXT = `Generate a brief executive cost summary for leadership. Keep it under 10 sentences and avoid technical jargon. Cover:

- Total spend this month and the trend versus last month (up or down, by how much)
- Budget status: on track, at risk, or over
- Top three cost drivers
- Forecast for next month
- One key recommendation

Use the available CloudScope tools to gather the data. Present the result as a short narrative paragraph, not a bulleted list — the audience is a non-technical executive who wants the bottom line quickly.`;

export const registerExecutiveSummaryPrompt = (server: McpServer): void => {
  server.registerPrompt(
    'executive-summary',
    {
      title: 'Executive Cost Summary',
      description: 'Generate a brief executive cost summary for leadership or stakeholders',
    },
    () => ({
      messages: [{ role: 'user', content: { type: 'text', text: PROMPT_TEXT } }],
    }),
  );
};
