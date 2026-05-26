type EmbeddingResponse = {
  data?: { embedding?: number[] }[];
};

export function embeddingEnabled() {
  return Boolean(process.env.EMBEDDING_API_KEY && process.env.EMBEDDING_MODEL);
}

export async function embedText(text: string): Promise<number[]> {
  const vectors = await embedTexts([text]);
  return vectors[0] || [];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!embeddingEnabled()) {
    return texts.map(() => []);
  }
  const baseUrl = process.env.EMBEDDING_BASE_URL || process.env.DEEPSEEK_BASE_URL || "https://api.openai.com/v1";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.EMBEDDING_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.EMBEDDING_MODEL,
      input: texts,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Embedding request failed: ${response.status} ${detail.slice(0, 300)}`);
  }
  const data = (await response.json()) as EmbeddingResponse;
  return texts.map((_, index) => data.data?.[index]?.embedding || []);
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
