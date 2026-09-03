import { onCall, HttpsError } from "firebase-functions/v2/https";
import { AI_API_KEY } from "../config";
import { getAIProvider } from "../services/aiProvider";
import type { ProductContentRequest } from "../services/aiProvider";

/**
 * Seller-scoped (requires a businessId claim, i.e. onboarding must be complete). Behind
 * the AIProvider interface described in ARCHITECTURE.md section 1, decision 5 — returns
 * `{ configured: false, message }` honestly until AI_API_KEY is bound via
 * `firebase functions:secrets:set AI_API_KEY` and OpenAIProvider is implemented. Never
 * fakes a generated result.
 */
export const aiGenerateProductContent = onCall<ProductContentRequest>(
  { secrets: [AI_API_KEY] },
  async (request) => {
    if (!request.auth || !request.auth.token.businessId) {
      throw new HttpsError("permission-denied", "A seller account with a business is required.");
    }
    if (!request.data?.kind || !request.data?.productName?.trim()) {
      throw new HttpsError("invalid-argument", "kind and productName are required.");
    }

    const provider = getAIProvider(AI_API_KEY.value());
    return provider.generateProductContent(request.data);
  },
);
