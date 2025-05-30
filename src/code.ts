import { getVariableCollectionArray } from "./utils/figma-utils";
import { getCollectionTokens, generateVariableTree, displayFormattedJSON } from "./utils/tree-utils";

/* This shows the HTML page in "ui.html". */
figma.showUI(__html__, {width: 750, height: 500});

/* At First, send the list of collections to the UI */
(async () => {
	const variableCollectionArray = await getVariableCollectionArray();
	figma.ui.postMessage({ type: 'SEND_COLLECTION_ARRAY', variableCollectionArray: variableCollectionArray });
})();

/* Then, listen for messages from the UI */
figma.ui.onmessage = async (msg) => {
  
  /* Handle collection request from the UI : Get the list of tokens for the selected collection and send it to the UI */
	if (msg.type === 'REQUEST_COLLECTION_TOKENS') {

		const collectionId = msg.collectionId;
		const collectionTokens = await getCollectionTokens(collectionId);

		figma.ui.postMessage({ type : 'SEND_COLLECTION_TOKENS', collectionTokens: collectionTokens });
	}

	/* Handle display request from the UI : Generate and display the variable tree for the selected tokens */
	if (msg.type === 'REQUEST_DISPLAY') {
		const collectionId = msg.collectionId;
		const tokenParams = msg.tokenParams;
		const colorFormat = msg.colorFormat as 'rgba' | 'hex';

		const displayTree = await generateVariableTree(collectionId, tokenParams, colorFormat);
		figma.ui.postMessage({ type: 'SEND_DISPLAY', displayTree: displayFormattedJSON(displayTree, tokenParams) });
	}
};

