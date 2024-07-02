// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

/*
type Mode = {
  name: string,
  modeId: string
};
*/
/*
var modes: Array<{
  name: string,
  modeId: string
}>
*/




// This shows the HTML page in "ui.html".
figma.showUI(__html__, {width: 600, height: 400});


function buildThemeTree(variables: Variable[], _modes: Array<{modeId: string, name: string}>): Record<string, any> {
  
  // On initialise un objet vide tree qui sera la racine de notre arborescence
  const tree: Record<string, any> = {};
  const modes = _modes
  //console.log(modes)
  variables.forEach(variable => {
    // Pour chaque variable, on décompose son nom en segments en utilisant '/' comme séparateur.
    // Chaque segment représente un niveau dans la hiérarchie.
    // (par exemple, Color.Surface.Background se divise en ['Color', 'Surface', 'Background']).
    const paths = variable.name.split('/');
    // currentLevel permet de suivre la position actuelle dans l'arborescence
    let currentLevel = tree;

    paths.forEach((part, index) => {
      // On itère sur chaque segment (part) du nom de la variable.
      if(!currentLevel[part]) {
        // Si le segment (part) n'existe pas déjà dans le niveau actuel de l'arborescence (currentLevel), on l'ajoute comme un nouvel objet vide.
        //currentLevel[part] = (index === paths.length - 1) ? {} : {};
        if (index === paths.length - 1) {
          if (_modes.length === 1) {
            // Si on est au dernier segment et qu'il n'y a qu'un seule mode, on écrit directement la valeur
            currentLevel[part] = getVariableValue(variable.valuesByMode[modes[0].modeId])
          } else {
            // Sinon on initialise à {} pour accueillir le niveau suivant
            currentLevel[part] = {}
          }
        }
      }

      currentLevel = currentLevel[part];
      // On met à jour currentLevel pour pointer vers le nouveau niveau créé ou existant
    })

    // Si on a plusieurs modes, il faut itérer dessus
    if (_modes.length > 1) {
      Object.keys(variable.valuesByMode).forEach(async (_modeId, _value) => {
        const modeName = modes.find(({modeId}) => modeId === _modeId)?.name
  
        if(modeName) {
          currentLevel[modeName] = getVariableValue(variable.valuesByMode[_modeId])
        }
      })
    }
  })

  return tree;
}

function getVariableValue(_variableValueByMode: VariableValue): string {
  console.log(_variableValueByMode, typeof _variableValueByMode)
  //if(typeof _variableValueByMode === 'number' || typeof _variableValueByMode === 'string') {
  if( isTypeVariableAlias(_variableValueByMode)) {
    //const variableAlias = await figma.variables.getVariableByIdAsync(_variableValueByMode.id);
    return '' //getVariableValue(variableAlias?.valuesByMode)
  } else if (isTypeRGBA(_variableValueByMode)) {
    return `RGBA(${Math.round(_variableValueByMode.r*255)}, ${Math.round(_variableValueByMode.g*255)}, ${Math.round(_variableValueByMode.b*255)}, ${_variableValueByMode.a})`
  }
  else {
    return _variableValueByMode.toString()
  }
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
  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
  if (msg.type = 'convert-theme') {
    //const collection = await figma.variables.getVariableCollectionByIdAsync(msg.collectionId);
    const variablePromise = await figma.variables.getLocalVariablesAsync();
    //const collectionPromise = await figma.variables.getVariableCollectionByIdAsync(msg.collectionId)
    const collectionPromise = await getCollectionById(msg.collectionId);
    //console.log(collectionPromise)
    
    const modesPromise = collectionPromise.modes

    //Object.freeze(modes)
    if (collectionPromise) {
      const themeTree = buildThemeTree(variablePromise.filter(variable => variable.variableCollectionId === msg.collectionId), modesPromise)

      figma.ui.postMessage({ type: 'theme-tree', tree: themeTree });
    }
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

