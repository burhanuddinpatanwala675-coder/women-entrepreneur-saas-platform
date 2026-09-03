/**
 * AIProvider interface — ported from the FastAPI backend's `app/services/ai_provider.py`
 * verbatim in spirit. `NullAIProvider` is what ships until a real key is bound; it never
 * fakes a generated result, matching the platform's "no fake functionality" rule.
 */
export interface ProductContentRequest {
  kind: "description" | "tags" | "title";
  productName: string;
  category?: string | null;
  keywords?: string | null;
}

export interface ProductContentResult {
  configured: boolean;
  provider: string;
  message: string;
  content?: string;
}

export interface AIProvider {
  readonly name: string;
  isConfigured(): boolean;
  generateProductContent(req: ProductContentRequest): Promise<ProductContentResult>;
}

export class NullAIProvider implements AIProvider {
  readonly name = "none";
  isConfigured(): boolean {
    return false;
  }
  async generateProductContent(): Promise<ProductContentResult> {
    return {
      configured: false,
      provider: this.name,
      message:
        "AI Assistant isn't connected yet. Bind an AI_API_KEY secret and implement OpenAIProvider " +
        "in functions/src/services/aiProvider.ts to turn this on — until then this honestly reports " +
        "unconfigured instead of making something up.",
    };
  }
}

// Swap this for `new OpenAIProvider(apiKey)` (implement below) once AI_API_KEY is bound.
export function getAIProvider(apiKey: string | undefined): AIProvider {
  if (!apiKey) return new NullAIProvider();
  // TODO: implement OpenAIProvider here when a real key is available. Keeping this as an
  // explicit TODO rather than a stub that pretends to work is the whole point of this
  // interface — see ARCHITECTURE.md section 1, decision 5.
  return new NullAIProvider();
}
