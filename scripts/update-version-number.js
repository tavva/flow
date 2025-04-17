import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const filesToUpdate = [
    { path: 'manifest.json', key: 'version' },
    { path: 'package.json', key: 'version' },
]

const updateVersion = (filePath, newVersion, key) => {
    // We edit this as a string so to preserve original formatting
    const fullPath = path.resolve(rootDir, filePath)
    const content = fs.readFileSync(fullPath, 'utf8')

    const updatedContent = content.replace(
        new RegExp(`"${key}"\\s*:\\s*".*?"`, 'g'),
        `"${key}": "${newVersion}"`,
    )

    fs.writeFileSync(fullPath, updatedContent, 'utf8')
    console.log(`Updated ${filePath}`)
}

const main = () => {
    const version = process.argv[2]
    if (!version) {
        console.error(
            'Please provide a version number as an argument, e.g., "1.0.0".',
        )
        process.exit(1)
    }

    filesToUpdate.forEach((file) => {
        updateVersion(file.path, version, file.key)
    })
}

main()
