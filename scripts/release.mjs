import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const rawVersion = process.argv[2]
if (!rawVersion) {
    console.error('Usage: npm run release -- <version>')
    process.exit(1)
}

const version = rawVersion.startsWith('v') ? rawVersion.slice(1) : rawVersion
if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(`Invalid version "${rawVersion}". Expected format: MAJOR.MINOR.PATCH`)
    process.exit(1)
}

function run(command) {
    execSync(command, { cwd: repoRoot, stdio: 'inherit' })
}

const status = execSync('git status --porcelain', { cwd: repoRoot }).toString().trim()
if (status.length > 0) {
    console.error('Working tree is not clean. Commit or stash changes before running the release script.')
    process.exit(1)
}

const packagePath = path.join(repoRoot, 'package.json')
const manifestPath = path.join(repoRoot, 'manifest.json')

const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
const manifestJson = JSON.parse(readFileSync(manifestPath, 'utf8'))

packageJson.version = version
manifestJson.version = version

const jsonIndent = '\t'
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, jsonIndent)}\n`)
writeFileSync(manifestPath, `${JSON.stringify(manifestJson, null, jsonIndent)}\n`)

run('npm run format')
run('npm run verify')

run('git add package.json manifest.json docs/README.md')

try {
    run(`git commit -m "Release ${version}"`)
} catch (error) {
    console.error('Failed to create release commit. Aborting.')
    throw error
}

try {
    run(`git tag ${version}`)
} catch (error) {
    console.error('Failed to create git tag. Aborting.')
    throw error
}

console.log(`\nRelease ${version} prepared. Review changes, then push with:`)
console.log('  git push origin HEAD --tags')
