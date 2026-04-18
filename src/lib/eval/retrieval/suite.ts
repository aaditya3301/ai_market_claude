import 'server-only';
import { retrieveWithPolicy } from '@/lib/intelligence/retriever';
import { DEFAULT_RETRIEVAL_CASES, type RetrievalEvalCase } from '@/lib/eval/retrieval/default-cases';

export interface RetrievalEvalItemResult {
  id: string;
  pass: boolean;
  resultCount: number;
  expectedTags: string[];
  observedTags: string[];
  precisionAt8: number;
}

export interface RetrievalEvalSummary {
  pass: boolean;
  avgPrecisionAt8: number;
  minPrecisionAt8: number;
  results: RetrievalEvalItemResult[];
}

function computePrecisionAtK(observed: string[], expected: string[], k: number = 8): number {
  const sample = observed.slice(0, k);
  if (sample.length === 0) return 0;
  const expectedSet = new Set(expected);
  const hits = sample.filter((tag) => expectedSet.has(tag)).length;
  return hits / sample.length;
}

export async function runRetrievalEvalSuite(params: {
  tenantId: string;
  cases?: RetrievalEvalCase[];
}): Promise<RetrievalEvalSummary> {
  const cases = params.cases || DEFAULT_RETRIEVAL_CASES;

  const results: RetrievalEvalItemResult[] = [];

  for (const testCase of cases) {
    const retrieval = await retrieveWithPolicy({
      tenantId: params.tenantId,
      text: testCase.query,
      policy: testCase.policy,
    });

    const observedTags = retrieval.chunks.map((chunk) => chunk.source_type);
    const precisionAt8 = computePrecisionAtK(observedTags, testCase.expectedTags, 8);
    const minResults = testCase.minResults || 1;

    const pass = retrieval.chunks.length >= minResults && precisionAt8 >= 0.7;

    results.push({
      id: testCase.id,
      pass,
      resultCount: retrieval.chunks.length,
      expectedTags: testCase.expectedTags,
      observedTags,
      precisionAt8,
    });
  }

  const avgPrecisionAt8 =
    results.length === 0 ? 0 : results.reduce((sum, item) => sum + item.precisionAt8, 0) / results.length;
  const minPrecisionAt8 = results.length === 0 ? 0 : Math.min(...results.map((item) => item.precisionAt8));

  return {
    pass: results.every((item) => item.pass),
    avgPrecisionAt8,
    minPrecisionAt8,
    results,
  };
}
