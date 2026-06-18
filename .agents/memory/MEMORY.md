# Memory Index

- [LaunchPad asset serving](launchpad-asset-serving.md) — storage hands out `/api/assets/<key>` URLs; the assets route must serve them (local-first, then Object Storage). Change both in lockstep.
- [LaunchPad codegen & typecheck](launchpad-codegen-typecheck.md) — openapi.yaml drives api-zod + api-client-react codegen; packages have no build (project references); db barrel doesn't re-export drizzle operators.
- [LaunchPad paid-social & AI keys](launchpad-paid-social-testing.md) — ADS_MODE=mock default; dev-only test-publish (403 in prod) bypasses Stripe; Claude via integration, FAL_API_KEY optional (no integration).
