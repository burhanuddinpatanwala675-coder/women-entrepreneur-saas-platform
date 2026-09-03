import * as admin from "firebase-admin";

admin.initializeApp();

import "./config";

// AI Assistant only. See functions/README.md and ARCHITECTURE.md's migration note — this
// package is present, builds, and is intentionally NOT part of firebase.json's deploy
// target, because deploying any Cloud Function requires Firebase's Blaze plan (a billing
// card on file, even at $0 actual cost), which this build deliberately avoids. Revisit
// only if that trade-off is ever acceptable.
export { aiGenerateProductContent } from "./callable/aiGenerateProductContent";
