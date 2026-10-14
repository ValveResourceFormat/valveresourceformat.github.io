import {
	mkdirSync,
	readdirSync,
	renameSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { parseHTML } from 'linkedom';
import sharp from 'sharp';

const REPO_API = 'https://api.github.com/repositories/42366054';
const REPO_URL = 'https://github.com/ValveResourceFormat/ValveResourceFormat';
const RELEASES_SHOWN = 5;
const DOWNLOAD_ASSET = 'Source2Viewer.exe';

// Downloads live inside the vite root, so pages reference them like any other
// static file: served as is in dev, hashed and emitted in build.
const CACHE_DIR = resolve('src/static/github');
const CACHE_URL = 'static/github/';

// Release notes link their attachments through urls signed for five minutes,
// the attachment uuid is the only stable part.
const EXPIRING_HOST = 'private-user-images.githubusercontent.com';
const ATTACHMENT_URL =
	/^https:\/\/(?:private-user-images\.githubusercontent\.com\/\d+\/\d+-|github\.com\/user-attachments\/assets\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

const MEDIA_EXTENSIONS = new Map([
	['image/png', 'png'],
	['image/jpeg', 'jpg'],
	['image/webp', 'webp'],
	['image/gif', 'gif'],
	['video/mp4', 'mp4'],
	['video/quicktime', 'mov'],
]);

const dateFormatter = new Intl.DateTimeFormat('en', {
	dateStyle: 'medium',
	timeZone: 'UTC',
});

/** @param {string} text */
function escapeHtml(text) {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

/** @param {string} path */
async function fetchGitHub(path) {
	const headers = {
		Accept: 'application/vnd.github.html+json',
		'X-GitHub-Api-Version': '2022-11-28',
	};

	if (process.env.GITHUB_TOKEN) {
		headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
	}

	const response = await fetch(`${REPO_API}/${path}`, { headers });

	if (!response.ok) {
		throw new Error(
			`GitHub API request ${path} failed: ${response.status} ${response.statusText}`,
		);
	}

	return response.json();
}

/** @param {string} url */
async function download(url) {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(
			`Download of ${url} failed: ${response.status} ${response.statusText}`,
		);
	}

	const contentType = response.headers.get('content-type')?.split(';')[0];
	const source = Buffer.from(await response.arrayBuffer());

	return { contentType, source };
}

/**
 * Re-encodes png and jpeg as webp, unless that comes out larger.
 * @param {Buffer} source
 * @param {string} extension
 */
async function compressImage(source, extension) {
	if (extension !== 'png' && extension !== 'jpg') {
		return { source, extension };
	}

	const webp = await sharp(source).webp({ quality: 90 }).toBuffer();

	if (webp.length >= source.length) {
		return { source, extension };
	}

	return { source: webp, extension: 'webp' };
}

/**
 * @param {string} name
 * @param {Buffer} source
 */
function writeCacheFile(name, source) {
	const path = join(CACHE_DIR, name);

	writeFileSync(`${path}.tmp`, source);
	renameSync(`${path}.tmp`, path);
}

/** @param {string} name */
function isVideo(name) {
	return name.endsWith('.mp4') || name.endsWith('.mov');
}

/**
 * Downloads a release attachment once and keeps it in the cache directory.
 * Returns the name of the cached file.
 * @param {string} uuid
 * @param {string[]} cachedFiles
 */
async function loadAttachment(uuid, cachedFiles) {
	const cached = cachedFiles.find((file) => file.startsWith(`${uuid}.`));

	if (cached) {
		return cached;
	}

	const { contentType, source } = await download(
		`https://github.com/user-attachments/assets/${uuid}`,
	);
	const extension = MEDIA_EXTENSIONS.get(contentType);

	if (!extension) {
		throw new Error(
			`Attachment ${uuid} has unsupported content type ${contentType}`,
		);
	}

	const compressed = await compressImage(source, extension);
	const name = `${uuid}.${compressed.extension}`;

	writeCacheFile(name, compressed.source);

	return name;
}

/**
 * Runs the callback over the items with at most `limit` of them in flight.
 * @template T
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<void>} callback
 */
async function forEachWithLimit(items, limit, callback) {
	let next = 0;

	async function worker() {
		while (next < items.length) {
			const item = items[next];
			next++;
			await callback(item);
		}
	}

	const workers = [];
	for (let i = 0; i < limit; i++) {
		workers.push(worker());
	}

	await Promise.all(workers);
}

/** @param {string | null} url */
function attachmentUuid(url) {
	return url?.match(ATTACHMENT_URL)?.[1];
}

/**
 * Parses an html fragment into the body of a new document.
 * @param {string} html
 */
function parseFragment(html) {
	const { document } = parseHTML('<!doctype html><html><body></body></html>');
	document.body.innerHTML = html;

	return document.body;
}

/** @typedef {{url: string, width?: number, height?: number}} Attachment */

/**
 * Points attachments at the downloaded files and puts every image and video
 * in a wrapper, in place of the link or collapsible block GitHub puts around it.
 * @param {HTMLElement} body
 * @param {Map<string, Attachment>} attachments
 */
function rewriteReleaseBody(body, attachments) {
	for (const media of body.querySelectorAll('img, video')) {
		const uuid = attachmentUuid(media.getAttribute('src'));
		const attachment = attachments.get(uuid);

		if (attachment) {
			media.setAttribute('src', attachment.url);
			media.removeAttribute('data-canonical-src');
		}

		let replaced = media;

		if (media.localName === 'img') {
			media.setAttribute('loading', 'lazy');

			if (attachment?.width && !media.hasAttribute('width')) {
				media.setAttribute('width', String(attachment.width));
				media.setAttribute('height', String(attachment.height));
			}

			// GitHub links images to themselves, vite would not rewrite that link.
			const parent = media.parentElement;
			const parentUuid = attachmentUuid(parent.getAttribute('href'));

			if (parent.localName === 'a' && uuid && parentUuid === uuid) {
				replaced = parent;
			}
		} else {
			media.setAttribute('preload', 'metadata');
			replaced = media.closest('details') ?? media;
		}

		// A span keeps paragraphs valid, the stylesheet displays it as a block.
		const wrapper = body.ownerDocument.createElement('span');
		wrapper.className = 'changelog-media-wrapper';
		replaced.replaceWith(wrapper);
		wrapper.append(media);
	}

	assertNoExpiringUrls(body);

	return body.innerHTML;
}

/**
 * Throws if any link or media source still uses the signed attachment urls,
 * which stop working a few minutes after they were fetched.
 * @param {HTMLElement} body
 */
function assertNoExpiringUrls(body) {
	for (const element of body.querySelectorAll('[src], [href], [srcset]')) {
		const urls = [];

		for (const attribute of ['src', 'href']) {
			const value = element.getAttribute(attribute);

			if (value) {
				urls.push(value);
			}
		}

		const srcset = element.getAttribute('srcset');

		if (srcset) {
			for (const candidate of srcset.split(',')) {
				urls.push(candidate.trim().split(/\s+/)[0]);
			}
		}

		for (const url of urls) {
			if (URL.canParse(url) && new URL(url).hostname === EXPIRING_HOST) {
				throw new Error(`Release notes still link to an expiring url: ${url}`);
			}
		}
	}
}

/** @param {any} release */
function renderAssets(release) {
	let html = '<div class="release-assets">';

	for (const asset of release.assets) {
		let name = asset.name;

		if (name.endsWith('.zip')) {
			name = name.substring(0, name.length - 4).replace(/-/g, ' ');
		}

		html += `<a href="${escapeHtml(asset.browser_download_url)}" class="asset-link" download>${escapeHtml(name)}</a>`;
	}

	html += `<a href="${escapeHtml(release.html_url)}" class="asset-link" target="_blank" rel="noopener">View release on GitHub</a>`;
	html += '</div>';

	return html;
}

/**
 * @param {any} release
 * @param {string} body
 * @param {boolean} isLatest
 */
function renderRelease(release, body, isLatest) {
	const version = escapeHtml(`v${release.tag_name}`);
	const date = dateFormatter.format(new Date(release.published_at));

	let html = '<div class="release-notes-content">';
	html += '<div class="release-notes-sidebar">';
	html += `<a class="release-version" href="${escapeHtml(release.html_url)}" target="_blank" rel="noopener">${version}</a>`;
	html += `<time class="release-date" datetime="${escapeHtml(release.published_at)}">${date}</time>`;
	html += '</div>';
	html += '<div class="release-notes-main">';
	html += `<div class="release-content">${body}</div>`;

	if (isLatest) {
		html += renderAssets(release);
	}

	html += '</div>';
	html += '</div>';

	return html;
}

/**
 * @param {any[]} contributors
 * @param {Map<string, string>} avatars
 */
function renderContributors(contributors, avatars) {
	let html = '';

	for (const contributor of contributors) {
		const login = escapeHtml(contributor.login);
		const commitsUrl = `${REPO_URL}/commits?author=${login}`;
		const avatar = escapeHtml(avatars.get(contributor.login));

		html += `<a href="${commitsUrl}" target="_blank" rel="noopener" class="contributor">`;
		html += `<img src="${avatar}" alt="" width="32" height="32" loading="lazy">`;
		html += `<span class="contributor-name">${login}</span>`;
		html += '</a>';
	}

	return html;
}

/**
 * Fetches releases and contributors from GitHub and renders them to html,
 * with attachments and avatars downloaded into the cache directory.
 */
async function loadContent() {
	const [releases, allContributors] = await Promise.all([
		fetchGitHub(`releases?per_page=${RELEASES_SHOWN}`),
		fetchGitHub('contributors?per_page=100'),
	]);
	const contributors = allContributors.filter((c) => c.type !== 'Bot');

	const latestRelease = releases[0];
	const downloadAsset = latestRelease.assets.find(
		(asset) => asset.name === DOWNLOAD_ASSET,
	);

	if (!downloadAsset) {
		throw new Error(
			`Release ${latestRelease.tag_name} has no ${DOWNLOAD_ASSET}`,
		);
	}

	const bodies = new Map();
	const uuids = new Set();
	for (const release of releases) {
		const body = parseFragment(release.body_html ?? '');

		for (const media of body.querySelectorAll('img, video')) {
			const uuid = attachmentUuid(media.getAttribute('src'));

			if (uuid) {
				uuids.add(uuid);
			}
		}

		bodies.set(release, body);
	}

	/** @type {Map<string, Attachment>} */
	const attachments = new Map();
	/** @type {Map<string, string>} */
	const avatars = new Map();
	const usedFiles = new Set();

	mkdirSync(CACHE_DIR, { recursive: true });
	const cachedFiles = readdirSync(CACHE_DIR);

	const attachmentsLoaded = forEachWithLimit([...uuids], 4, async (uuid) => {
		const name = await loadAttachment(uuid, cachedFiles);
		const attachment = { url: CACHE_URL + name };

		if (!isVideo(name)) {
			const metadata = await sharp(join(CACHE_DIR, name)).metadata();
			attachment.width = metadata.width;
			attachment.height = metadata.pageHeight ?? metadata.height;
		}

		attachments.set(uuid, attachment);
		usedFiles.add(name);
	});

	// Avatars change without their url changing, so they are fetched every time.
	const avatarsLoaded = forEachWithLimit(
		contributors,
		8,
		async (contributor) => {
			const { source } = await download(`${contributor.avatar_url}&s=64`);
			// Default avatars ignore the size parameter.
			const webp = await sharp(source)
				.resize(64, 64)
				.webp({ quality: 90 })
				.toBuffer();
			const name = `avatar-${contributor.login}.webp`;

			writeCacheFile(name, webp);
			avatars.set(contributor.login, CACHE_URL + name);
			usedFiles.add(name);
		},
	);

	await Promise.all([attachmentsLoaded, avatarsLoaded]);

	// Drop files of releases and contributors no longer shown, so the cache
	// does not keep growing.
	for (const file of cachedFiles) {
		if (!usedFiles.has(file)) {
			rmSync(join(CACHE_DIR, file));
		}
	}

	let changelog = '';
	for (const release of releases) {
		const body = rewriteReleaseBody(bodies.get(release), attachments);
		changelog += renderRelease(release, body, release === latestRelease);
	}

	const oldestShown = releases[releases.length - 1].tag_name;
	changelog += `<a class="changelog-older" href="${REPO_URL}/releases?after=${encodeURIComponent(oldestShown)}" target="_blank" rel="noopener">Older releases on GitHub</a>`;

	// Keys are the placeholder names without the S2V_ prefix.
	return {
		VERSION: escapeHtml(latestRelease.tag_name),
		DOWNLOAD_URL: escapeHtml(downloadAsset.browser_download_url),
		CHANGELOG: changelog,
		CONTRIBUTORS: renderContributors(contributors, avatars),
	};
}

// Fills %S2V_*% placeholders in html pages with the latest release, the
// changelog and the contributor list from GitHub.
export function githubContent() {
	/** @type {ReturnType<typeof loadContent> | undefined} */
	let content;

	return {
		name: 'github-content',
		transformIndexHtml: {
			order: 'pre',
			async handler(html, ctx) {
				content ??= loadContent();

				const values = await content;

				// One pass, so inserted content is never scanned for placeholders.
				return html.replace(/%S2V_(\w+)%/g, (placeholder, key) => {
					if (!Object.hasOwn(values, key)) {
						throw new Error(
							`Unknown placeholder ${placeholder} in ${ctx.filename}`,
						);
					}

					return values[key];
				});
			},
		},
	};
}
