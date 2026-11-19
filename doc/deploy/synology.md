# Native Synology DSM package

The eXeLearning SPK is a native DSM package. It contains the Bun-compiled Linux server and the immutable `public/`, `views/`, and `translations/` runtime trees, plus the locked production dependencies of jsdom (which reads its stylesheet from disk); DSM does not need Docker, Node.js, or a separately installed Bun runtime.

## Requirements and installation

- Synology DSM 7.2 or newer.
- An x86_64 (Intel/AMD) NAS. ARM packages are not currently built or supported.
- The `.spk` and matching `.spk.sha256` from the same eXeLearning stable, beta, or RC GitHub release.

Verify the checksum with `sha256sum --check exelearning-*.spk.sha256`, then choose **Package Center → Manual Install** and select the SPK. The package launcher and Package Center **Open** action start SSO at `/exelearning/login/synology`; the editor is below `/exelearning/`. Use the same HTTPS hostname and port as your logged-in DSM session; port 8085 is a loopback-only implementation detail.

## Architecture

DSM nginx proxies `/exelearning/` (including WebSocket upgrades) to the native server on `127.0.0.1:8085`. The server runs under DSM's unprivileged package account. It uses SQLite and the normal eXeLearning database migration process.

Immutable application files are below `$SYNOPKG_PKGDEST/app`. Persistent state is below the DSM-provided `$SYNOPKG_PKGVAR`:

```text
$SYNOPKG_PKGVAR/
├── config/runtime.env
├── data/exelearning.db
├── files/
├── logs/exelearning.log
└── run/exelearning.pid
```

No volume name or `/volume1` path is assumed.

## DSM single sign-on

The package enables the `synology` authentication provider. The launcher (or **Synology DSM** on the login page) redirects through the package CGI at `/webman/3rdparty/exelearning/auth.cgi`, which asks DSM's documented server-side `authenticate.cgi` mechanism to validate the existing DSM browser session. The browser never supplies a trusted username and eXeLearning never receives or stores the DSM password.

A small same-origin browser handshake retrieves the current DSM CSRF token from `/webman/login.cgi` and sends it in `X-Syno-Token` only to the package CGI. No password is requested, and the token is never put in a URL or forwarded to the application server. The CGI runs the same embedded executable in authentication mode, as the package account, with the environment provided by DSM. It transfers the assertion in an HttpOnly cookie; the browser then navigates to the fixed eXeLearning callback. The bridge uses an HttpOnly state cookie and a signed, one-minute, single-use assertion. The installation secret is generated from `/dev/urandom`, stored in `config/runtime.env` with mode 0600, and preserved during upgrades. The callback creates a stable `synology:<username>` external identity on first login and assigns `ROLE_USER`. Its required placeholder email is deterministic and uses the non-routable `.invalid` domain. Administrator-group mapping is deliberately not guessed: use the local administrator bootstrap below when an application administrator is required.

Logging out ends only the eXeLearning session; it does not log the user out of DSM.

## Administrator bootstrap

New DSM users always receive `ROLE_USER`. A DSM administrator can promote a known existing external identity locally without enabling password login:

1. Log into eXeLearning once as that DSM user.
2. Stop eXeLearning in Package Center.
3. In an administrative SSH shell, open the database with `sqlite3 /var/packages/exelearning/var/data/exelearning.db`.
4. Inspect identities with `SELECT id, external_identifier, roles FROM users;`.
5. Promote the intended identity, replacing `alice` with the exact DSM username (escape any SQL quote as two quotes):

   ```sql
   UPDATE users SET roles = '["ROLE_USER","ROLE_ADMIN"]'
   WHERE external_identifier = 'synology:alice';
   SELECT changes();
   .quit
   ```

   The update must affect exactly one account.
6. Start the package and log out of eXeLearning, then enter again to refresh its session roles.

Only an administrator with access to the package database can perform this operation. No browser-provided group or role is trusted.

## Upgrade, uninstall, backup, and logs

Both application-version upgrades and package-revision upgrades replace `$SYNOPKG_PKGDEST` while retaining `$SYNOPKG_PKGVAR`, including the database, files, configuration, and generated secrets. The uninstall lifecycle script does not erase persistent data. DSM administrators remain responsible for choosing whether to remove retained package data after uninstall.

Stop the package or take a consistent SQLite snapshot before backing up the complete package variable directory to a protected backup location. This includes the authentication secrets. The SPK does not register a Hyper Backup application integration; to use Hyper Backup, first create a protected copy in a shared folder included in the backup task. Runtime output is appended to `$SYNOPKG_PKGVAR/logs/exelearning.log`. If startup fails, inspect that file, verify free space and ownership, and use Package Center to stop/start the service.

## Local build

From an exact release checkout with Bun 1.4.2 and dependencies installed:

```bash
bun install --frozen-lockfile
make package-synology VERSION=4.0.6 PACKAGE_REVISION=1
(cd release && sha256sum --check exelearning-4.0.6-1-x86_64.spk.sha256)
bash packaging/synology/smoke-test.sh release/exelearning-4.0.6-1-x86_64.spk
```

`VERSION` is mandatory and may include a SemVer prerelease (`4.1.0-beta.1` or `4.1.0-rc.2`). It identifies the checked-out release; the builder never reads the development placeholder from `package.json` and never searches GitHub. `PACKAGE_REVISION` defaults to `1`. Output names include both revision and architecture. DSM metadata uses numeric ordering: `<major>.<minor>.<patch>.<stage>.<sequence>-<revision>`, where alpha=0, beta=1, RC=2 and stable=3. Thus `4.1.0-beta.1` revision 2 becomes `4.1.0.1.1-2`, before `4.1.0.3.0-1`. The original SemVer remains in `app_version`, `app/VERSION`, the running application and the filename. Unsupported or ambiguous versions fail the build.

`make package-synology` builds the normal assets once and cross-compiles the server plus CGI entry point. On Linux x86_64, the smoke check executes the extracted server as an unprivileged user and exercises SQLite, templates and static assets. On macOS it performs archive validation; executable checks require Linux/DSM. Other standalone/Electron builds keep their existing entry point.

The release workflow checks out the exact release tag, builds from it and uploads to that existing release. Stable, beta and RC releases use the same workflow. Manual runs require an existing version tag and upload workflow artifacts only.

## Troubleshooting

- Read `/var/log/synopkg.log` as a DSM administrator for installation/resource errors. Application output is in the package log above.
- If login is rejected, first log into DSM using the same HTTPS hostname and port, then open eXeLearning from DSM. The bridge fails closed if DSM does not validate that session.
- Slow first startup can include SQLite migration I/O; inspect the log before interrupting it. A DS918+ test took approximately three minutes for the first database initialization.
- Current Bun x64 builds require SSE4.2 and work without AVX2. The tested DS918+ Celeron J3455 runs Bun 1.4.2. Do not substitute an older AVX2-only binary.
- Port 8085 must be unused on loopback. Changing the internal port requires updating both the runtime configuration and package proxy configuration together; the installer does not expose it as a public listener.

## Known limitations and required NAS verification

Automated tests validate metadata rendering, archive layout and permissions, bundled runtime assets, service configuration, nginx/WebSocket directives, checksums, and authentication cryptography without a NAS. A DS918+ running DSM 7.2.2 has been used to verify native installation, package-account startup, loopback binding, nginx registration, DSM session authentication without a password prompt, and upgrades preserving database and configuration checksums. See the [verification record](../architecture/changes/41-native-synology-package/research.md) for the scope and remaining checks. Previous container-package tests do not validate this implementation. ARM support is not advertised until a native armv8 package has completed the same matrix.

References: [DSM application authentication](https://help.synology.com/developer-guide/integrate_dsm/web_authentication.html), [DSM persistent package directories](https://help.synology.com/developer-guide/integrate_dsm/fhs.html), [DSM web configuration](https://help.synology.com/developer-guide/resource_acquisition/web_config.html), [Bun CPU requirements](https://bun.com/docs/installation#cpu-requirements).
