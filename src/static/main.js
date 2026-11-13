import { ShuffleContributors } from './contributors.js';
import { InitSkybox } from './skybox.js';

function CheckForUpdate() {
	const banner = document.getElementById('js-update-banner');
	const currentVersion = banner.dataset.version;

	try {
		const storedVersion = localStorage.getItem('s2v-last-version');

		if (storedVersion && storedVersion !== currentVersion) {
			banner.hidden = false;

			banner.addEventListener('click', () => {
				banner.hidden = true;
				localStorage.setItem('s2v-last-version', currentVersion);
			});
		} else {
			localStorage.setItem('s2v-last-version', currentVersion);
		}
	} catch (e) {
		console.error(e);
	}
}

document.getElementById('js-download').addEventListener('click', () => {
	document.getElementById('js-thank-you')?.classList.add('visible');
});

CheckForUpdate();

const contributorsContainer = document.getElementById('js-contributors');
if (contributorsContainer) {
	ShuffleContributors(contributorsContainer);
}

const skybox = document.querySelector('.skybox');
if (skybox) {
	InitSkybox(skybox);
}
