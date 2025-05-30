import { toOneWord, isTypeVariableAlias, getFormattedVariableValue } from "./variable-utils";
import { resolveAlias } from "./figma-utils";


/* Returns an array of all first-level keys in the given variable collection */
export async function getCollectionTokens(collectionId: string): Promise<string[]> {
    // Get the collection object from Figma
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);

    // Initialize an empty array to store the first-level keys
    const firstLevelVariables: string[] = [];

    if (collection) {
        // Iterate over all the variable IDs in the collection
        for (const variableId of collection?.variableIds) {
            // Get the variable object from Figma
            const variable = await figma.variables.getVariableByIdAsync(variableId);

            // Get the path of the variable
            const path = variable?.name.split('/');

            // Get the first-level key
            const firstLevel = path?.shift()!;

            // Check if the first-level key is not already in the array
            if (!firstLevelVariables.includes(firstLevel)) {
                // Add the first-level key to the array
                firstLevelVariables.push(firstLevel);
            }
        }
    }

    // Return the array of first-level keys
    return firstLevelVariables;
}

function customJSONStringify(json: any, level: number = 1): string {
    let output = '';
    const indent = ' '.repeat(level * 4);
    const lastIndent = ' '.repeat((level - 1) * 4);
    const entries = Object.entries(json);
  
    const isLeaf = typeof json != 'object' || json instanceof Array || json === null || entries.length === 0
  
    if (isLeaf) {
        // Si c'est une valeur de couleur (commence par # ou RGBA), ne pas ajouter de guillemets
        if (typeof json === 'string' && (json.startsWith('ColorValue("#') || json.startsWith('RGBA'))) {
            return json;
        }
        // Pour les nombres, pas de guillemets
        if (typeof json === 'number' || /^\d+$/.test(json)) {
            return json;
        }
        // Pour tout le reste, ajouter des guillemets
        return `"${json}"`;
    }
  
    entries.forEach(([key, value] : [string, any], index : number) => {
        const keyRepresentation = toOneWord(key)
        const valueRepresentation = customJSONStringify(value, level + 1);
        const isLastEntry = index === entries.length - 1
        output += `${indent}${keyRepresentation}: ${valueRepresentation}${isLastEntry ? '' : ','}\n`
    });
  
    return `{\n${output}${lastIndent}}`
}

/* Concatenates a list of JSON objects into a Power Fx variable tree */
export function displayFormattedJSON(jsonArray: { [x: string]: unknown; }[], tokenParams: {tokenName: string, selected: boolean, customName: string }[]) {
    let output = '';

    jsonArray.forEach((json) => {
        const tokenName = Object.keys(json)[0];
        const customName = tokenParams.find(param => param.tokenName === tokenName)?.customName || tokenName;
        output += `Set( ${toOneWord(customName)}, ${customJSONStringify(Object.values(json)[0], 1)});\n\n`;
    });

    return output;
}

/* Generate a json tree of variables from a collection according to the token parameters */
export async function generateVariableTree(collectionId: string, tokenParams: {tokenName: string, selected: boolean, customName: string}[], colorFormat: 'rgba' | 'hex' = 'rgba'): Promise<{ [x: string]: unknown; }[]> {
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    const trees: { [x:string]: unknown; }[] = [];

    if (collection) {
        /* For each variable in the collection */
        for (const variableId of collection?.variableIds) {
            /* Get the variable */
            const variable = await figma.variables.getVariableByIdAsync(variableId);

            /* Get the parent token of the variable*/
            const variableToken = variable?.name.split('/')[0]!;

            /* Check if this token is selected for export */
            if (!tokenParams.find(param => param.tokenName === variableToken)) {
                continue;
            }

            /* Create a new tree for this token if it doesn't exist */
            if (!trees.find((tree) => Object.keys(tree)[0] === variableToken)) {
                trees.push({ [variableToken]: {} });
            }

            /* Get the variable value from the first mode */
            const modeValue = variable?.valuesByMode[Object.keys(variable.valuesByMode)[0]]!;
            const variableData = isTypeVariableAlias(modeValue) ? 
                await resolveAlias(modeValue, colorFormat) : 
                getFormattedVariableValue(modeValue, colorFormat);

            /* Get the path of the variable */
            const path = variable?.name.split('/').slice(1);

            /* Get the current level of the tree */
            let currentLevel: any = trees.find((tree) => Object.keys(tree)[0] === variableToken)![variableToken];

            /* Build the variable tree */
            path?.forEach((key, index) => {
                if (!currentLevel[key]) {
                    currentLevel[key] = (index === path.length - 1) ? variableData : {};
                }
                currentLevel = currentLevel[key];
            });
        }
    }

    return trees;
}


