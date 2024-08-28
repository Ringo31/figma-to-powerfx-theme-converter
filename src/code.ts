import { resolveAlias } from "./utils/figma-utils";
import { isTypeVariableAlias, getFormattedVariableValue, toOneWord } from "./utils/variable-utils";

// This shows the HTML page in "ui.html".
figma.showUI(__html__, {width: 650, height: 500});

function customJSONStringify(json: any, level: number = 0) {
  console.log(`Entering customJSONStringify with json: ${JSON.stringify(json)} and level: ${level}`);
  //return JSON.stringify(_json, null, 4)
  let output = '';
  const indent = ' '.repeat(level * 4);
  const entries = Object.entries(json);

  const isLeaf = typeof json != 'object' || json instanceof Array || json === null || entries.length === 0

  if (isLeaf) {
    console.log(`Returning from customJSONStringify with leaf value: ${json}`);
    return /\d/.test(json) ? `${json}` : `"${json}"`
  }

  console.log(`Entering customJSONStringify with value: ${JSON.stringify(entries)} and level: ${level + 1}`);
  entries.forEach(([key, value] : [string, any], index : number) => {
    const keyRepresentation = toOneWord(key)

    console.log(`Entering customJSONStringify with value: ${JSON.stringify(value)} and level: ${level + 1}`);
    const valueRepresentation = customJSONStringify(value, level + 1);

    console.log(`Returning from customJSONStringify with valueRepresentation: ${valueRepresentation}`);

    const isLastEntry = index === entries.length - 1

    output += `${indent}${keyRepresentation}: ${valueRepresentation}${isLastEntry ? '' : ','}\n`
  });

  console.log(`Returning from customJSONStringify with final output: ${output}`);

  return `{\n${output}}`
}


function displayFormattedJSON(_jsonArray: { [x: string]: unknown; }[], _tokenParams: {tokenName: string, groupByModes: boolean }[]) {
  let output = '';

  _jsonArray.forEach((json, index) => {
    output+=`Set( tk${Object.keys(json)[0]}, ${_tokenParams[index].groupByModes ? `Switch(${
      // Display json from the second level without quotes
      //JSON.stringify(Object.values(json)[0], null, 4).replace(/"([^"]*)":/g, '$1:').replace(/"/g, '')
      customJSONStringify(Object.values(json)[0], 0)
    })` :
    `${
      //JSON.stringify(Object.values(json)[0], null, 4).replace(/"([^"]*)":/g, '$1:').replace(/"/g, '')
      customJSONStringify(Object.values(json)[0], 0)
    }`}\n});\n\n`
  })

 /*  _jsonArray.forEach((json, index) => {
    output+=`Set( tk${Object.keys(json)[0]}, 
      ${customJSONStringify(_jsonArray, _tokenParams)}
    );\n\n`
  }) */

  return output
}

async function generateVariableTree2(_collectionId: string, tokenParams: {tokenName: string, groupByModes: boolean }[]): Promise<{ [x: string]: unknown; }[]> {
  
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



async function generateFirstLevelVariableTree(_collectionId: string): Promise<string[]> {
  const collection = await figma.variables.getVariableCollectionByIdAsync(_collectionId);
  const firstLevelVariables: string[] = [];

  if (collection) {
    for (const variableId of collection?.variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(variableId);

      const path = variable?.name.split('/');
      const firstLevel = path?.shift()!; // Supprime le premier élément et le stocke

      if (!firstLevelVariables.includes(firstLevel)) {
        firstLevelVariables.push(firstLevel);
      }
    }
  }

  return firstLevelVariables;
}



figma.ui.onmessage = async (msg) => {
  if (msg.type === 'requestCollection') {
    const collectionId = msg.collectionId;

    const tokensList = await generateFirstLevelVariableTree(collectionId);
    const tokenParams = tokensList.map(token => ({ tokenName: token, groupByModes: false }));
    figma.ui.postMessage({ type : 'sendTokensList', tokensList: tokensList });
  }

  if (msg.type === 'requestDisplay') {
    console.log(msg.tokenParams)
    const collectionId = msg.collectionId;
    const tokenParams = msg.tokenParams;

    const displayTree = await generateVariableTree2(collectionId, tokenParams);
    console.log(displayTree)
    figma.ui.postMessage({ type: 'sendDisplay', displayTree: displayFormattedJSON(displayTree, tokenParams) });
  }

  /* if (msg.type === 'convert-variables') {

    const collectionId = msg.collectionId;
    const tokenParams = msg.tokenParams;

    const groupByModes = msg.groupBy === 'mode';

    //const themeTree = await generateVariableTree(msg.collectionId, groupByModes, msg.varName);
    const jsonArray = await generateVariableTree(collectionId, groupByModes);
    console.log(jsonArray)

    //const themeTree = displayFormattedJSON(jsonArray, groupByModes, msg.varName);

    //figma.ui.postMessage({ type: 'theme-tree', tree: themeTree });
    
  } */

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  //figma.closePlugin();
};


/**
 * Envoie la liste des collections de variables locales de Figma vers l'interface utilisateur.
 * 
 * @returns {Promise<void>}
 */
const sendCollectionsList = async () => {
  try {
    // Récupère la liste des collections de variables locales de Figma
    const variableCollections = await figma.variables.getLocalVariableCollectionsAsync();

    // Crée un tableau de objets qui contiennent les informations de chaque collection
    const collectionsList = variableCollections.map(collection => ({
      id: collection.id,
      name: collection.name,
      modes: collection.modes,
      modesLenght: collection.modes.length
    }));

    // Envoie le tableau de collections vers l'interface utilisateur
    figma.ui.postMessage({
      type: 'sendCollectionsList',
      collections: collectionsList,
    });
  } catch (error) {
    // Affiche un message d'erreur si une erreur est survenue
    console.error('Erreur lors de la récupération des collections:', error);
    figma.ui.postMessage({
      type: 'sendCollectionsList',
      collections: [],
    });
  }
};

// Appel de la fonction pour envoyer la liste des collections dès l'ouverture de l'UI
sendCollectionsList();

