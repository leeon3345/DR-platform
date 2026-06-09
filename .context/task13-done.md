# TASK-13 Done: drctl CLI Core Commands

## Summary

Implemented `drctl` as a local Node.js CLI package in `cli/`.

The CLI is a thin DR Platform API client. It does not execute `kubectl`, `velero`, SSH, or other infrastructure commands directly.

## Added

- `drctl init --platform <url> --name <name>`
  - Calls `POST /api/auth/register`.
  - Writes `~/.drctl/config.json`.
  - Prints masked token and dashboard URL.
- `drctl cluster list`
  - Calls `GET /api/clusters`.
  - Prints token-scoped cluster table.
- `drctl cluster validate <clusterId>`
  - Calls `POST /api/clusters/:id/validate`.
  - Prints validation result and checks.
- `drctl policy set <clusterId> --namespace <namespace> --tier <tier> --rto <rto> --rpo <rpo>`
  - Reads current policy with `GET /api/clusters/:id/recovery-policy`.
  - Merges the namespace entry.
  - Updates via `POST /api/clusters/:id/recovery-policy`.
- `drctl recommend <clusterId>`
  - Calls `GET /api/clusters/:id/recommendations`.
  - Prints ranked table and first AI/fallback explanation.
- Global `--json`
  - Prints raw JSON for successful command responses.
  - Prints structured JSON errors on failure.

## Safety

- Config stores only `platformUrl` and the issued user token.
- Token is masked in human-readable output.
- API errors are printed in structured form and sanitized for token-looking values.
- `.gitignore` excludes local `.drctl` directories if they are accidentally created inside the repo.

## Verification

- `npm install` completed inside `cli/`.
- `node ./bin/drctl.mjs --help` printed help successfully.
- `node ./bin/drctl.mjs cluster list --json` produced a structured missing-config error.
- `npm link` completed successfully from `cli/`.
- `drctl --help` worked through the linked global command.
- A temporary localhost mock API verified:
  - `drctl init --platform http://127.0.0.1:3999 --name test-org`
  - `drctl cluster list`
  - `drctl cluster validate my-cluster`
  - `drctl policy set my-cluster --namespace order-service --tier critical --rto 1h --rpo 30m`
  - `drctl recommend my-cluster`
  - `drctl --json cluster list`

## Notes

- Live API command verification still requires a running DR Platform backend and a real dashboard token.
- `policy set` intentionally preserves existing namespace policies by reading first, replacing only the requested namespace, and posting the full policy list back to the backend.
