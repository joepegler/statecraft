/**
 * Compile-only: invalid fixture order must be a type error (see @ts-expect-error below).
 * This file is typechecked with the package; it is not executed as a test module.
 */
import { scenario } from "../src/scenario";
import { withChain } from "../src/fixtures/withChain";
import { withErc20Balance } from "../src/fixtures/withErc20Balance";
import type { ScenarioFundedWalletContext, ScenarioTest } from "../src/types";

const USDC_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0ce3606eB48" as const;

const needsFundedWallet: ScenarioTest<ScenarioFundedWalletContext> = async () => {};

scenario(
  // @ts-expect-error withChain does not set ctx.wallet; withErc20Balance without `to` needs withFundedWallet first
  withChain(),
  withErc20Balance({
    token: USDC_MAINNET,
    amount: 1n,
  }),
  needsFundedWallet,
);
