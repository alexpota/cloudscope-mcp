import { formatMoney } from '../utils/formatter.js';
import { toolResult, withProvider, type ToolResult, type Providers } from './types.js';
import { DEFAULT_CURRENCY } from '../constants.js';

interface RecommendationsInput {
  provider: 'azure' | 'gcp';
  category: 'all' | 'compute' | 'storage' | 'networking';
}

export async function handleListRecommendations(
  input: RecommendationsInput,
  providers: Providers,
): Promise<ToolResult> {
  return withProvider(providers, input.provider, async (provider) => {
    const recs = await provider.getRecommendations(input.category);

    if (recs.length === 0) {
      return toolResult(
        `No cost optimization recommendations found.\n\nCategory filter: ${input.category}\nThis could mean your resources are already well-optimized, or recommendations haven't been generated yet.`,
      );
    }

    const sorted = [...recs].sort((a, b) => (b.savingsAmount || 0) - (a.savingsAmount || 0));
    const totalSavings = sorted.reduce((sum, r) => sum + (r.savingsAmount || 0), 0);

    const lines: string[] = [
      'Cost Optimization Recommendations',
      `Category: ${input.category} | Found: ${sorted.length} recommendation(s)`,
      `Estimated total monthly savings: ${formatMoney(totalSavings, DEFAULT_CURRENCY)}`,
      '',
    ];

    for (const [i, rec] of sorted.entries()) {
      lines.push(`${i + 1}. [${rec.impact}] ${rec.description}`);
      if (rec.savingsAmount) {
        lines.push(
          `   Estimated savings: ${formatMoney(rec.savingsAmount, rec.savingsCurrency || DEFAULT_CURRENCY)}/month`,
        );
      }
      if (rec.resourceId) {
        lines.push(`   Resource: ${rec.resourceId.split('/').pop() || rec.resourceId}`);
      }
      lines.push('');
    }

    return toolResult(lines.join('\n'));
  });
}
