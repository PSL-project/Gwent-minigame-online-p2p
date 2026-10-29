# Security Policy

## Supported versions

Security fixes are prioritized for the latest release published in this repository. Older releases, development builds, and modified distributions are not guaranteed to receive fixes.

## Reporting a vulnerability

**Please do not disclose security vulnerabilities in public GitHub issues, discussions, or pull requests.**

Use the repository's [private vulnerability reporting](https://github.com/PSL-project/Gwent-minigame-online-p2p/security/advisories/new) feature, if it is enabled. If it is unavailable, open the repository's **Security** tab to check for an alternative private reporting channel. Do not post exploit details publicly when no private channel is available.

When possible, provide:

- A brief description of the vulnerability and its impact.
- Affected release/version and Windows environment.
- Safe reproduction steps or a minimal proof of concept.
- Relevant logs with invitation codes, session secrets, peer identifiers, and personal data removed.
- Any mitigations you have identified.

Reports will be reviewed on a best-effort basis. No fixed response or remediation time is guaranteed. Please allow maintainers to coordinate remediation before publishing technical exploit details.

## Security scope

Security-relevant areas include:

- Invitation codes, session authentication, reconnect credentials, and session hijacking.
- Unauthorized moves or manipulation of host-authoritative game state.
- Leakage of hidden cards, private deck state, or other unintended multiplayer data.
- Malicious network messages, denial of service, and unsafe deserialization or input handling.
- Electron desktop isolation, content security policy, file access, navigation, and dependency vulnerabilities.
- Build/release pipeline integrity and tampered installers.

## Important limitations

Gwent Classic Online is designed for private matches, not an adversarial competitive environment. The host executes the game rules and is trusted by design; the application cannot guarantee fairness against a malicious host. Direct peer-to-peer connectivity depends on external signaling and network conditions. A failed connection by itself is usually a reliability issue, not necessarily a vulnerability.

Only use release downloads from trusted sources. Avoid sharing invitation codes outside your intended match: they contain session access information.

This policy does not promise a bug bounty or paid vulnerability rewards.
