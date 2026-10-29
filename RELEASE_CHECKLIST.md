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
