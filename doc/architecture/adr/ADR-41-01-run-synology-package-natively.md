---
id: ADR-41-01
title: "Run the Synology package as a native DSM service"
status: Proposed
date: 2026-09-17
tracking_issue: 41
deciders:
  - "@ateeducacion"
reviewers: []
related:
  prs: [41]
  changes: [41-native-synology-package]
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "OpenAI Codex"
  model: "GPT-6"
---

# ADR-41-01: Run the Synology package as a native DSM service

## Context

The initial SPK delegated execution and persistence to Synology Container Manager. Releases already build a Bun standalone executable, while eXeLearning reads immutable web resources from the repository runtime trees.

## Problem

Should the official DSM artifact depend on a separately managed container runtime or contain the application runtime itself?

## Decision drivers

- Build every official artifact from the same checked-out tag.
- Avoid optional NAS runtime dependencies and exposed backend ports.
- Preserve application state independently of replaceable package files.
- Authenticate an existing DSM session without receiving DSM credentials.

## Options considered

### Container Manager wrapper

Small, but installation and startup depend on another package, an image registry, and mutable image tags.

### Native compiled service

Larger, but self-contained and versioned with the other release artifacts.

## Evidence

- `scripts/build-standalone.js` compiles the server with the Bun runtime embedded.
- `src/index.ts` and `src/shared/export/providers/FileSystemResourceProvider.ts` access `public/`, `views/`, and `translations/` at runtime.
- Synology's Package Developer Guide documents `authenticate.cgi` for validating the current DSM web session: <https://help.synology.com/developer-guide/integrate_dsm/web_authentication.html>.

## Decision

The x86_64 DSM 7.2 SPK will contain the compiled Linux server and required immutable runtime assets. It runs as the package account on loopback, stores mutable state under `SYNOPKG_PKGVAR`, and is exposed by a package nginx route. A same-origin browser handshake obtains DSM's existing CSRF token from `webman/login.cgi` and passes it only in the package CGI request header, never in a URL or to the core server. DSM runs the package CGI as that same account; the CGI invokes the embedded executable in authentication mode, validates the existing session using DSM's CGI environment, and sends a state-bound signed assertion to the fixed callback in an HttpOnly cookie. A modular Synology provider maps verified identities to external eXeLearning users and reuses the existing session implementation. No extra daemon or privileged/setuid bridge is required.

The locked production dependency tree for jsdom remains on disk because it loads assets relative to its package directory. Standalone builds explicitly enable Bun's package.json resolution. Other server dependencies remain embedded. The normal web asset build is shared with existing packaging targets.

## Consequences

### Positive

- The installed package needs no container engine, Node.js, Bun installation, or registry access.
- Release identity, architecture, and package revision are explicit and reproducible.
- Upgrades replace immutable files without replacing user data or installation secrets.

### Negative

- The artifact includes the web resource trees and is substantially larger.
- Physical verification on DSM 7.2.2 is recorded in the linked change document; its remaining integration matrix must be completed before release.
- A separate verified build is required before armv8 can be supported.
