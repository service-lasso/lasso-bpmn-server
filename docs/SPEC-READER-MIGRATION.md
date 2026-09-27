# BPMN reader migration

Active documentation scope: BPMN #11, Core #1419 / #1265, SPEC-002 AC-4AJ.3.

Exactly docs/client-sample.md gains the central app-service-tasks entry point. Preserve all existing source-owned API/runtime examples and the decision that the client belongs to a consuming application rather than a separate daemon. Source reviewed at develop f57db8af782862baf26febc604480f4006437672.

Acceptance: canonical destination exists and is merged; original component text remains unchanged; diff and exact-head hosted platform checks pass. Develop-only issue branch and PR. No product code, publication, provider operations or new runtime acceptance.
Development validation: the existing release workflow must validate pull requests targeting `develop`. Correct its stale PR branch filter so this documentation candidate receives the existing platform checks; do not change publication conditions or dispatch a release.
