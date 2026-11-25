export function choosePlace(rowNames, moreNames, name) {
	if (rowNames.includes(name)) {
		return 'row';
	}
	if (moreNames.includes(name)) {
		return 'more';
	}
	throw new Error(`Cannot find the "${name}" place in the places row or the More places menu`);
}
