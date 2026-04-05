import { formatMoney } from '../utils/formatter.js';
import { ProviderNotConfiguredError } from '../utils/errors.js';
import type { Providers } from './cost-summary.js';

interface RecommendationsInput {
  provider: 'azure' | 'gcp';
  category: 'all' | 'compute' | 'storage' | 'networking';
}

export async function handleListRecommendations(
  input: RecommendationsInput,
  providers: Providers,
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    if (input.provider === 'azure') {
      if (!providers.azure) throw new ProviderNotConfiguredError('azure');

      const recs = await providers.azure.getRecommendations(input.category);

      if (recs.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No cost optimization recommendations found for Azure.\n\nCategory filter: ${input.category}\nThis could mean your resources are already well-optimized, or Azure Advisor hasn't generated recommendations yet.`,
            },
          ],
        };
      }

      const sorted = [...recs].sort(
        (a, b) => (b.savingsAmount || 0) - (a.savingsAmount || 0),
      );

      const totalSavings = sorted.reduce(
        (sum, r) => sum + (r.savingsAmount || 0),
        0,
      );

      const lines: string[] = [];
      lines.push(`Azure Cost Optimization Recommendations`);
      lines.push(`Category: ${input.category} | Found: ${sorted.length} recommendation(s)`);
      lines.push(
        `Estimated total monthly savings: ${formatMoney(totalSavings, 'USD')}`,
      );
      lines.push('');

      for (let i = 0; i < sorted.length; i++) {
        const rec = sorted[i];
        lines.push(`${i + 1}. [${rec.impact}] ${rec.description}`);
        if (rec.savingsAmount) {
          lines.push(
            `   Estimated savings: ${formatMoney(rec.savingsAmount, rec.savingsCurrency || 'USD')}/month`,
          );
        }
        if (rec.resourceId) {
          const resourceName = rec.resourceId.split('/').pop() || rec.resourceId;
          lines.push(`   Resource: ${resourceName}`);
        }
        lines.push('');
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    throw new ProviderNotConfiguredError('gcp');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
}
