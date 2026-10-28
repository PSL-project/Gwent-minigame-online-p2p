# Release preparation

1. Review the local implementation branch/patch against base
   `08592d847f2573440a34deb9f32bc855b2544cdd`.
2. With repository-owner authorization, push `development/online-desktop`
   and open a pull request. Do not overwrite main or merge automatically.
3. Require the Windows desktop build workflow to pass, including real local
   WebRTC browser integration and packaged executable startup.
4. Test two Windows computers on supported internet connections: copy/join
   invitation using public PeerJS signaling, select decks, complete a match,
   disconnect/reconnect during a turn and during a choice, then finish.
5. Verify portable and installed application launch under a normal Windows user,
   offline AI gameplay, settings persistence and uninstall behavior.
6. Resolve third-party asset redistribution rights and retain original notices.
7. Optionally configure code signing; current artifacts are unsigned and use
   Electron's default executable icon.
8. Once separately authorized, publish reviewed CI artifacts with checksums and
   accurate release notes. Builds do not create or publish GitHub Releases.

Local cross-build status and verification limits are recorded in
DEVELOPMENT_STATUS.md. Do not publish a partially generated installer left by a
failed cross-build.
