# Mint Creator Lookup API Investigation

**Prepared:** November 7, 2026  
**Scope:** Find a dependable, documented replacement for the Pump.fun frontend
endpoint used by Rhozeland to look up a token mint's creator wallet.

## Executive summary

The current Edge Function calls
`https://frontend-api-v3.pump.fun/coins/<mint>` and expects a JSON `creator`
field. The endpoint returned a Cloudflare 403 challenge in the direct `curl`
test. Public documentation for this frontend endpoint has not been found, so
its third-party support status and availability are not established.

**Bitquery is the strongest candidate found for a short proof of concept.** Its
Pump.fun-specific documentation describes GraphQL queries for `create` and
`create_v2` events, filtered by mint, and says creation data includes the mint
and creator/dev wallet. It is a documented third-party data API rather than a
Pump.fun-operated endpoint. It still needs to be validated against a known mint
before it is trusted for automatic approval.

Helius, QuickNode, SHYFT, and Solscan can provide Solana transaction or account
data, but the reviewed material did not establish them as direct Pump.fun
mint-to-creator lookup APIs. They would require locating the creation
transaction and interpreting it. SHYFT documents a short transaction-history
window, making it a poor default for older mints. The Pump.fun public docs and
IDL can be used to validate an on-chain decoding approach.

## Findings

### 1. Bitquery Pump.fun API — best first candidate

**What the documentation says**

- Bitquery publishes a Pump.fun-specific API guide for creation, trade, and
  bonding-curve data.
- Its guide describes filtering Pump program instructions to `create` and
  `create_v2`.
- The guide describes querying creation records for a specific mint and
  returns creation data including the mint, creator/dev address, name, symbol,
  and URI.
- Bitquery's product page says its API key is obtained from its account portal.
  GraphQL access is server-to-server and should be made from the Edge Function,
  not browser code.

**Fit for Rhozeland**

This is the only candidate in this review with Pump.fun-specific documentation
that explicitly describes getting a token's creation time and dev/creator
address by mint. A proof of concept should query by the submitted mint and
creation methods (`create`, `create_v2`), then verify the exact returned mint
and expected Pump program before using the creator field.

**Limitations and checks**

- It is a third-party indexed-data provider, not an official Pump.fun API.
- Bitquery's current pricing page describes a 7-day trial for real-time data,
  no permanent free tier, and paid plans. Its self-service documentation says
  historical/archived data may require an archive add-on; a mint whose
  creation is outside the real-time window may not be available on a trial.
- Pricing and plan terms can change. The pricing page also describes a $49
  Personal plan as **personal, non-commercial use only**. Confirm that the
  intended project usage is allowed before choosing a plan.
- Confirm the API's actual creator field semantics for current `create` and
  `create_v2` transactions and older launches. Do not equate arbitrary token
  metadata or a later bonding-curve creator authority with the launch signer
  without validation.
- Validate the result against at least one independently known mint and
  inspect the source transaction. If the provider returns a signature, fetch
  that transaction from Solana RPC and verify success, Pump program ID, mint,
  and creator account.

**Assessment:** Recommended for a time-boxed proof of concept, subject to API
key, plan, history-retention, and creator-semantics validation.

### 2. Helius — capable transaction/RPC provider, not a confirmed direct lookup

Helius documents Solana RPC and transaction-history APIs, including
`getTransactionsForAddress`, and its DAS API for token/asset information. Those
are useful primitives for retrieving indexed or parsed chain data.

The documentation reviewed did not confirm a Pump.fun-specific endpoint that
directly returns the authoritative launch creator for an arbitrary mint. The
likely approach is to locate the mint's creation transaction, then decode and
validate its Pump instruction/event.

**Assessment:** Good fallback for an on-chain-derived implementation if
Bitquery is unsuitable. DAS metadata by itself should not be treated as proof
of the Pump.fun launch creator. Confirm historical coverage and pricing for
the chosen method.

### 3. QuickNode — standard RPC primitives, with transaction parsing required

QuickNode documents standard Solana RPC methods such as
[`getSignaturesForAddress`](https://www.quicknode.com/docs/solana/getSignaturesForAddress)
and [`getTransaction`](https://www.quicknode.com/docs/solana/getTransaction).
Together, they can be used to find and retrieve transactions involving a mint.

The documented methods are general RPC methods, not a Pump.fun creator lookup.
The implementation must paginate transaction signatures as needed, identify
the successful creation transaction, and validate the Pump program instruction
and mint. Provider history and rate limits must be tested for older tokens.

**Assessment:** Credible general-purpose fallback, but more parsing and
historical-coverage work than using a Pump.fun-indexed query.

### 4. SHYFT — parsed transaction APIs, but history window is a concern

SHYFT documents a parsed-transaction endpoint and transaction-history endpoint
with parsed transaction data:
[Transaction APIs](https://docs.shyft.to/solana-apis/transactions/transaction-apis.md).
The page says transaction history is limited to approximately the past 3–4
days.

The reviewed docs do not establish a direct Pump.fun mint-to-creator endpoint.
Using SHYFT would require a known creation transaction signature or finding it
within that history window and validating the parsed/raw transaction.

**Assessment:** Potentially useful for recent launches or parsing a known
signature; not a good default for arbitrary older mints unless SHYFT confirms
the required historical coverage.

### 5. Solscan Pro API — transaction/explorer data, not a confirmed direct creator lookup

Solscan documents token metadata and transaction APIs, including an enhanced
transaction endpoint with filters for programs and instruction discriminators:
[enhanced transaction filtering](https://docs.solscan.io/solscan-api/api-transaction-enhanced-filtering-by-program-instruction.md).
Its docs list Token Meta and transaction-detail endpoints, but the material
reviewed did not establish that Token Meta's creator field means the original
Pump.fun launch wallet.

The documented Pro API Lite plan is $49/month, with Pro API Level 2 listed at
$199/month; verify current plans before relying on these figures. This would
add cost without removing the need to validate transaction semantics.

**Assessment:** Possible transaction-data source, but weaker fit than Bitquery
for this specific lookup until Solscan confirms an authoritative creator field
and its provenance.

### 6. Pump.fun public program documentation plus Solana RPC — source-level
on-chain verification

Pump.fun maintains public program documentation and IDLs in
[pump-public-docs](https://github.com/pump-fun/pump-public-docs). The repository
contains the Pump program IDL and documents create instructions/events. The
main Pump program ID in the IDL is
`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`.

This supports an implementation that queries Solana transaction data and
decodes the launch transaction using Pump's public program interface. It is
not itself a hosted creator-lookup API. It offers strong source-level
verification but requires careful support for instruction versions, event
decoding, transaction-history lookup, and launch signer versus creator
semantics.

**Assessment:** Best long-term source-of-truth approach if the team is prepared
to own and test the parser. A third-party indexer can still reduce the effort
to locate candidate transactions.

### 7. Birdeye — not established for this exact requirement

Birdeye is a known Solana market/token-data provider, but during this
investigation I did not verify an official, documented API field that
authoritatively maps an arbitrary Pump.fun mint to its original launch wallet.
Treat it as unconfirmed for this requirement unless Birdeye documents that
specific field and its source.

**Assessment:** Do not select based only on token overview or metadata
availability; first confirm creator provenance and coverage with Birdeye's
official docs/support.

## Recommended implementation investigation

1. Use Bitquery's documented Pump.fun query against a known mint. Require an
   exact match on mint, Pump program ID, and a successful `create` or
   `create_v2` transaction.
2. Compare the returned creator address with an independently verified launch
   wallet. Confirm whether the provider field represents the launch wallet
   (transaction signer) or a Pump creator/authority field that may differ.
3. Check whether the mint is old enough to require Bitquery archive access.
   Confirm a plan that permits the project's use, required history, request
   volume, and budget.
4. If the data is unavailable or the creator semantics are ambiguous, do not
   approve. Investigate querying the transaction through Helius or QuickNode
   and decoding it against Pump's official IDL.
5. Keep provider credentials in server-side Supabase Edge Function secrets.
   Never place keys in `VITE_*` variables or browser code.
6. Preserve fail-closed behavior: missing, ambiguous, malformed, or unavailable
   creator data must leave the token pending and must not consume the signed
   challenge or approve the profile.

## Decision

**Proceed with a Bitquery proof of concept first; do not treat it as production
ready until a known mint is tested and creator-field semantics are confirmed.**
If the class project cannot use its plan terms/cost or the needed creation
history is outside the available dataset, use an indexed RPC provider plus
Pump's public IDL to derive the creator from the on-chain creation
transaction.

No API key was created, no provider request was made, and no application code
was changed as part of this research.

## Sources

- [Bitquery Pump.fun API documentation](https://docs.bitquery.io/docs/blockchain/Solana/Pumpfun/Pump-Fun-API/)
- [Bitquery Pump.fun API product page: API key, trial, and plan notes](https://bitquery.io/products/pumpfun-api)
- [Bitquery pricing and data-window notes](https://bitquery.io/pricing)
- [Bitquery dataset documentation](https://docs.bitquery.io/docs/graphql/dataset/combined/)
- [Pump.fun public program docs and IDLs](https://github.com/pump-fun/pump-public-docs)
- [Helius transaction-history API](https://www.helius.dev/docs/rpc/gettransactionsforaddress)
- [Helius DAS API](https://www.helius.dev/docs/das-api)
- [QuickNode `getSignaturesForAddress`](https://www.quicknode.com/docs/solana/getSignaturesForAddress)
- [QuickNode `getTransaction`](https://www.quicknode.com/docs/solana/getTransaction)
- [SHYFT transaction APIs](https://docs.shyft.to/solana-apis/transactions/transaction-apis.md)
- [Solscan enhanced transaction filtering](https://docs.solscan.io/solscan-api/api-transaction-enhanced-filtering-by-program-instruction.md)
- [Solscan API endpoint and pricing information](https://docs.solscan.io/solscan-api/solscan-pro-api-endpoints.md)
- [Solscan API Lite plan](https://docs.solscan.io/solscan-api/solscan-api-lite-plan.md)
