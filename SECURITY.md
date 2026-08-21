# Security policy

Please report security issues through [GitHub private vulnerability reporting](https://github.com/dante-is-shipping/LocalKeepFlash/security/advisories/new) before opening a public issue. Do not include captured private content, credentials, directory listings, or personal data in a report.

The supported security boundary for `0.1.x` is Chrome and Edge 122 or newer. LocalKeepFlash intentionally has broad HTTP(S) host access for reliable capture and cross-origin image copying, but it must not contact a KeepFlash API, analytics endpoint, AI service, or remote code host.

Security-sensitive changes should include a test or a reproducible manual verification procedure.
