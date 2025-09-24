# Releasing Flow

These steps describe how to cut a new Flow release and publish it to both plugin repositories.

## 1. Prepare the release locally

1. Ensure the `main` branch is up to date and the working tree is clean.
2. Run `npm run release -- <version>` (a leading `v` in the input is ignored, so `npm run release -- v0.6.7` and `npm run release -- 0.6.7` behave the same). The script will:
   - update `package.json` and `manifest.json`
   - run the formatter and `npm run verify`
   - create a release commit and `<version>` tag
3. Review the build artefacts (`main.js`, `styles.css`, `manifest.json`) and any documentation edits before pushing.

If the script exits early, fix the reported issue and rerun it.

## 2. Push the release

1. Push the release branch and tag: `git push origin HEAD --tags`.
2. GitHub Actions will trigger the `Release Flow` workflow on the tag.

## 3. Monitor automation

1. The `preflight` job installs dependencies with `npm ci`, checks that the tag matches the bumped version numbers, and runs `npm run verify`.
2. When `preflight` succeeds, the `release` job drafts releases in both repositories and uploads `main.js`, `styles.css`, and `manifest.json` as artefacts.

## 4. Publish

1. Review the drafted release in `tavva/flow` and add notes or changelog text as needed.
2. Review the drafted release in `tavva/flow-release`; confirm that the README was synced.
3. Publish the releases when everything looks correct.

> Tip: If you need to abort a release, delete the local tag and commit, then remove the draft release(s) on GitHub.
