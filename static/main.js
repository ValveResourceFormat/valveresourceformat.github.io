fetch('https://api.github.com/repositories/42366054/releases?per_page=5', {
	headers: {
		Accept: 'application/vnd.github.html+json',
	},
})
	.then((response) => {
		if (!response.ok) {
			throw new Error('Failed to fetch github releases');
		}

		return response.json();
	})
	.then((releases) => {
		if (!releases || releases.length === 0) {
			return;
		}

		const latestRelease = releases[0];

		try {
			const currentVersion = latestRelease.tag_name;
			const storedVersion = localStorage.getItem('s2v-last-version');

			if (storedVersion && storedVersion !== currentVersion) {
				const banner = document.getElementById('js-update-banner');
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

		for (const asset of latestRelease.assets) {
			if (asset.name === 'Source2Viewer.exe') {
				document.getElementById('js-download').href =
					asset.browser_download_url;

				const version = document.querySelector('.download-text');
				version.textContent = `Download v${latestRelease.tag_name}`;
				break;
			}
		}

		const releaseNotesContainer = document.getElementById('changelog');
		const downloadFormatter = new Intl.NumberFormat('en', {
			notation: 'compact',
			maximumFractionDigits: 1,
		});

		releases.forEach((release, index) => {
			const isLatest = index === 0;

			const releaseSection = document.createElement('div');
			releaseSection.className = 'release-notes-content';

			const releaseSidebar = document.createElement('div');
			releaseSidebar.className = 'release-notes-sidebar';

			const releaseHeader = document.createElement('a');
			releaseHeader.className = 'release-version';
			releaseHeader.href = release.html_url;
			releaseHeader.target = '_blank';
			releaseHeader.rel = 'noopener';
			releaseHeader.textContent = `v${release.tag_name}`;
			releaseSidebar.appendChild(releaseHeader);

			const releaseDateSpan = document.createElement('span');
			releaseDateSpan.className = 'release-date';
			const releaseDate = new Date(release.published_at);
			releaseDateSpan.textContent = releaseDate.toLocaleDateString();
			releaseSidebar.appendChild(releaseDateSpan);

			const totalDownloads = release.assets.reduce(
				(sum, asset) => sum + asset.download_count,
				0,
			);

			if (totalDownloads > 0) {
				const downloadsSpan = document.createElement('span');
				downloadsSpan.className = 'release-downloads';
				downloadsSpan.textContent = `${downloadFormatter.format(totalDownloads)} downloads`;
				releaseSidebar.appendChild(downloadsSpan);
			}

			releaseSection.appendChild(releaseSidebar);

			const releaseMain = document.createElement('div');
			releaseMain.className = 'release-notes-main';

			const releaseContent = document.createElement('div');
			releaseContent.className = 'release-content';
			releaseContent.innerHTML = release.body_html;
			AdjustChangelog(releaseContent);
			releaseMain.appendChild(releaseContent);

			if (isLatest) {
				const releaseAssetsContainer = document.createElement('div');
				releaseAssetsContainer.className = 'release-assets';
				releaseAssetsContainer.id = 'js-release-assets';

				for (const asset of release.assets) {
					let name = asset.name;

					if (name.endsWith('.zip')) {
						name = name.substring(0, name.length - 4).replace(/-/g, ' ');
					}

					const assetLink = document.createElement('a');
					assetLink.href = asset.browser_download_url;
					assetLink.className = 'asset-link';
					assetLink.download = '';
					assetLink.textContent = name;
					releaseAssetsContainer.appendChild(assetLink);
				}

				const githubLink = document.createElement('a');
				githubLink.href = release.html_url;
				githubLink.className = 'asset-link';
				githubLink.target = '_blank';
				githubLink.rel = 'noopener';
				githubLink.textContent = 'View release on GitHub';
				releaseAssetsContainer.appendChild(githubLink);

				releaseMain.appendChild(releaseAssetsContainer);
			}

			releaseSection.appendChild(releaseMain);

			releaseNotesContainer.appendChild(releaseSection);
		});
	});

function AdjustChangelog(changelogContainer) {
	const wrapMedia = (element, unwrapParent) => {
		if (unwrapParent) {
			const wrapper = document.createElement('div');
			wrapper.className = 'changelog-media-wrapper';
			unwrapParent.parentNode.insertBefore(wrapper, unwrapParent);
			wrapper.appendChild(element);
			unwrapParent.remove();
		} else if (!element.closest('.changelog-media-wrapper')) {
			const wrapper = document.createElement('div');
			wrapper.className = 'changelog-media-wrapper';
			element.parentNode.insertBefore(wrapper, element);
			wrapper.appendChild(element);
		}
	};

	for (const img of changelogContainer.querySelectorAll('img')) {
		const parentLink = img.closest('a');
		wrapMedia(img, parentLink?.href === img.src ? parentLink : null);

		img.addEventListener('click', (e) => {
			e.preventDefault();
			OpenMediaModal(img.src, 'image');
		});
	}

	for (const video of changelogContainer.querySelectorAll('video')) {
		wrapMedia(video, video.closest('details'));

		video.addEventListener('click', (e) => {
			e.preventDefault();
			OpenMediaModal(video.src || video.querySelector('source')?.src, 'video');
		});
	}
}

function OpenMediaModal(src, type) {
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

function LoadWorkshop() {
	fetch('https://steamdb.info/api/Source2ViewerWorkshop/')
		.then((response) => {
			if (!response.ok) {
				throw new Error('Failed to fetch workshop items');
			}

			return response.json();
		})
		.then((response) => {
			if (!response.success || !response.data) {
				throw new Error('Failed to fetch workshop items');
			}

			const dateFormatter = new Intl.DateTimeFormat(undefined, {
				dateStyle: 'medium',
			});

			const dom = document.querySelectorAll('.workshop-item');

			for (let i = 0; i < response.data.length && i < dom.length; i++) {
				const file = response.data[i];
				const element = dom[i];
				const date = new Date(file.time_created * 1000);

				const params = new URLSearchParams();
				params.set('id', file.id);
				params.set('utm_source', 'Source 2 Viewer');
				params.set('searchtext', 'valveresourceformat');

				element.href = `https://steamcommunity.com/sharedfiles/filedetails/?${params}`;
				const image = element.querySelector('.workshop-image');
				image.src = file.preview_url;
				image.alt = file.title;
				element.querySelector('.workshop-title').textContent = file.title;
				element.querySelector('.workshop-info').textContent =
					`${dateFormatter.format(date)} — ${file.subscriptions.toLocaleString()} subscribers`;
			}
		});
}

if ('IntersectionObserver' in window) {
	const observer = new window.IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					observer.disconnect();
					LoadWorkshop();
				}
			});
		},
		{
			rootMargin: '200px 0px 0px 0px',
		},
	);
	observer.observe(document.querySelector('.workshop'));
} else {
	LoadWorkshop();
}
