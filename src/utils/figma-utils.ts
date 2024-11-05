import { getFormattedVariableValue, isTypeVariableAlias } from "./variable-utils";

export async function getVariableCollectionArray() {
  const variableCollectionArray = (await figma.variables.getLocalVariableCollectionsAsync()).map(collection => ({
    id: collection.id,
    name: collection.name,
    modes: collection.modes
  }));
  return variableCollectionArray;
}

/**
 * Resolves a variable alias in Figma by recursively looking up its actual value.
 * 
 * @param _variableAlias The variable alias to resolve.
 * @returns The resolved value in a formatted string.
 */
export async function resolveAlias(_variableAlias: any) {
    // Initialize the resolved value with the input alias
    let resolvedValue = _variableAlias
  
    // Continue resolving until we reach a non-alias value
    while(isTypeVariableAlias(_variableAlias)) {
      // Get the ID of the current alias
      const aliasId = _variableAlias.id;
  
      // Fetch the actual variable from Figma using the alias ID
      _variableAlias = await figma.variables.getVariableByIdAsync(aliasId);
  
      // Check if the value of the current variable is not an alias
      if (!isTypeVariableAlias(_variableAlias.valuesByMode[Object.keys(_variableAlias.valuesByMode)[0]])) {
        // Format the value of the current variable as a string
        resolvedValue = getFormattedVariableValue(_variableAlias.valuesByMode[Object.keys(_variableAlias.valuesByMode)[0]])
      }
    }
  
    // Return the fully resolved value
    return resolvedValue
  
  }