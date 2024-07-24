// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).
// This shows the HTML page in "ui.html".
figma.showUI(__html__, {width: 600, height: 400});

function toPascalCase(input: string): string {
  return input
    .split(/[\s_\-]+/)  // Sépare les mots par espaces, underscores ou tirets.
    //.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())  // Capitalise la première lettre de chaque mot
    .join('');  // Joint tous les mots sans espace
}

function getVariableValue(rawValue: VariableValue) {
  if(isTypeRGBA(rawValue)) {
    return `RGBA(${Math.round(rawValue.r*255)}, ${Math.round(rawValue.g*255)}, ${Math.round(rawValue.b*255)}, ${rawValue.a})`
  } else {
    return rawValue.toString();
  }
}

async function resolveAlias(_variableAlias: any) {
  let resolvedValue = _variableAlias

  while(isTypeVariableAlias(_variableAlias)) {
    const aliasId = _variableAlias.id;
    _variableAlias = await figma.variables.getVariableByIdAsync(aliasId);

    if (!isTypeVariableAlias(_variableAlias.valuesByMode[Object.keys(_variableAlias.valuesByMode)[0]])) {
      resolvedValue = getVariableValue(_variableAlias.valuesByMode[Object.keys(_variableAlias.valuesByMode)[0]])
    }
  }

  return resolvedValue

}

function customJSONStringify(obj: any, level=0) {
  const indent = ' '.repeat(level * 4); // Indentation d'une tabulation par niveau
  const lastIndent = ' '.repeat((level-1) * 4);
  const entries = Object.entries(obj);
  const isLeaf = typeof obj != 'object' || obj === null || entries.length === 0;

  if (isLeaf) {
    return /\d/.test(obj) ? `${obj}` : `"${obj}"` // Garder les guillemets pour les chaînes
  }
  let result = `{\n`;

  entries.forEach(([key, value], index) => {
  //for (const ([key, value], index) of entries) {
      // Récupérer la représentation de la clé sans guillemets
      const keyRepresentation = `${toPascalCase(key)}`;

      // Générer la chaîne formatée pour chaque sous-arbre ou valeur
      const valueRepresentation = customJSONStringify(value, level + 1);

      // Déterminer si c'est la dernière entrée
      const isLastEntry = index === entries.length - 1;

      // Ajouter la ligne à la représentation du JSON formaté
      result += `${indent}${keyRepresentation}: ${valueRepresentation}${isLastEntry ? '' : ','}\n`;
  })

  result += `${lastIndent}}`;
  return result;
}

function displayFormattedJSON(jsonTree: any) {
  let output = '';

  // Parcourir chaque catégorie au niveau supérieur
  for (const [category, subtree] of Object.entries(jsonTree)) {
      output += `Set( tk${category}, `;
      output += customJSONStringify(subtree, 1);
      output += `);\n\n`;
  }

  return output
}

async function generateVariableTree(_collectionId: string, groupByModes: Boolean) {
  
  const collection = await figma.variables.getVariableCollectionByIdAsync(_collectionId);
  const jsonTree = {};

  let variableData: any = {};

  if (collection) {
    for (const variableId of collection?.variableIds) {
      //console.log(variableId)
      const variable = await figma.variables.getVariableByIdAsync(variableId);

      if (collection.modes.length > 1) {
        variableData = {};
        for (const mode of collection.modes) {
          const modeValue = variable?.valuesByMode[mode.modeId]!;

          if (isTypeVariableAlias(modeValue)) {
            variableData[mode.name] = await resolveAlias(modeValue)
          } else {
            variableData[mode.name] = getVariableValue(modeValue);
          }
        }
      }
      else {
        const modeValue = variable?.valuesByMode[Object.keys(variable.valuesByMode)[0]]!;
        if (isTypeVariableAlias(modeValue)) {
          variableData = await resolveAlias(modeValue)
        } else {
          variableData = getVariableValue(modeValue);
        }
      }

      const path = variable?.name.split('/');
      let currentLevel: any = jsonTree;

      // Créer la structure hiérarchique
      if(collection.modes.length > 1 && groupByModes) {
         // On place les modes au deuxième niveau
        const topCategory = path?.shift()!; // Supprime le premier élément et le stocke

        if (!currentLevel[topCategory]) {
            currentLevel[topCategory] = {};
        }

        currentLevel = currentLevel[topCategory]; // Naviguer au niveau de la catégorie principale

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
  //return JSON.stringify(jsonTree, null, 2);
  return displayFormattedJSON(jsonTree)
}

// Fonctions pour vérifier le type des variables
function isTypeVariableAlias(_variableValue: any): _variableValue is VariableAlias {
  return _variableValue != null 
    && typeof _variableValue === 'object'
    && typeof _variableValue.type === 'string'
    && typeof _variableValue.id === 'string'
};

function isTypeRGBA(_variableValue: any): _variableValue is RGBA {
  return _variableValue != null
    && typeof _variableValue === 'object'
    && typeof _variableValue.r === 'number'
    && typeof _variableValue.g === 'number'
    && typeof _variableValue.b === 'number'
    && typeof _variableValue.a === 'number'
}

figma.ui.onmessage = async (msg) => {
  console.log(msg)
  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
  if (msg.type = 'convert-theme') {
    const groupByModes = msg.groupBy === 'mode';
    const themeTree = await generateVariableTree(msg.collectionId, groupByModes);
    figma.ui.postMessage({ type: 'theme-tree', tree: themeTree });
    
  } 

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  //figma.closePlugin();
};

async function getCollectionById(collectionId: string): Promise<VariableCollection> {
  const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
  return collection!
}


const sendCollectionsList = async () => {
  try {
    const variableCollections = await figma.variables.getLocalVariableCollectionsAsync();
    const collectionsList = variableCollections.map(collection => ({
      id: collection.id,
      name: collection.name,
      modes: collection.modes
    }));

    figma.ui.postMessage({
      type: 'collections-list',
      collections: collectionsList,
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des collections:', error);
    figma.ui.postMessage({
      type: 'collections-list',
      collections: [],
    });
  }
};

// Appel de la fonction pour envoyer la liste des collections dès l'ouverture de l'UI
sendCollectionsList();

