import type FlowPlugin from 'main'

import { settingsDefinitions } from './definitions'

export type FlowSettingsType = {
	[K in keyof typeof settingsDefinitions]: (typeof settingsDefinitions)[K]['defaultValue']
}

export const generateFlowSettings = () => {
	const FlowSettings: Partial<FlowSettingsType> = {}
	const RequiredSettings: (keyof FlowSettingsType)[] = []

	for (const key in settingsDefinitions) {
		if (settingsDefinitions.hasOwnProperty(key)) {
			const settingKey = key as keyof FlowSettingsType
			FlowSettings[settingKey] = settingsDefinitions[settingKey]
				.defaultValue as any
			RequiredSettings.push(settingKey)
		}
	}

	return {
		FlowSettings: FlowSettings as FlowSettingsType,
		RequiredSettings,
	}
}

export const { FlowSettings, RequiredSettings } = generateFlowSettings()
export const DEFAULT_SETTINGS: FlowSettingsType = FlowSettings

export async function getMissingSettings(
	plugin: FlowPlugin,
): Promise<string[]> {
	await plugin.loadSettings()
	return RequiredSettings.filter(
		(key) => !(plugin.settings && key in plugin.settings),
	)
}

export async function hasMissingSettings(plugin: FlowPlugin): Promise<boolean> {
	const missingSettings = await getMissingSettings(plugin)
	console.log('You are missing settings', missingSettings)
	return missingSettings.length > 0
}
