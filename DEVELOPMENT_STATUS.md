# Development status

Branch: `development/online-desktop`.
Base: `08592d847f2573440a34deb9f32bc855b2544cdd` (fork main at checkout).

## Completed implementation: P1–P4

- Inspected the original DOM-backed engine once and reused its rules, AI, cards,
  deck editor and media. Existing `img/`, `sfx/`, `svg/` and `LICENSE` are unchanged.
- PeerJS public signaling; one invitation encodes a random 192-bit peer ID and
  192-bit secret. HMAC-SHA-256 proves invitation knowledge. Version checks,
  bounded messages/queues/rates, heartbeat and signaling recovery are included.
- Returning guests retain a random in-memory credential; another invitation
  holder cannot seize an already bound guest seat.
- The host alone executes original rules/randomness. Single-use action
  capabilities bind actor and revision; incoming data never chooses functions.
- Explicit player views omit the opposing hand and both draw-pile contents.
  Rule-authorized reveals are delivered only to the acting player.
- Both humans use the original card/faction effects through the host adapter,
  including redraw, leaders, decoy, medics, agile rows and nested choices.
- Mode menu, copy/join invitation, lobby, original deck customization,
  ready/unready, live status, card inspection, pause/retry/abandon and results.
- In-memory state and suspended choices resume after authenticated reconnect.
- Original single-player AI, deck editor, sound and settings preserved;
  optional online music is loaded on demand.

## P5: actual verification

Passed:
- `npm run check`: syntax, required bundled files and protocol/package version.
- `npm test`: 11 tests, 0 failures. Includes invitation/deck validation,
  actor/revision/duplicate protection, transport authentication and recovery,
  impostor rejection and destroyed-peer ID recovery.
- Rules tests assert bond/horn/weather/hero/scorch scoring, spy draws, muster,
  medic choices, agile resurrection and legal decoy targets. All 17 active
  leader abilities resolved through original effects and human prompts.
- `npm run test:integration`: three complete simulated two-client matches
  covering all five factions, hidden-state checks, invalid actions, disconnect,
  paused-action rejection and identical state/history after recovery.
- A complete original single-player match against the AI, including mulligan.
- Empty draw piles are safe; Northern Realms waits for its bonus draw before
  exposing the next turn and legal-action snapshot.
- `SIMULATE_WEBRTC=1 npm run test:browser`: two isolated Chromium contexts,
  actual Host/Join/deck/ready/action GUI, complete match and reconnect. Solo UI
  also exercised under the production CSP. Screenshots visually inspected.
- Production dependency audit: zero reported vulnerabilities.
- Git diff confirms no existing media or original-license changes.

Not verified locally:
- Real PeerJS exchanged SDP offers/answers using a test-only local signaling
  service, but native Chromium produced no ICE candidates even in an isolated
  RTCPeerConnection probe. Direct DataChannel connectivity was unavailable.
- Public-cloud peer registration did not complete during the local probe.
  Internet host/join therefore requires verification on supported networks.
- Native Windows execution is unavailable. Linux root/sandbox restrictions
  prevented a valid Electron startup check; sandbox defaults were preserved.

## P6: packaging and delivery

- Electron 45.1.0, sandbox, context isolation, no Node/preload renderer access,
  CSP, navigation/window restrictions and restricted secure resource protocol.
- Windows x64 portable and NSIS configurations; no automatic publishing.
- Windows Actions runs checks, simulated matches, real local PeerJS/WebRTC
  browser match, both package targets and a packaged-executable smoke test.
- A local Windows portable executable was cross-built. Full local NSIS build
  stopped on missing Wine; its incomplete installer was removed.
- Final portable rebuild uses fast/store compression locally; CI retains normal
  compression. Build/source consistency is checked against the packaged ASAR.
- README completely rewritten around the actual desktop workflow, supported
  features, build commands, attributions and verification limits.
- `THIRD_PARTY_NOTICES.md` preserves source/dependency attribution and separates
  source licensing from unresolved Witcher media redistribution rights.
- `RELEASE_CHECKLIST.md` records the concrete remaining publication steps.

## Remaining external checks / blockers

1. Run Windows CI after the branch is pushed with repository-owner authorization.
2. Complete a public-signaling match between two Windows computers, including
   reconnect during a normal turn and an ability choice.
3. Validate Windows portable/installer startup, local settings and uninstall.
4. Resolve asset redistribution rights before public binary release.

No TURN relay is bundled; restrictive NAT/firewalls may prevent direct joining.
The host is trusted. Closing/reloading either application loses recovery state.
No PR, merge, push or release has been performed. Authenticated GitHub write
access is not configured here; a source-only unified patch is the delivery path.
