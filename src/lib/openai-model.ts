/** OpenAI flagship model — override with OPENAI_MODEL in .env */
export const DEFAULT_OPENAI_MODEL = "gpt-6-astra";

export function getOpenAiModel(): string {
  const configured = process.env.OPENAI_MODEL?.trim();
  return configured || DEFAULT_OPENAI_MODEL;
}

/** Some models (e.g. gpt-6-astra, o-series) only accept the default temperature. */
export function getOpenAiTemperature(model: string, preferred: number): number | undefined {
  const id = model.toLowerCase();
  if (id.includes("astra") || /^o\d/.test(id)) {
    return undefined;
  }
  return preferred;
}
