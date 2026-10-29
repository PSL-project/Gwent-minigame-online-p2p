# Gwent (Classic P2P Online)

**Classic Gwent. Private matches with friends. A standalone Windows experience.**




Play the original Gwent minigame against the AI, or invite a friend to a private
online match with a single code. Gwent Classic Online preserves the familiar
cards, factions, leaders and board while adding an integrated multiplayer lobby,
host-controlled rules and reconnection support.



<img width="1417" height="920" alt="image" src="https://github.com/user-attachments/assets/dadf86c4-cea1-43ac-ad02-edb4f796b57a" />

No game account, manually configured game server, port forwarding or offer/answer
exchange is required. Online connectivity depends on the players’ networks and
public signaling availability; see [Networking](#networking).






## Features

- **Single player, offline:** the original AI, rules, local sound effects and deck editor.
- **Native graphical multiplayer:** click the original hand cards, battlefield, leader card and Pass control as host or guest. Host or join from the opening screen.
- **One invitation:** copy the host’s code, share it privately and paste it into Join.
- **Your decks:** customize factions, leaders and card collections with the original editor; import/export deck JSON and save local settings.
- **The original rules engine:** card placement, weather, spies, muster, medics, decoys, leaders, faction perks, scoring and round resolution run on the host.
- **Private guest views:** the guest receives its own hand, public board/discards and counts, without the host’s hand or draw-pile contents.
- **Recoverable sessions:** interrupted connections pause play and attempt authenticated reconnection while both applications remain open.
- **Windows packaging:** portable executable and installer targets, bundled game assets and automated Windows builds.


## Play against the AI

1. Choose **Single Player**.
2. Pick a faction and leader, and customize your deck.
3. Select **Start game**, then keep or redraw up to two cards.
4. Play with the original board controls.

Single player runs independently of signaling and internet connectivity. Music is
optional and streams from YouTube when requested; its availability does not affect
local gameplay. Sound effects are bundled.

## Host a match

1. Open **Host Online Game**.
2. Use **Copy invitation** and send the complete `GC1-…` code privately to your friend.
3. Choose **Select & Customize Deck**, then confirm your deck with **Ready**.
4. The match starts automatically when both players are connected and ready.

**Unready** lets you change your confirmed deck before the match starts. Invitations
contain a private session secret: only share one with the intended opponent.
One guest seat is supported. After it is claimed, recovery is bound to that guest’s
in-memory credential.

## Join a friend

1. Paste the entire invitation into the opening screen.
2. Select **Join Online Game** and wait for the connection status.
3. Select/customize your deck, then confirm **Ready**.
4. Complete the redraw prompts and take your turns.

Both players must use the **native multiplayer UI build**, currently version **1.0.0**. Older builds with the same version number may use the previous action panel; incompatible gameplay views are rejected with an update message.
No separate code-lookup service is used: the invitation directly identifies the
host’s signaling peer and includes the session secret.

## Controls and gameplay

Win two rounds by building the stronger army and managing the cards in your hand.
Each normal turn plays one card, uses an available leader ability, or passes.
After one player passes, the other may continue playing until passing too.
Faction perks and card effects can modify the outcome of a tied round.

| Mode/control | Interaction |
| --- | --- |
| Single player | Select a hand card, then its destination; select your leader to use its ability; choose **Pass** to pass. |
| Online turns | Click an actual card in your hand, then click its highlighted battlefield row or weather area. Click a highlighted unit to replace it with a Decoy. |
| Pass | Use the original **Pass** control on the left of the board. It becomes available only when passing is legal. |
| Leaders | Click your leader card, then the large central card in its confirmation carousel to activate it. |
| Redraw and special choices | Browse the original graphical carousel and click its central card. **Done / keep remaining cards** ends an optional redraw; required choices must be answered. Agile resurrection uses highlighted rows. |
| Inspect cards | Click hand cards, battlefield cards, leaders or discard piles to view their artwork and abilities, including outside your turn. Opposing hands and draw-pile contents remain hidden unless a rule authorizes a reveal. |
| Cancel a selection | Click the selected hand card again or press **Escape**. Required ability choices cannot be skipped. |
| Connection controls | The top bar shows connection status, **Retry connection** and **Leave session**. |
| Fullscreen | **F11**, or View → Toggle Fullscreen in the desktop menu. |
| Audio/notifications | Use the original settings icons; settings are stored locally. |

Both players use the same board controls. A selected card is outlined in gold; only host-authorized destinations are highlighted. The board changes after the host accepts an action. During processing or disconnection, new gameplay submissions are disabled.

The original result screen reports each completed round. Choose **Return to menu** to start another session with a new invitation, or switch to single player. No separate text-based gameplay action list is displayed.

## Networking

PeerJS uses its public signaling service to introduce the two applications.
WebRTC then carries reliable, ordered game messages over an encrypted DataChannel.
The game does not require a server operated by this project.

The host runs the original game engine and all gameplay randomness. The guest
submits a host-issued action identifier; the host checks its owner and state
revision before executing it. Each permission is consumed once, preventing
repeated or stale actions from executing again. Guest snapshots explicitly include
only the information needed for that player’s view and current legal choices.
Ability-authorized reveals, such as viewing three opposing hand cards, remain
part of the original rules.

Invitations use cryptographically random identifiers and secrets. Connection
handshakes prove knowledge of the invitation secret with HMAC-SHA-256; returning
guests must also retain their original recovery credential. Network messages are
size/rate bounded, version checked and treated as untrusted data.

**Network coverage:** the bundled configuration uses STUN and does not provide a
TURN relay. Symmetric NAT, restrictive firewalls, blocked UDP, VPN policies and
some carrier networks can prevent a connection. The public signaling service
also has no availability guarantee from this project. There is no promise that
all network configurations work. Try another network when direct connectivity
is unavailable; relay support is a useful future contribution.

## Disconnection and recovery

A channel closure or missed heartbeat pauses new gameplay actions. During an
already accepted action, the engine waits at its mutation/turn boundaries; it
does not restart or replay that action on reconnection.

Keep both applications open. The guest automatically retries, the host resumes
listening, and the returning guest authenticates before receiving a fresh filtered
snapshot, including any pending choice. **Retry connection** requests another
attempt. **Leave session** abandons the match and returns to the opening screen.
Heartbeat detection can take approximately 12 seconds when a connection stalls
without an explicit close event.

Recovery is in memory. Closing/reloading either application loses its session;
saving a match across application restarts is not implemented.



## Download and Windows installation

Open the [Releases page](https://github.com/PSL-project/Gwent-minigame-online-p2p/releases)
and choose a build whose notes include native multiplayer controls. Existing
releases may predate this development branch; no new release is created by these
source changes.

Extract the downloaded archive before running it. Use the `setup-x64.exe` to
install the application, or launch the `portable-x64.exe` directly. Players need
64-bit Windows 10 or Windows 11; Node.js and development tools are not required
for the packaged application. Both players should install the same build.

## Build and contribute

Development requires Node.js 24 and npm. From a checkout of
`feature/native-multiplayer-ui`:

```sh
npm ci
npm start
```

Run the checks and build on Windows:

```sh
npm run check
npm test
npm run test:integration
npx playwright install chromium
npm run test:browser
npm run dist:win -- --publish never
```

The browser suite uses two independent clients and local test-only PeerJS
signaling. For deterministic UI testing where native WebRTC is blocked, set
`SIMULATE_WEBRTC=1` before running it. In PowerShell:

```powershell
$env:SIMULATE_WEBRTC = "1"
npm run test:browser
Remove-Item Env:SIMULATE_WEBRTC
```

Windows builds produce portable and installer executables in `dist/`. The
**Windows desktop build** Actions workflow runs tests, packages both targets and
smoke-tests the packaged application. Download successful build outputs from its
**Artifacts** section. It does not automatically publish a release.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance,
[DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) for actual verification results,
and [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) before publishing.

The native UI only presents snapshots and submits permissions. The host runs the
original DOM-backed engine in a separate hidden document; its DOM is independent
of both visible boards. Incoming actions still contain only a permission ID and
revision, so graphical input never bypasses host validation. Per-card IDs
separate identical copies without exposing hidden opponent cards.

## Verification and current limitations

- **Passed locally:** 15 automated tests, including original scoring/effects,
  all 17 active leaders, protocol/security/recovery and native-input validation.
- **Passed locally:** three complete simulated multiplayer matches covering all
  five factions and a complete original single-player AI match.
- **Passed locally:** two-context Chromium click tests for host and guest cards,
  placement, Pass, redraw, spy, decoy, medic/agile resurrection, weather/clear,
  horn, scorch, leader choices, reconnect, complete results and another game.
  These tests use simulated delivery and do not prove internet connectivity.
- **Network verification outstanding:** the real local WebRTC test was executed
  here but could not establish a channel. Public PeerJS invitation joining and
  recovery need a manual match between two Windows computers on supported networks.
- **Packaging:** a Windows x64 portable EXE was cross-built. The local NSIS build
  stopped on missing Wine; Windows installer generation and packaged startup
  remain checks for Windows CI. Local Electron startup failed because this
  environment has no graphical display. See the development status for details.
- No exhaustive claim is made for every card combination. The host is trusted:
  guest filtering is not an anti-cheat guarantee against a modified host.
- There is no TURN service, spectator mode, public matchmaking, account system,
  application-restart recovery or automatic update service.

## Licensing and attribution

Original Gwent Classic by **Arun Sundaram**. See the
[original project](https://github.com/asundr/gwent-classic).
Sound-effect contributions were credited by the original project to
[RandomPianist](https://github.com/RandomPianist/gwent-classic-v3.1).

The original [LICENSE](LICENSE) is preserved unchanged. It identifies MIT as the
underlying license and includes **Commons Clause License Condition v1.0**, which
restricts sale. The repository does not contain the full standard MIT grant text;
this project does not infer additional permissions from that omission. Preserve
all required notices and do not describe this as unrestricted MIT software.

The Witcher, Gwent, their art, audio, fonts, characters and trademarks belong to
their respective rights holders, including CD PROJEKT where applicable. 


Dependency attributions and additional details are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).


## Android integration checkpoint

Branch `feature/android-support` includes Capacitor 8.6.0, the generated Android
project, locally bundled shared game assets and a debug APK Actions workflow.
Run `npm ci`, `npm run android:sync`, then `bash android/gradlew -p android assembleDebug`
with Java 21 and Android SDK 36 installed. Minimum Android API is 24.
Generated web assets and build outputs are not tracked. The debug APK is for testing;
no production signing credentials or release publication are configured.
Download successful workflow artifacts, extract the APK and allow installation
from the browser/file manager when Android requests it.

Synchronization passed locally. APK compilation, installation, Android back-button
behavior, safe-area/aspect-ratio coverage, offline device gameplay and physical
Windows/Android internet matches remain unverified. Current touch changes are
initial adaptations, not a completed mobile-layout validation. Sound effects are
local; optional YouTube music still requires internet. Do not describe this
checkpoint as a verified Android release.

For a combined release, separately run Windows and Android workflows on the same
reviewed commit, download their artifacts and manually attach both EXEs and the APK
to one draft GitHub Release. Actions artifacts are not release attachments.
Before production distribution, configure release signing outside Git, retain the
same private signing key for future updates and verify an upgrade on a device.
