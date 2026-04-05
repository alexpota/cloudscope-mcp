import { describe, it, expect, vi } from 'vitest';
import { handleDetectAnomalies } from '../../src/tools/anomalies.js';

const mockAzureClient = {
  queryCosts: vi.fn(),
};

describe('handleDetectAnomalies', () => {
  it('detects services with cost increases above threshold', async () => {
    mockAzureClient.queryCosts.mockResolvedValueOnce({
      rows: [
        { serviceName: 'Virtual Machines', cost: 500, currency: 'USD' },
        { serviceName: 'Storage', cost: 120, currency: 'USD' },
      ],
      currency: 'USD',
    });
    mockAzureClient.queryCosts.mockResolvedValueOnce({
      rows: [
        { serviceName: 'Virtual Machines', cost: 300, currency: 'USD' },
        { serviceName: 'Storage', cost: 100, currency: 'USD' },
      ],
      currency: 'USD',
    });

    const result = await handleDetectAnomalies(
      { provider: 'azure', days: 7, threshold: 20 },
      { azure: mockAzureClient as any },
    );

    const text = result.content[0].text;
    expect(text).toContain('Virtual Machines');
    expect(text).toContain('66.7%');
    expect(text).toContain('Storage');
  });

  it('reports no anomalies when all changes are below threshold', async () => {
    mockAzureClient.queryCosts.mockResolvedValueOnce({
      rows: [{ serviceName: 'Storage', cost: 105, currency: 'USD' }],
      currency: 'USD',
    });
    mockAzureClient.queryCosts.mockResolvedValueOnce({
      rows: [{ serviceName: 'Storage', cost: 100, currency: 'USD' }],
      currency: 'USD',
    });

    const result = await handleDetectAnomalies(
      { provider: 'azure', days: 7, threshold: 20 },
      { azure: mockAzureClient as any },
    );

    expect(result.content[0].text).toContain('No anomalies');
  });
});
