// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

type Mode = {
  name: string,
  modeId: string
};

/*
type VariableNode = {
  id: string;
  name: string;
  modes: Mode[]
}
  */

// This shows the HTML page in "ui.html".
figma.showUI(__html__, {width: 600, height: 400});

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
function buildThemeTree(variables: Variable[]): Record<string, any> {
  const tree: Record<string, any> = {};

  variables.forEach(variable => {
    const paths = variable.name.split('/');
    let currentLevel = tree;

    paths.forEach((part, index) => {
      if(!currentLevel[part]) {
        currentLevel[part] = (index === paths.length - 1) ? {} : {};
      }
      currentLevel = currentLevel[part];
    })

    //currentLevel['modes'] = variable.modes.map(mode => mode.modeId)
  })

  return tree;
}


figma.ui.onmessage = async (msg) => {
  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
  if (msg.type === 'convert-variables') {
    try {
      const collection = await figma.variables.getVariableCollectionByIdAsync(msg.collectionId);
      const variableIds = collection?.variableIds
      const modes = collection?.modes
      if(modes && variableIds) 

      figma.ui.postMessage({type : 'converted-variables', variables: await convertToPowerFX(variableIds, modes)});
    } catch (error) {
      console.error('Erreur lors de la récupération des variables:', error);
      figma.ui.postMessage({type: 'converted-variables', variables: []})
    }

    /*
    // Lire les variables locales de Figma
    const variables = await figma.variables.getLocalVariablesAsync(); // Simule l'accès aux variables locales de Figma
    const convertedVariables = convertToPowerFX(variables);
    figma.ui.postMessage({ type: 'converted-variables', variables: convertedVariables });*/
  }
  if (msg.type = 'convert-theme') {
    //const collection = await figma.variables.getVariableCollectionByIdAsync(msg.collectionId);
    const variablePromise = await figma.variables.getLocalVariablesAsync();

    const themeTree = buildThemeTree(variablePromise.filter(variable => variable.variableCollectionId === msg.collectionId))

    figma.ui.postMessage({ type: 'theme-tree', tree: themeTree });
  } 

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  //figma.closePlugin();
};

async function convertToPowerFX(variableIds: string[], modes: Mode[]): Promise<string> {
  let powerFXVariables = 'Set(tkTheme,{\n';

  // Pour chaque variableId de la collection, on récupère les valeurs
  const variablePromises = variableIds.map(async variableId => {
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    return variable ? `\t${variable.name} : {}\n` : '';
  })

  const variableNames = await Promise.all(variablePromises);
  powerFXVariables += variableNames.join('') + '\n});'

  return powerFXVariables;
}

function getValuesByMode(variable: Variable | null, modes: Mode[]): string {
  let powerFXVariable = '';
  modes.forEach(mode => {
    powerFXVariable += `${mode.name}: \n`
  });
  return powerFXVariable
}

const sendCollectionsList = async () => {
  try {
    const variableCollections = await figma.variables.getLocalVariableCollectionsAsync();
    const collectionsList = variableCollections.map(collection => ({
      id: collection.id,
      name: collection.name,
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

