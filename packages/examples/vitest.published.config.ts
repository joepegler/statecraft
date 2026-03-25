import { examplesVitestConfig } from "./vitest.config.shared";

/** Resolve `@st8craft/core` from node_modules (npm install). Used by `test:with-published-core`. */
export default examplesVitestConfig({ linkLocalCore: false });
