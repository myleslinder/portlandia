/**
 * `chrome` will only have a value if the `externally_connectable` manifest property
 *  contains a match for the url we're running on:
 * [externally_connectable - Chrome Developers]
 * (https://developer.chrome.com/docs/extensions/mv3/manifest/externally_connectable/)
 *
 */
function doesFunctionalityExist() {
	return (
		(typeof chrome as unknown) !== undefined &&
		chrome.runtime &&
		chrome.runtime.connect
	);
}

export { doesFunctionalityExist };
