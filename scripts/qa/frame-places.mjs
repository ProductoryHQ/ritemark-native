export function placeName(label) {
	// VS Code's title is "{name} ({key}) - {badge}": drop the badge first, then the shortcut.
	return label.split(', ')[0].split(' - ')[0].replace(/ \(.*\)$/, '');
}

export function choosePlace(rowNames, moreNames, name) {
	if (rowNames.includes(name)) {
		return 'row';
	}
	if (moreNames.includes(name)) {
		return 'more';
	}
	throw new Error(`Cannot find the "${name}" place in the places row or the More places menu`);
}
