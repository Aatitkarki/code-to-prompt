import { encoding_for_model, Tiktoken } from "tiktoken";

export interface TokenInfo {
  tokens: number;
  model: string;
  approximate: boolean;
}

const DEFAULT_MODEL = "gpt-4o-mini"; // any tiktoken-supported model

// Create the encoder once at module load rather than on every call.
let _encoder: Tiktoken | null = null;
function getEncoder(): Tiktoken | null {
  if (!_encoder) {
    try {
      _encoder = encoding_for_model(DEFAULT_MODEL as any);
    } catch {
      _encoder = null;
    }
  }
  return _encoder;
}

export async function countTokens(text: string): Promise<TokenInfo> {
  const enc = getEncoder();
  if (enc) {
    try {
      const count = enc.encode(text).length;
      return { tokens: count, model: DEFAULT_MODEL, approximate: false };
    } catch {
      // fall through to heuristic
    }
  }
  const approx = Math.ceil(text.length / 4);
  return { tokens: approx, model: "heuristic", approximate: true };
}