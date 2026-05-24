type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type DeepSeekOptions = {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
  timeoutMs?: number;
};

export async function callDeepSeek(messages: DeepSeekMessage[], options: DeepSeekOptions = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey === "replace_with_your_key") {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const timeoutMs = options.timeoutMs ?? Number(process.env.DEEPSEEK_TIMEOUT_MS ?? 120000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? Number(process.env.AI_DEFAULT_TEMPERATURE ?? 0.8),
        max_tokens: options.maxTokens ?? Number(process.env.DEEPSEEK_MAX_OUTPUT_TOKENS ?? 6000),
        response_format: options.responseFormat === "json" ? { type: "json_object" } : undefined,
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`DeepSeek request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DeepSeek request failed: ${response.status} ${text.slice(0, 500)}`);
  }

  const data = await response.json();
  const content = String(data.choices?.[0]?.message?.content ?? "").trim();
  if (!content) {
    throw new Error("DeepSeek returned an empty response");
  }
  return content;
}
