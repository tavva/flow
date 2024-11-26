import fs from 'fs'
import path from 'path'

const filesToUpdate = [
	{ path: './manifest.json', key: 'version' },
	{ path: './package.json', key: 'version' },
]

const updateVersion = (filePath: string, newVersion: string, key: string) => {
	// We edit this as a string so to preserve original formatting
	const fullPath = path.resolve(filePath)
	const content = fs.readFileSync(fullPath, 'utf8')

	const updatedContent = content.replace(
		new RegExp(`"${key}"\\s*:\\s*".*?"`, 'g'),
		`"${key}": "${newVersion}"`,
	)

	fs.writeFileSync(fullPath, updatedContent, 'utf8')
	console.log(`Updated ${filePath}`)
}

// const updateVersion = (filePath: string, newVersion: string, key: string) => {
// 	const fullPath = path.resolve(filePath)
// 	const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
// 	content[key] = newVersion
// 	fs.writeFileSync(fullPath, JSON.stringify(content, null, 2) + '\n')
// 	console.log(`Updated ${filePath}`)
// }

const main = () => {
	const version = process.argv[2]
	if (!version) {
		console.error(
			'Please provide a version number as an argument, e.g., "1.0.0".',
		)
		process.exit(1)
	}

	filesToUpdate.forEach((file) => {
		updateVersion(file.path, version, file.key as string)
	})
}

main()
