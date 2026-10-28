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


<img width="1919" height="1028" alt="image" src="https://github.com/user-attachments/assets/5b2e0b93-ccc8-4c0c-b95f-bcbebe72679c" />



## Features

- **Single player, offline:** the original AI, rules, local sound effects and deck editor.
- **Private two-player multiplayer:** Host Online Game or Join Online Game from the opening screen.
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

Both players must run version **1.0.0**. Incompatible clients are rejected.
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
| Online turns | Use the action bar along the bottom. Select a card, then choose a destination/target when more than one is legal. |
| Online choices | Answer redraw, medic, leader and faction prompts in the same action bar. |
| Inspect cards | Read your hand, leaders, public board and discard-pile abilities through **Inspect cards**. |
| Connection controls | The top bar shows connection status, **Retry connection** and **Leave session**. |
| Fullscreen | **F11**, or View → Toggle Fullscreen in the desktop menu. |
| Audio/notifications | Use the original settings icons; settings are stored locally. |

The online result screen reports each completed round. Return to the menu to
start another session with a new invitation.

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



## Verification and current limitations

- Automated rules/transport tests pass, including all 17 active leader abilities,
  scoring, weather, bond, horn, spy, muster, medic, agile choices and decoy targeting.
- Complete simulated multiplayer matches cover all five factions; a complete AI
  match and a two-context graphical match with simulated transport also pass.
- This development environment exchanges real PeerJS offers/answers but produces
  no native ICE candidates. End-to-end direct WebRTC connectivity and the public
  signaling invitation flow still require verification on supported networks.
- A Windows portable package has been cross-built. Native Windows startup is
  delegated to CI; local Linux root/sandbox restrictions prevent a valid desktop
  runtime check. The local installer build requires unavailable Wine tooling.
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
their respective rights holders, including CD PROJEKT where applicable. This is an
unofficial fan project, without affiliation or endorsement. Source-code licensing
does not establish permission to redistribute those assets. Asset clearance has
not been established; maintainers must resolve applicable rights before public
binary distribution.

Dependency attributions and additional details are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
