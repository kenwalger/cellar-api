// ESM entry point for Node.js. The parsing logic lives in the portable core,
// production-script.cjs, which has no module syntax of its own.

import ProductionScript from "./production-script.cjs";

export const { parseProductionScript, DiagnosticCode } = ProductionScript;
