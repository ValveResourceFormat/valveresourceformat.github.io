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

/** @param {MouseEvent} e */
function OnChangelogClick(e) {
	const media = e.target.closest(
		'.changelog-media-wrapper > img, .changelog-media-wrapper > video',
	);

	if (!media) {
		return;
	}

	e.preventDefault();
	OpenMediaModal(media.src, media.localName === 'video' ? 'video' : 'image');
}

/**
 * @param {string} src
 * @param {"image"|"video"} type
 */
function OpenMediaModal(src, type) {
	/** @type {HTMLDialogElement} */
	let modal = document.getElementById('changelog-media-modal');
	if (!modal) {
		modal = document.createElement('dialog');
		modal.id = 'changelog-media-modal';
		modal.className = 'changelog-modal';

		const closeBtn = document.createElement('button');
		closeBtn.className = 'changelog-modal-close';
		closeBtn.ariaLabel = 'Close';
		closeBtn.textContent = '\u00D7';
		closeBtn.onclick = () => modal.close();
		modal.appendChild(closeBtn);

		modal.addEventListener('click', (e) => {
			if (e.target === modal) modal.close();
		});
		modal.addEventListener('close', () => {
			const video = modal.querySelector('video');
			if (video) video.pause();
		});

		document.body.appendChild(modal);
	}

	const existing = modal.querySelector('img, video');
	if (existing) existing.remove();

	const media = document.createElement(type === 'video' ? 'video' : 'img');
	media.className = 'changelog-modal-media';
	media.src = src;

	if (type === 'video') {
		media.controls = true;
		media.autoplay = true;
		media.loop = true;
	}

	modal.appendChild(media);
	modal.showModal();
}

/** @param {HTMLElement} container */
function ShuffleContributors(container) {
	const contributors = [...container.children];

	for (let i = contributors.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[contributors[i], contributors[j]] = [contributors[j], contributors[i]];
	}

	container.append(...contributors);
}

document.getElementById('js-download').addEventListener('click', () => {
	document.getElementById('js-thank-you')?.classList.add('visible');
});

CheckForUpdate();

document
	.getElementById('changelog')
	?.addEventListener('click', OnChangelogClick);

const contributorsContainer = document.getElementById('js-contributors');
if (contributorsContainer) {
	ShuffleContributors(contributorsContainer);
}
