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

/** @type {HTMLDialogElement|null} */
let mediaModal = null;

/** @type {HTMLImageElement|HTMLVideoElement|null} */
let modalMedia = null;

/** @type {HTMLElement|null} */
let modalMediaWrapper = null;

function CreateMediaModal() {
	const modal = document.createElement('dialog');
	modal.className = 'changelog-modal';

	const closeBtn = document.createElement('button');
	closeBtn.className = 'changelog-modal-close';
	closeBtn.ariaLabel = 'Close';
	closeBtn.textContent = '×';
	closeBtn.onclick = CloseMediaModal;
	modal.appendChild(closeBtn);

	modal.addEventListener('click', (e) => {
		if (e.target === modal) CloseMediaModal();
	});

	// Escape closes through the view transition as well.
	modal.addEventListener('cancel', (e) => {
		e.preventDefault();
		CloseMediaModal();
	});

	// Browsers may close the dialog without a cancelable cancel event.
	modal.addEventListener('close', () => {
		const media = ReturnModalMedia();

		if (media) {
			media.style.viewTransitionName = '';
		}
	});

	document.body.appendChild(modal);

	return modal;
}

/**
 * Moves the media itself into the modal, so a video keeps playing from the
 * same frame.
 * @param {HTMLImageElement|HTMLVideoElement} media
 */
function OpenMediaModal(media) {
	mediaModal ??= CreateMediaModal();
	modalMedia = media;
	modalMediaWrapper = media.parentElement;

	// Hold the wrapper height so the article does not reflow without the media.
	modalMediaWrapper.style.height = `${modalMediaWrapper.getBoundingClientRect().height}px`;
	media.style.viewTransitionName = 'changelog-media';

	RunViewTransition(() => {
		if (media.localName === 'video') {
			media.controls = true;
			media.play().catch(() => {});
		}

		mediaModal.appendChild(media);
		mediaModal.showModal();
	});
}

function CloseMediaModal() {
	const media = modalMedia;

	if (!media) {
		return;
	}

	const finished = RunViewTransition(() => {
		ReturnModalMedia();
		mediaModal.close();
	});

	finished.then(() => {
		media.style.viewTransitionName = '';
	});
}

/**
 * Runs a DOM update in a view transition, or directly where the browser has
 * none. Returns a promise that settles when the animation ends.
 * @param {() => void} update
 */
function RunViewTransition(update) {
	if (!document.startViewTransition) {
		update();
		return Promise.resolve();
	}

	return document.startViewTransition(update).finished;
}

/**
 * Puts the media in the modal back into its wrapper in the article.
 * Returns the media, or null when the modal holds none.
 */
function ReturnModalMedia() {
	const media = modalMedia;

	if (!media) {
		return null;
	}

	modalMedia = null;

	if (media.localName === 'video') {
		media.controls = false;
		// Sound turned on in the modal stays off in the article.
		media.muted = true;
	}

	modalMediaWrapper.appendChild(media);
	modalMediaWrapper.style.height = '';

	return media;
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

const timelineMenu = document.querySelector('.release-timeline-menu');
timelineMenu.addEventListener('toggle', (e) => {
	if (e.newState === 'open') {
		ScrollTimelineToCurrent();
	}
});

// The menu is only a popover below the sidebar breakpoint.
matchMedia('(min-width: 900px)').addEventListener('change', () =>
	timelineMenu.hidePopover(),
);

InitSkybox(document.querySelector('.skybox'));
