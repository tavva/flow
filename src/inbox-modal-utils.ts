import { ProcessingAction } from './types';


const ACTION_LABELS: Record<ProcessingAction, string> = {
	'create-project': 'Create New Project',
	'add-to-project': 'Add to Existing Project',
	'next-actions-file': 'Next Actions File',
	'someday-file': 'Someday/Maybe File',
	'reference': 'Reference (Not Actionable)',
	'person': 'Discuss with Person',
	'trash': 'Trash (Delete)',
	'discard': 'Discard (Ignore)'
};

export function getActionLabel(action: ProcessingAction): string {
        return ACTION_LABELS[action] ?? action;
}
