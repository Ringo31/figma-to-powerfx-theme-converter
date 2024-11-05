import { getVariableCollectionArray } from "./utils/figma-utils";
import { generateFirstLevelVariableTree, generateVariableTree, displayFormattedJSON } from "./utils/tree-utils";

// This shows the HTML page in "ui.html".
figma.showUI(__html__, {width: 750, height: 500});


figma.ui.onmessage = async (msg) => {
  
  if (msg.type === 'REQUEST_COLLECTION') {
    const collectionId = msg.collectionId;

    const tokensList = await generateFirstLevelVariableTree(collectionId);
    //const tokenParams = tokensList.map(token => ({ tokenName: token, groupByModes: false, switchName: '' }));
    figma.ui.postMessage({ type : 'SEND_TOKENS_LIST', tokensList: tokensList });
  }

  if (msg.type === 'REQUEST_DISPLAY') {
    console.log(msg.tokenParams)
    const collectionId = msg.collectionId;
    const tokenParams = msg.tokenParams;

    const displayTree = await generateVariableTree(collectionId, tokenParams);
    console.log(displayTree)
    figma.ui.postMessage({ type: 'SEND_DISPLAY', displayTree: displayFormattedJSON(displayTree, tokenParams) });
  }

};

/* At First, send the list of collections to the UI */
(async () => {
  const variableCollectionArray = await getVariableCollectionArray();
  figma.ui.postMessage({ type: 'SEND_COLLECTIONS_ARRAY', variableCollectionArray: variableCollectionArray });
})();

