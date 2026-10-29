# Contributing to Gwent Classic Online

Thanks for helping improve Gwent Classic Online, a Windows desktop version of classic Witcher 3 Gwent with offline play and private peer-to-peer matches.

## Before you start

- Search existing [issues](https://github.com/PSL-project/Gwent-minigame-online-p2p/issues) and pull requests to avoid duplicates.
- Open an issue before undertaking large changes, protocol changes, or substantial UI redesigns so the proposed approach can be discussed.
- Keep changes focused. Preserve the original single-player game, deck editor, cards, rules, and existing media unless a change explicitly requires otherwise.
- Do not add copyrighted game art, music, fonts, or other third-party assets without clear redistribution permission. Consult `LICENSE` and `THIRD_PARTY_NOTICES.md` before changing licensing or assets.

## Development setup

You will need Node.js and npm. Windows is the primary supported desktop target.

```bash
npm ci
npm start
```

Useful checks:

```bash
npm run check
npm test
npm run test:integration
npm run test:browser
```

Some browser tests need a configured Playwright browser/environment. To build Windows packages on a supported Windows environment:

```bash
npm run dist:win
```

Refer to `README.md` and `RELEASE_CHECKLIST.md` for additional build and verification context.

## Areas where help is welcome

- Reproducible Windows installation, launch, and portability bugs.
- Multiplayer connectivity, invitation handling, reconnection, and diagnostics.
- Rules correctness, card abilities, deck editing, and single-player regressions.
- Accessibility, interface usability, and documentation.
- Tests for game rules, protocol edge cases, and compatibility.

## Multiplayer and security expectations

- The host remains authoritative for game rules, moves, turn progression, and randomness. Do not allow an untrusted guest message to mutate the game state directly.
- Preserve the secrecy of hands, draw piles, invitations, session credentials, and other private session data.
- Validate incoming data and handle disconnection/reconnection without silently continuing an invalid match.
- Do not commit real invitation codes, session secrets, credentials, or personal identifying information to examples, tests, logs, or issues.
- Changes affecting the wire protocol or networking must include relevant regression tests and explain compatibility implications.

## Reporting a bug

Use the **Bug report** issue template. Include the app version, Windows version, whether you used the installer or portable executable, steps to reproduce, expected/actual behavior, and appropriately redacted logs or screenshots. For online bugs, describe whether you hosted or joined and at which connection stage the problem occurred. Never share a live invitation code publicly.

For vulnerabilities (e.g., credential exposure, unauthorized actions, or remote code execution), **do not file a public issue**. Follow [SECURITY.md](SECURITY.md).

## Pull requests

1. Fork the repository and create a descriptive branch.
2. Make a minimal, clearly scoped change.
3. Add or update tests and documentation when behavior changes.
4. Run the applicable checks before submitting.
5. Open a pull request with a summary, linked issue (if any), testing notes, and screenshots for UI changes.

By contributing, you agree that your contribution can be distributed under the repository's applicable license and that you have the right to submit it. Third-party code and assets must be clearly identified and properly licensed.

Please be respectful and constructive in issues, reviews, and discussions.


## Native multiplayer interface

Keep native multiplayer changes on `feature/native-multiplayer-ui`. The visible
board must never call authoritative Player or Board gameplay methods. Map input
through host-issued capabilities and render filtered snapshots; the original
rules run in the host’s isolated document. Preserve single-player behavior.

Run `npm run check`, `npm test`, `npm run test:integration` and
`npm run test:browser`. The browser suite includes actual card/board clicks and
runs with real local WebRTC by default. Set `SIMULATE_WEBRTC=1` for deterministic
transport coverage; report which mode ran. Windows CI runs both, then builds and
smoke-tests the packaged app. Treat network-provided UI text as untrusted text.
Do not add test-only transport hooks or fixture setup to production code.
