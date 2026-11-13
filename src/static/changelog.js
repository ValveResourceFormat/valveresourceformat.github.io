import { ShuffleContributors } from './contributors.js';
import { InitSkybox } from './skybox.js';

const MEDIA_SELECTOR =
	'.changelog-media-wrapper > img, .changelog-media-wrapper > video';

/** @param {MouseEvent} e */
function OnChangelogClick(e) {
	const media = e.target.closest(MEDIA_SELECTOR);

	if (!media) {
		return;
	}

	e.preventDefault();
	OpenMediaModal(media);
}

/** @param {HTMLImageElement|HTMLVideoElement} source */
function OpenMediaModal(source) {
	const isVideo = source.localName === 'video';

	/** @type {HTMLDialogElement} */
	let modal = document.getElementById('changelog-media-modal');
	if (!modal) {
		modal = document.createElement('dialog');
		modal.id = 'changelog-media-modal';
		modal.className = 'changelog-modal';

		const closeBtn = document.createElement('button');
		closeBtn.className = 'changelog-modal-close';
		closeBtn.ariaLabel = 'Close';
		closeBtn.textContent = '×';
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

	const media = document.createElement(isVideo ? 'video' : 'img');
	media.className = 'changelog-modal-media';
	media.src = source.src;

	if (isVideo) {
		media.controls = true;
		media.autoplay = true;
		media.loop = true;
	}

	modal.appendChild(media);
	modal.showModal();
}

function ScrollTimelineToCurrent() {
	const timeline = document.querySelector('.release-timeline');
	const current = timeline.querySelector('.is-current');

	if (timeline.clientHeight) {
		timeline.scrollTop = current.offsetTop - timeline.clientHeight / 2;
	}
}

// Videos play muted only while on screen, so a page with many videos does not
// download them all at once.
function AutoplayVideos() {
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
		return;
	}

	const observer = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (entry.isIntersecting) {
				// Browsers that still block muted autoplay leave the poster showing.
				entry.target.play().catch(() => {});
			} else {
				entry.target.pause();
			}
		}
	});

	for (const video of document.querySelectorAll(
		'.changelog-media-wrapper > video',
	)) {
		observer.observe(video);
	}
}

document
	.getElementById('changelog')
	.addEventListener('click', OnChangelogClick);

AutoplayVideos();

ScrollTimelineToCurrent();

const thanks = document.querySelector('.release-thanks .contributor-list');
if (thanks) {
	ShuffleContributors(thanks);
}

document
	.querySelector('.release-timeline-menu')
	.addEventListener('toggle', ScrollTimelineToCurrent);

InitSkybox(document.querySelector('.skybox'));
