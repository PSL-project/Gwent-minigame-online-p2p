# Release preparation

1. Apply/review the native UI changes on `feature/native-multiplayer-ui`, based on
   `623fa31ff81e674dedc2f41179222f2f659a7b22`. Do not overwrite main.
2. Run the Windows desktop build workflow for that branch. Require checks, all
   tests, simulated native UI coverage, real local WebRTC coverage, portable/NSIS
   packaging and the packaged startup/multiplayer smoke check to pass.
3. Download the workflow’s Windows x64 artifact. Confirm both executables exist;
   do not publish an incomplete installer produced by a failed Linux cross-build.
4. On two Windows PCs, test public PeerJS invitation host/join, ready/deck choice,
   redraw, native hand selection, row selection, Pass, leader, medic and decoy.
   Check scores, hidden hands, round results and final results on both screens.
5. Disconnect during a normal turn and a mandatory ability choice. Confirm play
   pauses, authenticated recovery restores the board/choice, and no stale click
   is replayed. Keep both applications open throughout recovery.
6. Start another online session and a single-player AI game. Check deck editing,
   sound/notification settings, portable startup, installation and uninstall.
7. Review THIRD_PARTY_NOTICES and asset redistribution rights. Keep all original
   notices. Current binaries are unsigned and use Electron’s default icon.
8. Publish reviewed binaries only with separate authorization. Do not reuse old
   action-panel binaries for these source changes. No app version, release tag
   or automated release publishing was changed in this work.

Actual local results and outstanding environment checks are recorded in
DEVELOPMENT_STATUS.md. Simulated UI success is not proof of real internet P2P.
