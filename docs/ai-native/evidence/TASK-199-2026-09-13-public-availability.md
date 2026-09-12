# TASK-199 — Public availability and release identity recheck

Date: 2026-09-13, Asia/Singapore. This record is a read-only public-ingress
recheck. It does not claim alert delivery, incident ownership, rollback
execution, database/storage mutation or owner acceptance.

## Identity and scope

- **Task:** TASK-199, restore public availability and prove the deployed revision.
- **Selected gap:** the public release identity and health evidence needed a
  fresh probe after the prior 2026-09-11 recovery record.
- **Expected result:** the approved public origin returns healthy root, health,
  setup-status and release-manifest responses; every listed asset matches its
  declared byte count and SHA-256; final URLs stay within the expected origin;
  and the running revision equals the approved revision.
- **Actor / environment:** Codex on local macOS, root `main` source at
  `f9ac259ce0e97bb21cec6866442f54fb4ff9ddde`, target `erp-public`, public
  HTTPS origin `https://gmb01.xyz/erp`. The command was read-only and used no
  credentials or production writes.
- **Repository handoff:** 32 dirty paths were preserved, the index was empty,
  and no unmerged paths existed. The task registry SHA-256 was
  `855379cc19dc76a2c028bbe6bf20281225769d0d3d96d0e3a85f027177af7a65` at
  probe time. The persisted TASK-199 evidence note then updated the current
  registry hash to
  `1f81e33f285e51c69ed30d5fa2cd41a5ca281c7cb6037700cee621aab719352e`.

## Verification command and result

Command:

```bash
npm run check:availability -- https://gmb01.xyz/erp \
  --expected-revision 03487b13ce838407d97cd00697bd2b54b4a7c918 \
  --target erp-public
```

Observed result at `2026-09-12T18:33:53.230Z` UTC:

```json
{
  "status": "healthy",
  "target": "erp-public",
  "revision": "03487b13ce838407d97cd00697bd2b54b4a7c918",
  "fileCount": 126,
  "checks": {
    "root": true,
    "health": true,
    "setupStatus": true,
    "releaseManifest": true,
    "assetHashes": true,
    "revisionMatch": true,
    "finalUrlsReviewed": true
  }
}
```

The command exited 0. It verified the public root, health, setup status,
release manifest, all 126 asset hashes and byte counts, revision equality and
final-URL policy without sending an alert or changing remote state.

## Acceptance boundary

This recheck strengthens TASK-199 acceptance evidence for public availability
and exact deployed revision. The task remains **In Progress** because its
operational acceptance still requires an approved alert destination, a named
incident responder, an observed alert and an exercised application-only
rollback drill. Public read-only health does not prove those controls.

The next measurable exit is for the Operations/release owner to connect the
source-controlled checker to the approved alert sink, record a sanitized test
delivery and perform the separately authorized rollback drill with the exact
immutable image reference. No alert endpoint, token or private configuration
was recorded here.
