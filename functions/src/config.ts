import { setGlobalOptions } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";

// This package is not deployed by default — see functions/README.md. Kept buildable so
// it's ready if the AI Assistant is ever turned on.
export const REGION = "asia-south1";

setGlobalOptions({ region: REGION, maxInstances: 10 });

// Secret Manager binding for the AI provider. Left unbound on purpose — the AIProvider
// interface in services/aiProvider.ts reports "not configured" honestly until this is set
// with `firebase functions:secrets:set AI_API_KEY` (which also requires the Blaze plan
// this build otherwise avoids entirely). Never fake a generated result.
export const AI_API_KEY = defineSecret("AI_API_KEY");
