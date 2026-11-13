/**
 * Shows contributors in a random order, so nobody is always first.
 * @param {HTMLElement} container
 */
export function ShuffleContributors(container) {
	const contributors = [...container.children];

	for (let i = contributors.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[contributors[i], contributors[j]] = [contributors[j], contributors[i]];
	}

	container.append(...contributors);
}
