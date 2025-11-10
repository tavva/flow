# Publishing Flow CLI

## Preparation

1. Update version in `flow-cli/package.json`
2. Run tests: `npm test`
3. Run build: `npm run build`
4. Verify manual test works

## Publishing to npm

```bash
cd flow-cli
npm publish --access public
```

## Installation

Users install globally:

```bash
npm install -g @flow/cli
```

## Verification

```bash
flow --version
flow --help
```
