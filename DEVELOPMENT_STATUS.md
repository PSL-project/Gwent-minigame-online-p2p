# Development status

Branch: `feature/native-multiplayer-ui`.
Base: `623fa31ff81e674dedc2f41179222f2f659a7b22`.
The remote listed only `main` when inspected; this development branch was created
locally from that base. No changes are committed to main.

## Native multiplayer integration

- Original hand cards, battlefield rows, weather area, decoy targets, leader
  cards and Pass control now submit host-issued action permissions for both players.
- The original carousel presents redraw, medic, leader and authorized reveal
  choices. Agile resurrection targets use highlighted battlefield rows; faction
  decisions use the original confirmation dialog.
- Both clients render filtered authoritative snapshots. Stable per-card IDs
  distinguish identical card copies; destination metadata maps graphical input
  onto existing single-use permissions. Actions still transmit only ID/revision.
- The legacy engine is DOM-backed. On the host it runs in a separate hidden
  same-origin document, so graphical rendering cannot detach its live objects or
  execute rules on the guest. No second rules implementation was introduced.
- Gameplay has no online action dock or separate inspection screen. Original
  card previews, carousel navigation, score/gem/passed displays and result screen
  are reused. A compact top bar retains connection and turn information.
- Online sound/visual effects run on the visible projection; engine-document
  cosmetic delays are skipped. Single-player files and behavior remain intact.
- Pending submissions lock until a host update. Pause/reconnection clears local
  selection and restores pending choices; stale views are ignored. Network text
  is rendered as text, including prompts in reused legacy dialogs.
- PeerJS, invitations, authentication, recovery credentials, host validation,
  hidden-state filtering, rate limits and Electron sandbox defaults are retained.
- Windows CI also runs simulated-transport native UI regression before real
  local WebRTC checks. Packaged smoke checks include the secure rules iframe.

## Verification in this run

Passed:
- `npm run check`: syntax, bundled entry assets and version consistency.
- `npm test`: 15 tests, zero failures. Original effects and all 17 active leaders;
  transport authentication/recovery; duplicate/stale protection; native card-copy
  selection, invalid targets, pending/paused/out-of-turn controls, private views,
  malformed metadata and safe rendering of network text.
- `npm run test:integration`: three complete simulated multiplayer matches
  across all five factions; invalid actions, hidden state, pause/recovery/resync;
  a complete original single-player match against the AI.
- `SIMULATE_WEBRTC=1 npm run test:browser` with local Chromium 153: actual clicks
  for both host and guest, redraw, spy, decoy, medic/agile choices, weather/clear,
  horn, agile placement, scorch, leader, Pass, duplicate rejection, out-of-turn
  inspection, reconnect during a medic choice and a normal turn, complete match,
  synchronized results, action-dock absence and starting another game.
- `npm audit --omit=dev --audit-level=high`: zero reported vulnerabilities.
- Screenshots inspected: original board/cards/controls, no separate action list.

Build results and outstanding external verification:
- Windows portable cross-build passed using
  `npx electron-builder --win portable --x64 --publish never -c.compression=store -c.directories.output=dist/final`.
  Packaged native sources match the final checkout byte-for-byte; the executable
  has a Windows PE header and the existing board/audio/PeerJS files are bundled.
- The configured full `npm run dist:win -- --publish never` produced a portable
  EXE, then failed at NSIS with `spawn wine ENOENT`. Its incomplete installer was
  removed. Normal compression and both targets are retained in Windows CI.
- Workflow YAML, branch trigger, test/build/artifact steps and source diff validated.
- `node tests/desktop-smoke.cjs` was attempted locally but Electron could not
  initialize without an X server/display. No Windows runtime success is claimed.
- Packaged Windows smoke test requires Windows CI/a Windows computer.
- Native local WebRTC browser test was executed here but failed to connect:
  channels remained in new/connecting state. Simulated transport is not evidence
  of real internet P2P connectivity. Verify public PeerJS host/join on two PCs.
- No TURN relay is bundled; restricted networks may not connect. Host is trusted;
  sessions survive temporary interruption while both applications stay open.
- No exhaustive test of every card combination or public internet match is claimed.
- Preserve LICENSE and THIRD_PARTY_NOTICES; source licensing does not establish
  clearance to redistribute third-party Witcher artwork/audio.

No push, pull request, merge, version change, tag or release was performed.
