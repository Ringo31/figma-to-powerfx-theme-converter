/* Checks if the given variable value is of type RGBA */
function isRGBA(variableValue: any): variableValue is RGBA {
	return (
		variableValue !== null &&
		typeof variableValue === "object" &&
		typeof variableValue.r === "number" &&
		typeof variableValue.g === "number" &&
		typeof variableValue.b === "number" &&
		typeof variableValue.a === "number"
	);
}

/* Returns a string with all spaces, underscores and dashes removed */
export function toOneWord(inputString: string): string {
	const words = inputString.split(/[\s_\-]+/);
	return words.join('');
}


/* Checks if the given variable value is of type VariableAlias */
export function isTypeVariableAlias(_variableValue: any): _variableValue is VariableAlias {
    return _variableValue != null 
		&& typeof _variableValue === 'object'
		&& typeof _variableValue.type === 'string'
		&& typeof _variableValue.id === 'string'
};
  

/* Returns a string representation of the variable value in a format suitable for consumption by Power Apps.
	- If the variable value is an RGBA color, it will be formatted as an RGBA string.
	- Otherwise, it will be converted to a string using the default toString() method . */
export function getFormattedVariableValue(rawValue: VariableValue): string {
    if (isRGBA(rawValue)) {
      const { r, g, b, a } = rawValue;
      const formattedRgb = `RGBA(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
      return formattedRgb;
    }
  
    // Fall back to the default toString() method for non-rgba values
    return rawValue.toString();
  }