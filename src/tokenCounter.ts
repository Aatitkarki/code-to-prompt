import { encoding_for_model } from "tiktoken";

export interface TokenInfo {
  tokens: number;
  model: string;
  approximate: boolean;
}

const DEFAULT_MODEL = "gpt-4o-mini"; // any tiktoken-supported model

export async function countTokens(text: string): Promise<TokenInfo> {
  try {
    const enc = encoding_for_model(DEFAULT_MODEL as any);
    const tokens = enc.encode(text);
    const count = tokens.length;
    enc.free();
    return { tokens: count, model: DEFAULT_MODEL, approximate: false };
  } catch (err) {
    const approx = Math.ceil(text.length / 4);
    return { tokens: approx, model: "heuristic", approximate: true };
  }
}
