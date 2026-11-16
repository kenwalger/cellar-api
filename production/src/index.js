// ESM entry point for Node.js. The estimating logic lives in the portable core,
// production-estimator.cjs, which has no module syntax of its own.

import ProductionEstimator from "./production-estimator.cjs";

export const {
  SCHEMA_VERSION,
  DEFAULT_OPTIONS,
  WarningCode,
  spokenTokens,
  countWords,
  isTechnicalToken,
  checkOptions,
  estimateProduction,
  formatDuration,
} = ProductionEstimator;
