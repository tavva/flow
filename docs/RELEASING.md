# Releasing Flow

These steps describe how to cut a new Flow release and publish attested release assets.

## 1. Prepare the release locally

1. Ensure the `main` branch is up to date and the working tree is clean.
2. Run `npm run release`. The script will:
   - run the formatter check and full test suite
   - prompt for the version bump and release notes
   - update `package.json`, `manifest.json`, and `versions.json`
   - build the plugin locally so you can catch build failures before publishing
   - create and push the release commit
   - create a draft GitHub release with the release notes, but without local asset uploads
3. Review the local build artifacts (`main.js`, `styles.css`, `manifest.json`) and any documentation edits before confirming the release.

If the script exits early, fix the reported issue and rerun it.

## 2. Let CI Publish Assets

The `Release Flow` workflow runs when the release tag is created.

It validates that the tag, `package.json`, and `manifest.json` versions match, installs dependencies with `npm ci`, runs `npm run verify`, checks that `main.js`, `styles.css`, and `manifest.json` exist, generates GitHub artifact attestations for those files, and uploads them to the draft release.

Do not manually upload release assets during the normal flow. Locally uploaded assets cannot receive GitHub Actions provenance attestations, so the Obsidian community scanner may continue to report missing attestations.

## 3. Publish

1. Open the draft release in `tavva/flow`.
2. Confirm that `manifest.json`, `main.js`, and `styles.css` are attached.
3. Confirm that the workflow generated artifact attestations for the release assets.
4. Publish the release when everything looks correct.

## 4. Manual Fallback

If the workflow is unavailable, run `npm run build` and upload `manifest.json`, `main.js`, and `styles.css` with `gh release upload <tag> ... --clobber`.

Treat this as an emergency fallback only. After CI is available again, rerun the release workflow or replace the assets through CI so the release has attestations.

> Tip: If you need to abort a release, delete the local tag and commit, then remove the draft release(s) on GitHub.
