import { getFormattedVariableValue, isTypeVariableAlias } from "./variable-utils";


/**
 * Fetches all local variable collections from Figma.
 * @returns An array of variable collections with an id, name, and modes property.
 * */
export async function getVariableCollectionArray() {
	const variableCollectionArray = (await figma.variables.getLocalVariableCollectionsAsync())
		.filter(collection => !collection.name.startsWith('_'))
		.map(collection => ({
			id: collection.id,
			name: collection.name,
			modes: collection.modes
		}));
	return variableCollectionArray;
}

/* Resolves a variable alias in Figma by recursively looking up its actual value */
export async function resolveAlias(_variableAlias: any, colorFormat: 'rgba' | 'hex' = 'rgba') {
	/* Initialize the resolved value with the input alias */
	let resolvedValue = _variableAlias

	/* Continue resolving until we reach a non-alias value */
	while(isTypeVariableAlias(_variableAlias)) {
		/* Get the ID of the current alias */
		const aliasId = _variableAlias.id;

		/* Fetch the actual variable from Figma using the alias ID */
		_variableAlias = await figma.variables.getVariableByIdAsync(aliasId);

		/* Check if the value of the current variable is not an alias */
		if (!isTypeVariableAlias(_variableAlias.valuesByMode[Object.keys(_variableAlias.valuesByMode)[0]])) {
			/* Format the value of the current variable as a string */
			resolvedValue = getFormattedVariableValue(_variableAlias.valuesByMode[Object.keys(_variableAlias.valuesByMode)[0]], colorFormat)
		}
	}

	/* Return the fully resolved value */
	return resolvedValue
}