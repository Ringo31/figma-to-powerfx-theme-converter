// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).
// This shows the HTML page in "ui.html".
figma.showUI(__html__, {width: 600, height: 400});


/********************* ANCIENNE VERSION *********************** */
async function buildThemeTree(_variables: Variable[], _modes: Array<{modeId: string, name: string}>): Promise<Record<string, any>> {
  
  // On initialise un objet vide tree qui sera la racine de notre arborescence
  const tree: Record<string, any> = {};
  const modes = _modes
  //console.log(modes)
  _variables.forEach(variable => {
    // Pour chaque variable, on décompose son nom en segments en utilisant '/' comme séparateur.
    // Chaque segment représente un niveau dans la hiérarchie.
    // (par exemple, Color.Surface.Background se divise en ['Color', 'Surface', 'Background']).
    const paths = variable.name.split('/');
    // currentLevel permet de suivre la position actuelle dans l'arborescence
    let currentLevel = tree;
    let lastPart = ''

    paths.forEach(async (part, index) => {
      // On itère sur chaque segment (part) du nom de la variable.
      if(!currentLevel[part]) {
        // Si le segment (part) n'existe pas déjà dans le niveau actuel de l'arborescence (currentLevel), on l'ajoute comme un nouvel objet vide.
        //currentLevel[part] = (index === paths.length - 1) ? await getVariableValue(variable.valuesByMode[Object.keys(variable.valuesByMode)[0]]) : {};
        //if (index === paths.length - 1) {
        /*  if ((index === paths.length - 1)
            && ((variable.resolvedType !== 'COLOR') || (_modes.length === 1))) {
            currentLevel[part] = getVariableValue(variable.valuesByMode[modes[0].modeId])
          } else {
            // Sinon on initialise à {} pour accueillir le niveau suivant
            currentLevel[part] = {}
          }*/
        //}
        console.log(part, (index === paths.length - 1))
        if (index === paths.length - 1) {
          if (modes.length > 1) {
            currentLevel[part] = {}
            if (variable.resolvedType === 'COLOR') {
              // Boucle sur les modes
              console.log('avant boucle')
              
              Object.keys(variable.valuesByMode).forEach(async (_modeId, _value) => {
                const modeName = modes.find(({modeId}) => modeId === _modeId)?.name
                console.log('dans boucle : ', modeName)
                if(modeName) {
                  currentLevel[modeName] = await getVariableValue(variable.valuesByMode[_modeId])
                }
              })
            } else {
              currentLevel[part] = await getVariableValue(variable.valuesByMode[Object.keys(variable.valuesByMode)[0]])
              //currentLevel[part] = await getVariableValue(variable.valuesByMode[_modes[0].modeId])
            }
          } else {
            currentLevel[part] = await getVariableValue(variable.valuesByMode[Object.keys(variable.valuesByMode)[0]])
          }
        } else {
          currentLevel[part] = {}
        }
      }

      currentLevel = currentLevel[part];
      // On met à jour currentLevel pour pointer vers le nouveau niveau créé ou existant
    })

    /*
    // Si on a plusieurs modes et que la variable est une couleur, il faut itérer sur les modes
    if ((_modes.length > 1) && (variable.resolvedType === 'COLOR')) {
      Object.keys(variable.valuesByMode).forEach(async (_modeId, _value) => {
        const modeName = modes.find(({modeId}) => modeId === _modeId)?.name
  
        if(modeName) {
          currentLevel[modeName] = await getVariableValue(variable.valuesByMode[_modeId])
        }
      })
    }
      */
  })

  return tree;
}
/********************* ANCIENNE VERSION *********************** */


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

async function generateVariableTree(_collectionId: string) {
  
  const collection = await figma.variables.getVariableCollectionByIdAsync(_collectionId);
  const jsonTree = {};

  let variableData: any = {};

  if (collection) {
    for (const variableId of collection?.variableIds) {
      //console.log(variableId)
      const variable = await figma.variables.getVariableByIdAsync(variableId);
      
      //let variableData;

      if (variable?.resolvedType === 'COLOR' && collection.modes.length > 1) {
        variableData = {};
        for (const mode of collection.modes) {
          const modeValue = variable?.valuesByMode[mode.modeId];

          if (isTypeVariableAlias(modeValue)) {
            variableData[mode.name] = await resolveAlias(modeValue)
          } else if (isTypeRGBA(modeValue)){
            variableData[mode.name] = getVariableValue(modeValue);
          }
        }
      } else {
        if (isTypeVariableAlias(variable?.valuesByMode[Object.keys(variable.valuesByMode)[0]])) {
          variableData = await resolveAlias(variable?.valuesByMode[Object.keys(variable.valuesByMode)[0]])
        } else {
          variableData = variable?.valuesByMode[Object.keys(variable.valuesByMode)[0]];
        }
      }

      const path = variable?.name.split('/');
      let currentLevel: any = jsonTree;

      // Créer la structure hiérarchique
      path?.forEach((key, index) => {
        if (!currentLevel[key]) {
            currentLevel[key] = (index === path.length - 1) ? variableData : {};
        }
        currentLevel = currentLevel[key];
      });
    }
  }

  return jsonTree
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

    const themeTree = await generateVariableTree(msg.collectionId);
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

