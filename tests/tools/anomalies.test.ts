import { describe, it, expect, vi } from 'vitest';
import { handleDetectAnomalies } from '../../src/tools/anomalies.js';

const mockAzureClient = {
  queryCosts: vi.fn(),
};

describe('handleDetectAnomalies', () => {
  it('shows dollar amount and percentage for each anomaly', async () => {
    mockAzureClient.queryCosts.mockResolvedValueOnce({
      rows: [
        { name: 'Virtual Machines', cost: 500 },
        { name: 'Storage', cost: 120 },
      ],
      currency: 'USD',
    });
    mockAzureClient.queryCosts.mockResolvedValueOnce({
      rows: [
        { name: 'Virtual Machines', cost: 300 },
        { name: 'Storage', cost: 100 },
      ],
      currency: 'USD',
    });

    const result = await handleDetectAnomalies(
      { provider: 'azure', days: 7, threshold: 20 },
      { azure: mockAzureClient as any },
    );

    const text = result.content[0].text;
    expect(text).toContain('Virtual Machines');
    expect(text).toContain('$200.00 increase (up 66.7%)');
    expect(text).toContain('Storage');
    expect(text).toContain('$20.00 increase (up 20.0%)');
  });

  it('reports no anomalies when all changes are below threshold', async () => {
    mockAzureClient.queryCosts.mockResolvedValueOnce({
      rows: [{ name: 'Storage', cost: 105 }],
      currency: 'USD',
    });
    mockAzureClient.queryCosts.mockResolvedValueOnce({
      rows: [{ name: 'Storage', cost: 100 }],
      currency: 'USD',
    });

    const result = await handleDetectAnomalies(
      { provider: 'azure', days: 7, threshold: 20 },
      { azure: mockAzureClient as any },
    );

    expect(result.content[0].text).toContain('No anomalies');
  });
});
