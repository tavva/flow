import { Plugin } from 'obsidian'

interface StaticFunctions {
	get(name: string): Promise<Function>
}

export interface Module {
	name: string
	static_functions: StaticFunctions
}

interface Settings {
	template_folder: string
}

interface InternalFunctions {
	modules_array: Module[]
}

interface FunctionsGenerator {
	internal_functions: InternalFunctions
}

export interface TemplaterPlugin extends Plugin {
	templater: {
		functions_generator: FunctionsGenerator
	}
	settings: Settings
}
