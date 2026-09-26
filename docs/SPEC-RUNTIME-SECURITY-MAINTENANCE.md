# Packaged runtime security maintenance

Active: BPMN #13; blocks documentation #11 / Core #1419. Develop source f57db8af782862baf26febc604480f4006437672.

Repair verified Morgan/Multer advisories without disabling the zero-vulnerability audit. Pin Morgan 1.12.0 and Multer 2.4.0 in the source app and generated runtime package; refresh the source lockfile and prove the archive's installed/declaration/lock versions. Both retain their existing major API families. Preserve BPMN engine 2.3.8 and Mongoose 6.13.11, routes, authentication and package contract.

Acceptance: source and generated locks agree; packaged production audit is zero; existing full runtime/API/package verification and upload behavior remain functional; exact-head Windows/Linux/macOS gates pass. Correct develop PR validation filter, preserve release publication conditions. No release dispatch, publication or provider mutation.