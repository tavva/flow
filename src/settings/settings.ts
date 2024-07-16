import type FlowPlugin from 'main'

import { settingsDefinitions } from './definitions'
import type { SettingDefinition, SettingsDefinitions } from './definitions'

export type FlowSettingsType = {
	[K in keyof typeof settingsDefinitions]: (typeof settingsDefinitions)[K]['defaultValue']
}

export const generateFlowSettings = () => {
	const FlowSettings: Partial<FlowSettingsType> = {}

	for (const key in settingsDefinitions) {
		if (settingsDefinitions.hasOwnProperty(key)) {
			const settingKey = key as keyof FlowSettingsType
			FlowSettings[settingKey] = settingsDefinitions[settingKey]
				.defaultValue as any
		}
	}

	return FlowSettings
}

export const FlowSettings = generateFlowSettings()
export const DEFAULT_SETTINGS: Partial<FlowSettingsType> = FlowSettings

type FilteredSettings = {
	[K in keyof SettingsDefinitions]?: SettingsDefinitions[K]
}

export async function getInvalidSettings(
	plugin: FlowPlugin,
): Promise<[string, SettingDefinition<any>][]> {
	await plugin.loadSettings()

	const invalidSettings: [string, SettingDefinition<any>][] = []
	;(
		Object.keys(settingsDefinitions) as Array<keyof SettingsDefinitions>
	).forEach((key) => {
		const setting = settingsDefinitions[key]
		const checkResult = setting.check(plugin.settings[key], plugin)
		if (checkResult !== true) {
			invalidSettings.push([checkResult as string, setting])
		}
	})

	return invalidSettings
}

export async function hasInvalidSettings(plugin: FlowPlugin): Promise<boolean> {
	const invalidSettings = await getInvalidSettings(plugin)
	return invalidSettings.length > 0
}
