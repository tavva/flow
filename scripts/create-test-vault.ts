import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import os from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const obsidianPath = '/Applications/Obsidian.app/Contents/MacOS/Obsidian'
const defaultVaultPath = path.join(__dirname, '../tests/DefaultTestVault')
const tempVaultPath = path.join('/tmp', 'TestVault_' + Date.now())
const obsidianConfigPath = path.join(
	os.homedir(),
	'Library/Application Support/obsidian/obsidian.json',
)

;(async () => {
	try {
		// Copy default vault
		console.log(defaultVaultPath, tempVaultPath)
		fs.copySync(defaultVaultPath, tempVaultPath)

		console.log(obsidianPath, tempVaultPath)

		// Read the current Obsidian configuration
		const obsidianConfig = fs.readJsonSync(obsidianConfigPath)

		// Generate a unique ID for the new vault
		const vaultId = Math.random().toString(36).substring(2, 15)

		// Add the new vault to the configuration
		obsidianConfig.vaults[vaultId] = {
			path: tempVaultPath,
			ts: Date.now(),
			open: true,
		}

		// Write the updated configuration back to file
		fs.writeJsonSync(obsidianConfigPath, obsidianConfig, { spaces: 2 })

		// Close Obsidian to ensure the URI open works
		await new Promise<void>((resolve, _reject) => {
			exec(`pkill -f "${obsidianPath}"`, (error) => {
				if (error) {
					console.warn('Failed to close Obsidian:', error)
					resolve() // Proceed even if closing fails
				} else {
					resolve()
				}
			})
		})

		// Wait for Obsidian to close
		await new Promise((resolve) => setTimeout(resolve, 3000)) // Wait for 3 seconds

		// Open the vault using the Obsidian URI scheme with the vault ID
		const vaultUri = `obsidian://open?vault=${encodeURIComponent(vaultId)}`
		await new Promise<void>((resolve, reject) => {
			exec(`open "${vaultUri}"`, (error) => {
				if (error) {
					reject(error)
				} else {
					resolve()
				}
			})
		})
	} catch (error) {
		console.error('Test failed:', error)
	}
})()
