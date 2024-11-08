import { toOneWord, isTypeVariableAlias, getFormattedVariableValue } from "./variable-utils";
import { resolveAlias } from "./figma-utils";

/* Get the first-level variables of a collection */
export async function getCollectionTokens(collectionId: string): Promise<string[]> {
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    const tokens: string[] = [];

    if (collection) {
        /* For each variable in the collection, get the first-level key and add it to the list of tokens */
        for (const variableId of collection?.variableIds) {
            const variable = await figma.variables.getVariableByIdAsync(variableId);

            const path = variable?.name.split('/');
            const token = path?.shift()!; /* The token is the first element of the path */

            if (!tokens.includes(token)) {
                tokens.push(token);
            }
        }
    }

    return tokens;
};

/* Generate a json tree of variables from a collection according to the token parameters */
export async function generateVariableTree(collectionId: string, tokenParams: {tokenName: string, groupByModes: boolean, switchName: string}[]): Promise<{ [x: string]: unknown; }[]> {

    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    const trees: { [x:string]: unknown; }[] = [];

    let variableData: any = {};

    if (collection) {

        /* For each variable in the collection */
        for (const variableId of collection?.variableIds) {

            /* -------------------------------------- */
            /* Step 1 : Get the token of the variable */
            /* -------------------------------------- */

            /* Get the variable */
            const variable = await figma.variables.getVariableByIdAsync(variableId);

            /* Get the parent token of the variable*/
            const variableToken = variable?.name.split('/')[0]!;

            /* Find the token parameter associated */
            const tokenParam = tokenParams.find((param) => param.tokenName === variableToken);

            /* Create a new tree for this token if it doesn't exist */
            if (!trees.find((tree) => Object.keys(tree)[0] === variableToken)) {
                trees.push({ [variableToken]: {} });
            }

            /* ------------------------------ */
            /* Step 2 : Get the variable data */
            /* ------------------------------ */

            /* Get the variable data */
            /* If the collection has more than 1 mode and the token parameter is set to true, get the variable data for each mode */
            if (collection.modes.length > 1 && tokenParams.find((param) => param.tokenName === variableToken)?.groupByModes) {
                variableData = {};
                for (const mode of collection.modes) {
                const modeValue = variable?.valuesByMode[mode.modeId]!;

                if (isTypeVariableAlias(modeValue)) {
                    variableData[mode.name] = await resolveAlias(modeValue)
                } else {
                    variableData[mode.name] = getFormattedVariableValue(modeValue);
                }

                }
            } 
            /* Otherwise, get the variable data for the first mode */
            else {
                const modeValue = variable?.valuesByMode[Object.keys(variable.valuesByMode)[0]]!;
                if (isTypeVariableAlias(modeValue)) {
                variableData = await resolveAlias(modeValue)
                } else {
                variableData = getFormattedVariableValue(modeValue);
                }
            }


            /* -------------------------------- */
            /* Step 3 : Build the variable tree */
            /* -------------------------------- */

            /* Get the path of the variable */
            const path = variable?.name.split('/').slice(1);

            /* Get the current level of the tree */
            let currentLevel: any = trees.find((tree) => Object.keys(tree)[0] === variableToken)![variableToken];

            /* If the collection has more than 1 mode and the token parameter is set to true, build the variable tree for each mode */
            if (collection.modes.length > 1 && tokenParams.find((param) => param.tokenName === variableToken)?.groupByModes) {
                
                /* For each mode, build the variable tree */
                collection.modes.forEach((mode) => {
                    if (!currentLevel[mode.name]) {
                        currentLevel[mode.name] = {};
                    }

                    let modeLevel = currentLevel[mode.name];
                    
                    /* For each key in the path, create a new level if it doesn't exist */
                    path?.forEach((key, index) => {
                        if (!modeLevel[key]) {
                            modeLevel[key] = index === path.length - 1 ? variableData[mode.name] : {};
                        }
                        modeLevel = modeLevel[key];
                    });
                })
            } 
            /* Otherwise, build the variable tree for the first mode only */
            else {
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
};

/* Converts a JSON object to a Power Fx representation of this object */
function customJSONStringify(json: any, level: number = 1, groupByModes: boolean = false, switchName: string = '') {
  
    let output = '';
    const indent = ' '.repeat(level * 4);
    const lastIndent = ' '.repeat((level - 1) * 4);
    const entries = Object.entries(json);
  
    /* Check if the JSON object is a leaf node */
    const isLeaf = typeof json != 'object' || json instanceof Array || json === null || entries.length === 0
  
    /* If the JSON object is a leaf node, return it as a string */
    if (isLeaf) {
        return /\d/.test(json) ? `${json}` : `"${json}"`
    }
  
    /* Otherwise, recursively stringify the JSON object */
  
    /* If level is 1 and groupByModes is true, add the switch statement and recursively stringify the JSON object */
    if(level === 1 && groupByModes) {
        /* For each entry, recursively stringify the JSON object */
        entries.forEach(([key, value] : [string, any], index : number) => {
            const keyRepresentation = `"${toOneWord(key)}"`
            const valueRepresentation = customJSONStringify(value, level + 1);
            /* If the entry is the last entry, add a comma to the end of the string */
            const isLastEntry = index === entries.length - 1
    
            output += `${indent}${keyRepresentation},\n${indent}${valueRepresentation}${isLastEntry ? '' : ','}\n`
        });
  
      return `${switchName},\n${output}${lastIndent}`
  
    } 
    /* Otherwise, recursively stringify the JSON object */
    else {
        /* For each entry, recursively stringify the JSON object */
        entries.forEach(([key, value] : [string, any], index : number) => {
            const keyRepresentation = toOneWord(key)
            const valueRepresentation = customJSONStringify(value, level + 1);
            /* If the entry is the last entry, add a comma to the end of the string */
            const isLastEntry = index === entries.length - 1
    
            output += `${indent}${keyRepresentation}: ${valueRepresentation}${isLastEntry ? '' : ','}\n`
        });
  
      return `{\n${output}${lastIndent}}`
    }
}

/* Concatenates a list of JSON objects into a Power Fx variable tree */
export function displayFormattedJSON(jsonArray: { [x: string]: unknown; }[], tokenParams: {tokenName: string, groupByModes: boolean, switchName: string }[]) {
    let output = '';

    jsonArray.forEach((json, index) => {
        output+=`Set( tk${Object.keys(json)[0]}, ${tokenParams[index].groupByModes ? `Switch(${
        customJSONStringify(Object.values(json)[0], 1, true, tokenParams[index].switchName)
        })` :
        `${
        customJSONStringify(Object.values(json)[0], 1, false)
        }`});\n\n`
    })

    return output
}
