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

function customJSONStringify(json: any, level: number = 1, groupByModes: boolean = false, switchName: string = '') {
  
    let output = '';
    const indent = ' '.repeat(level * 4);
    const lastIndent = ' '.repeat((level - 1) * 4);
    const entries = Object.entries(json);
  
    const isLeaf = typeof json != 'object' || json instanceof Array || json === null || entries.length === 0
  
    if (isLeaf) {
      return /\d/.test(json) ? `${json}` : `"${json}"`
    }
  
    if(level === 1 && groupByModes) {
      entries.forEach(([key, value] : [string, any], index : number) => {
        const keyRepresentation = `"${toOneWord(key)}"`
  
        const valueRepresentation = customJSONStringify(value, level + 1);
  
        const isLastEntry = index === entries.length - 1
  
        output += `${indent}${keyRepresentation},\n${indent}${valueRepresentation}${isLastEntry ? '' : ','}\n`
      });
  
      return `${switchName},\n${output}${lastIndent}`
  
    } else {
      entries.forEach(([key, value] : [string, any], index : number) => {
        const keyRepresentation = toOneWord(key)
  
        const valueRepresentation = customJSONStringify(value, level + 1);
  
        const isLastEntry = index === entries.length - 1
  
        output += `${indent}${keyRepresentation}: ${valueRepresentation}${isLastEntry ? '' : ','}\n`
      });
  
      return `{\n${output}${lastIndent}}`
    }
    
    
      
}

export function displayFormattedJSON(_jsonArray: { [x: string]: unknown; }[], _tokenParams: {tokenName: string, groupByModes: boolean, switchName: string }[]) {
    let output = '';

    _jsonArray.forEach((json, index) => {
        output+=`Set( tk${Object.keys(json)[0]}, ${_tokenParams[index].groupByModes ? `Switch(${
        // Display json from the second level without quotes
        //JSON.stringify(Object.values(json)[0], null, 4).replace(/"([^"]*)":/g, '$1:').replace(/"/g, '')
        customJSONStringify(Object.values(json)[0], 1, true, _tokenParams[index].switchName)
        })` :
        `${
        //JSON.stringify(Object.values(json)[0], null, 4).replace(/"([^"]*)":/g, '$1:').replace(/"/g, '')
        customJSONStringify(Object.values(json)[0], 1, false)
        }`});\n\n`
    })

    return output
}

export async function generateVariableTree(_collectionId: string, tokenParams: {tokenName: string, groupByModes: boolean, switchName: string}[]): Promise<{ [x: string]: unknown; }[]> {

    const collection = await figma.variables.getVariableCollectionByIdAsync(_collectionId);
    const trees: { [x:string]: unknown; }[] = [];

    let variableData: any = {};

    if (collection) {
        for (const variableId of collection?.variableIds) {
        const variable = await figma.variables.getVariableByIdAsync(variableId);

        // Get the first-level key
        const firstLevelKey = variable?.name.split('/')[0]!;

        // Find the tokenParams for this subtree
        const tokenParam = tokenParams.find((param) => param.tokenName === firstLevelKey);

        // Create a new tree for this first-level key if it doesn't exist
        if (!trees.find((tree) => Object.keys(tree)[0] === firstLevelKey)) {
            trees.push({ [firstLevelKey]: {} });
        }

        // On récupère la ou les valeurs de la variable
        if (collection.modes.length > 1 && tokenParams.find((param) => param.tokenName === firstLevelKey)?.groupByModes) {
            // On place les modes au deuxième niveau
            variableData = {};
            for (const mode of collection.modes) {
            const modeValue = variable?.valuesByMode[mode.modeId]!;

            if (isTypeVariableAlias(modeValue)) {
                variableData[mode.name] = await resolveAlias(modeValue)
            } else {
                variableData[mode.name] = getFormattedVariableValue(modeValue);
            }

            }
        } else {
            const modeValue = variable?.valuesByMode[Object.keys(variable.valuesByMode)[0]]!;
            if (isTypeVariableAlias(modeValue)) {
            variableData = await resolveAlias(modeValue)
            } else {
            variableData = getFormattedVariableValue(modeValue);
            }
        }

        // On construit la hiérarchie de l'arbre

        // Get the path
        const path = variable?.name.split('/').slice(1);
        // Get the current level
        let currentLevel: any = trees.find((tree) => Object.keys(tree)[0] === firstLevelKey)![firstLevelKey];

        // Créer la structure hiérarchique
        if(collection.modes.length > 1 && tokenParam?.groupByModes) {
            
            collection.modes.forEach((mode) => {
            if (!currentLevel[mode.name]) {
                currentLevel[mode.name] = {};
            }

            let modeLevel = currentLevel[mode.name];
            // Pour chaque segment du chemin, créez des niveaux hiérarchiques
            path?.forEach((key, index) => {
                if (!modeLevel[key]) {
                modeLevel[key] = index === path.length - 1 ? variableData[mode.name] : {};
                }
                modeLevel = modeLevel[key];
            });
            })
        } else {
            path?.forEach((key, index) => {
            if (!currentLevel[key]) {
                currentLevel[key] = (index === path.length - 1) ? variableData : {};
            }
            currentLevel = currentLevel[key];
            });
        }
        }
    }

    return trees;
}

