# Attribution and redistribution notices

## Original game

Gwent Classic by Arun Sundaram (https://github.com/asundr/gwent-classic).
The original LICENSE is retained unchanged: it identifies MIT as the license
and includes the Commons Clause License Condition v1.0, which restricts sale.
The repository's LICENSE does not contain the full standard MIT grant text;
this project does not infer additional permissions from that omission.
Keep the original notice and this attribution with copies. Do not represent
this project as unrestricted MIT software or sell it contrary to its terms.

Sound-effect contributions were credited by the original project to
RandomPianist (https://github.com/RandomPianist/gwent-classic-v3.1).

## Game art, audio, fonts and trademarks

The Witcher, Gwent, related characters, artwork, audio, fonts and marks belong
to their respective rights holders, including CD PROJEKT where applicable.
This is an unofficial fan project, without affiliation or endorsement.
A source-code license does not establish redistribution rights for these
third-party assets. No asset clearance has been established here. Before
public binary distribution, determine the applicable rights and obtain any
necessary permission. The existing repository media is reused unchanged.

## Added dependencies

- PeerJS: MIT, https://github.com/peers/peerjs
- Electron: MIT, https://github.com/electron/electron; includes Chromium,
  Node.js and other components under their own licenses. Preserve Electron's
  LICENSE and LICENSES.chromium.html in unpacked distributions.
- electron-builder: MIT, https://github.com/electron-userland/electron-builder
- Playwright (development/tests): Apache-2.0, https://github.com/microsoft/playwright

Dependency notices and license texts ship with their installed packages.
PeerJS is copied locally at install time from the pinned npm dependency;
its installed package license is retained in the bundled dependencies. No private keys or TURN credentials
are distributed. Builds are unsigned unless a maintainer adds signing.
