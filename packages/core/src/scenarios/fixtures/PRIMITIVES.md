# Primitives

This file lists all current and potential primitive helpers (withX) along with their differentiation score (1–5).

5 = strong differentiator
4 = meaningful
3 = useful but common
2 = nice-to-have
1 = low value / generic

These are not all intended for v1. This is a long-term backlog of composable primitives.

## Runtime / Chain
withChain: 3
withFork: 5
withSnapshot: 3
withChainId: 2
withBlock: 2
withBlockTimestamp: 3
mineBlocks: 2
withAutomine: 2
withGasPrice: 2
withCoinbase: 1
## Wallet / Accounts
withFundedWallet: 5
withWallet: 2
withPrivateKey: 2
withMultipleWallets: 3
withImpersonation: 4
withNonce: 2
withBalance: 3

## Tokens / Assets

withErc20Balance: 5
withErc20Allowance: 4
withErc20Metadata: 2
withTokenMint: 2
withTokenTransfer: 3
withNativeBalance: 3
## Contracts
withContracts: 5
withDeployments: 5
withDeployedContract: 3
withProxy: 4
withImplementation: 3
withLibraryLinkedContract: 2
withContractAt: 3
## Storage / State
withStorage: 4
withMappingSlot: 3
withBalanceSlot: 3
withAllowanceSlot: 3
withStorageSnapshot: 2
## Transactions / Execution
withTx: 3
withBatchTx: 3
withCall: 2
withRevertedTx: 3
## Gas / Fees
withBaseFee: 2
withPriorityFee: 2
withGasLimit: 2
## Time / Blocks
withTimeIncrease: 3
withTimeSet: 3
withNextBlockTimestamp: 3
advanceTime: 3
## Multi-chain
withMultiChain: 4
chain: 4
## Cross-chain (low priority)
withCrossChainMessage: 2
withBridgeMock: 2
withCanonicalTokenMapping: 1
## ERC-4337 / Bundler / AA
withBundler: 5
withEntryPoint: 4
withEntryPointDeposit: 4
withSmartAccount: 5
withUserOp: 5
withSignedUserOp: 5
withUserOpSimulation: 5
withPaymaster: 5
withSponsoredUserOp: 5
withBundlerFailureMode: 5
withMempool: 4
## External / Mocking
withRpcOverride: 3
withOracleMock: 3
withAggregatorMock: 4
withExternalCallStub: 3
## Test Assertions / Helpers
withExpectBalance: 2
withExpectRevert: 2
withEventAssertion: 2
withLogCapture: 2
## Cleanup / Isolation
withCleanup: 2
withReset: 2
withIsolatedRuntime: 3
## Developer Experience
withLabel: 2
withDebug: 2
withTrace: 4
withConsole: 1
## Composition
compose: 4
group: 3
repeat: 2
## High-level Scenarios (use carefully)
withSwapScenario: 2
withBridgeScenario: 2
withLiquidityScenario: 2
