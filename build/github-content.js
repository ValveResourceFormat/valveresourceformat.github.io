import { execFile } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { extname, join, parse, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import { parseHTML } from 'linkedom';
import mediaInfoFactory from 'mediainfo.js';
import sharp from 'sharp';
import {
	escapeHtml,
	RELEASE_DIR,
	renderContributor,
	writeChangelogPages,
} from './changelog-pages.js';
import { renderReleaseCard, SCREENSHOT_WIDTH } from './og-image.js';

const REPO_API = 'https://api.github.com/repositories/42366054';
const REPO_URL = 'https://github.com/ValveResourceFormat/ValveResourceFormat';
const RELEASES_PER_PAGE = 100;
const DOWNLOAD_ASSET = 'Source2Viewer.exe';

// Tags become directory names and urls of the release pages.
const SAFE_TAG = /^[\w.-]+$/;

const CLI_SYSTEMS = [
	{
		name: 'Windows',
		assets: {
			x64: 'cli-windows-x64.zip',
			arm64: 'cli-windows-arm64.zip',
		},
	},
	{
		name: 'Linux',
		assets: {
			x64: 'cli-linux-x64.zip',
			arm64: 'cli-linux-arm64.zip',
		},
	},
	{
		name: 'macOS',
		assets: {
			'Apple Silicon': 'cli-macos-arm64.zip',
		},
	},
];

// Downloads live inside the vite root, so pages reference them like any other
// static file: served as is in dev, hashed and emitted in build.
const CACHE_DIR = resolve('src/static/github');
const CACHE_URL = '/static/github/';

// Release notes link their attachments through urls signed for five minutes,
// the attachment uuid is the only stable part.
const EXPIRING_HOST = 'private-user-images.githubusercontent.com';
const ATTACHMENT_URL =
	/^https:\/\/(?:private-user-images\.githubusercontent\.com\/\d+\/\d+-|github\.com\/user-attachments\/assets\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

// Older attachments are linked through the repository, and only that url
// downloads them.
const REPOSITORY_ATTACHMENT_URL =
	/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/assets\/\d+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

const MEDIA_TYPES = new Map([
	['image/png', { extension: 'png', video: false }],
	['image/jpeg', { extension: 'jpg', video: false }],
	['image/webp', { extension: 'webp', video: false }],
	['image/gif', { extension: 'gif', video: false }],
	['video/mp4', { extension: 'mp4', video: true }],
	['video/quicktime', { extension: 'mov', video: true }],
	['video/webm', { extension: 'webm', video: true }],
]);

// Video posters are cached next to their video, named after its uuid. The
// suffix does not start with a dot, so posters never match an attachment lookup.
const POSTER_SUFFIX = '-poster.webp';

// The poster is taken this far into the video, past the intro where views are
// still loading and before the clip ends.
const POSTER_POSITION = 0.3;

const execFileAsync = promisify(execFile);

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

/** Fetches every published release, newest first. */
async function fetchReleases() {
	const releases = [];

	for (let page = 1; ; page++) {
		const batch = await fetchGitHub(
			`releases?per_page=${RELEASES_PER_PAGE}&page=${page}`,
		);

		releases.push(...batch);

		if (batch.length < RELEASES_PER_PAGE) {
			break;
		}
	}

	// Drafts are only listed when the token can push to the repository.
	const published = releases.filter((release) => !release.draft);

	if (published.length === 0) {
		throw new Error('GitHub returned no releases');
	}

	for (const release of published) {
		if (!SAFE_TAG.test(release.tag_name)) {
			throw new Error(`Release tag ${release.tag_name} is not a safe path`);
		}
	}

	return published;
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

/**
 * Whether a cached file is a video, going by its extension.
 * @param {string} name
 */
function isVideo(name) {
	const extension = extname(name).substring(1);

	for (const type of MEDIA_TYPES.values()) {
		if (type.extension === extension) {
			return type.video;
		}
	}

	return false;
}

/** @type {Awaited<ReturnType<typeof mediaInfoFactory>> | undefined} */
let mediainfo;

// An instance analyzes one file at a time, so reads wait for the previous one.
let lastVideoRead = Promise.resolve();

/** @param {string} path */
async function analyzeVideo(path) {
	const source = readFileSync(path);

	mediainfo ??= await mediaInfoFactory({ format: 'object' });

	const result = await mediainfo.analyzeData(source.length, (size, offset) =>
		source.subarray(offset, offset + size),
	);
	const track = result.media?.track.find((t) => t['@type'] === 'Video');

	if (!track) {
		throw new Error(`Video ${path} has no video track`);
	}

	return {
		width: Number(track.Width),
		height: Number(track.Height),
		duration: Number(track.Duration),
	};
}

/**
 * Reads the size and duration in seconds of the first video track of a video
 * file.
 * @param {string} path
 */
function readVideoSize(path) {
	const read = lastVideoRead.then(() => analyzeVideo(path));

	// A failed read must not fail the reads queued behind it.
	lastVideoRead = read.catch(() => {});

	return read;
}

/**
 * Writes a full resolution webp of one frame of a video, unless it exists.
 * Returns the name of the cached file.
 * @param {string} videoName
 * @param {number} duration
 */
async function createPoster(videoName, duration) {
	const name = parse(videoName).name + POSTER_SUFFIX;
	const path = join(CACHE_DIR, name);

	if (existsSync(path)) {
		return name;
	}

	if (!ffmpegPath) {
		throw new Error('ffmpeg-static has no binary for this platform');
	}

	// Written under another name first, so an interrupted run leaves no
	// truncated poster behind.
	const temporaryPath = `${path}.tmp`;
	const args = [
		'-hide_banner',
		'-loglevel',
		'error',
		'-y',
		'-ss',
		String(duration * POSTER_POSITION),
		'-i',
		join(CACHE_DIR, videoName),
		'-frames:v',
		'1',
		'-c:v',
		'libwebp',
		'-quality',
		'90',
		'-f',
		'webp',
		temporaryPath,
	];

	try {
		await execFileAsync(ffmpegPath, args);
	} catch (error) {
		throw new Error(`ffmpeg failed to create a poster for ${videoName}`, {
			cause: error,
		});
	}

	renameSync(temporaryPath, path);

	return name;
}

/** @param {string} path */
async function readImageSize(path) {
	const metadata = await sharp(path).metadata();

	return {
		width: metadata.width,
		height: metadata.pageHeight ?? metadata.height,
	};
}

/**
 * Whether an image is an icon within a sentence: the author gave it a pixel
 * width and it shares its block with text.
 * @param {Element} image
 * @param {Element} element The image or the link around it.
 */
function isInlineIcon(image, element) {
	const authorWidth = Number(image.getAttribute('width'));
	const block = element.parentElement;

	if (!authorWidth || !block || block.localName === 'body') {
		return false;
	}

	return block.textContent.trim() !== '';
}

/**
 * Downloads a release attachment once and keeps it in the cache directory.
 * Returns the name of the cached file.
 * @param {string} uuid
 * @param {string} url
 * @param {string[]} cachedFiles
 */
async function loadAttachment(uuid, url, cachedFiles) {
	const cached = cachedFiles.find((file) => file.startsWith(`${uuid}.`));

	if (cached) {
		return cached;
	}

	const { contentType, source } = await download(url);
	const mediaType = MEDIA_TYPES.get(contentType);

	if (!mediaType) {
		throw new Error(
			`Attachment ${uuid} has unsupported content type ${contentType}`,
		);
	}

	const compressed = await compressImage(source, mediaType.extension);
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

/**
 * The uuid of an attachment linked from the release notes, and the url it
 * downloads from. Returns undefined for any other url.
 * @param {string | null} url
 */
function parseAttachmentUrl(url) {
	if (!url) {
		return undefined;
	}

	const repositoryMatch = url.match(REPOSITORY_ATTACHMENT_URL);

	if (repositoryMatch) {
		return { uuid: repositoryMatch[1], downloadUrl: url };
	}

	const match = url.match(ATTACHMENT_URL);

	if (match) {
		const uuid = match[1];

		return {
			uuid,
			downloadUrl: `https://github.com/user-attachments/assets/${uuid}`,
		};
	}

	return undefined;
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

/**
 * Cached files of an attachment, by name in the cache directory. Videos also
 * have a poster.
 * @typedef {{file: string, width: number, height: number, posterFile?: string}} Attachment
 */

/**
 * Points attachments at the downloaded files, sizes them from those files,
 * and puts every image and video that stands on its own in a wrapper, in
 * place of the link or collapsible block GitHub puts around it.
 * @param {HTMLElement} body
 * @param {Map<string, Attachment>} attachments
 */
function rewriteReleaseBody(body, attachments) {
	for (const media of body.querySelectorAll('img, video')) {
		const uuid = parseAttachmentUrl(media.getAttribute('src'))?.uuid;
		const attachment = attachments.get(uuid);

		if (attachment) {
			media.setAttribute('src', CACHE_URL + attachment.file);
			media.removeAttribute('data-canonical-src');
		}

		media.setAttribute('loading', 'lazy');

		let replaced = media;

		if (media.localName === 'img') {
			// Images written as html in the notes have no text to describe them.
			if (!media.hasAttribute('alt')) {
				media.setAttribute('alt', '');
			}

			// GitHub links images to themselves, vite would not rewrite that link.
			const parent = media.parentElement;
			const parentUuid = parseAttachmentUrl(parent.getAttribute('href'))?.uuid;

			if (parent.localName === 'a' && uuid && parentUuid === uuid) {
				replaced = parent;
			}

			// Icons keep flowing with the text at the size the author gave,
			// without the self link.
			if (isInlineIcon(media, replaced)) {
				if (replaced !== media) {
					replaced.replaceWith(media);
				}

				continue;
			}
		} else {
			media.setAttribute('preload', 'none');
			media.setAttribute('muted', '');
			media.setAttribute('loop', '');
			media.setAttribute('playsinline', '');
			replaced = media.closest('details') ?? media;

			if (attachment) {
				media.setAttribute('poster', CACHE_URL + attachment.posterFile);
			}
		}

		// The wrapper scales media to its width, the file gives the aspect ratio.
		if (attachment) {
			media.setAttribute('width', String(attachment.width));
			media.setAttribute('height', String(attachment.height));
		}

		// A span keeps paragraphs valid, the stylesheet displays it as a block.
		const wrapper = body.ownerDocument.createElement('span');
		wrapper.className = 'changelog-media-wrapper';
		replaced.replaceWith(wrapper);
		wrapper.append(media);
	}

	promoteHeadings(body);
	assertNoExpiringUrls(body);

	return body.innerHTML;
}

/**
 * Moves the headings of the notes up or down so the top level is h2, under
 * the page's h1.
 * @param {HTMLElement} body
 */
function promoteHeadings(body) {
	const headings = body.querySelectorAll('h1, h2, h3, h4, h5, h6');

	if (headings.length === 0) {
		return;
	}

	let topLevel = 6;

	for (const heading of headings) {
		topLevel = Math.min(topLevel, Number(heading.localName[1]));
	}

	const shift = topLevel - 2;

	if (shift === 0) {
		return;
	}

	for (const heading of headings) {
		const level = Math.min(6, Number(heading.localName[1]) - shift);
		const replacement = body.ownerDocument.createElement(`h${level}`);

		for (const attribute of heading.attributes) {
			replacement.setAttribute(attribute.name, attribute.value);
		}

		replacement.append(...heading.childNodes);
		heading.replaceWith(replacement);
	}
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

/**
 * @param {any} release
 * @param {string} name
 */
function findAsset(release, name) {
	const asset = release.assets.find((candidate) => candidate.name === name);

	if (!asset) {
		throw new Error(`Release ${release.tag_name} has no ${name}`);
	}

	return asset;
}

/** @param {any} release */
function renderCliDownloads(release) {
	let html = '';

	for (const system of CLI_SYSTEMS) {
		html += `<div class="cli-system"><span>${system.name}</span>`;

		for (const [label, assetName] of Object.entries(system.assets)) {
			const asset = findAsset(release, assetName);

			html += `<a href="${escapeHtml(asset.browser_download_url)}" download>${label}</a>`;
		}

		html += '</div>';
	}

	return html;
}

/**
 * @param {any[]} contributors
 * @param {Map<string, string>} avatars
 */
function renderContributors(contributors, avatars) {
	let html = '';

	for (const contributor of contributors) {
		const login = contributor.login;
		const commitsUrl = `${REPO_URL}/commits?author=${login}`;
		const avatar = avatars.get(login.toLowerCase());

		html += renderContributor(login, commitsUrl, avatar);
	}

	return html;
}

/**
 * The paragraph of release notes that thanks people, made of "Thanks to" and
 * their mentions.
 * @param {HTMLElement} body
 */
function findThanksParagraph(body) {
	for (const paragraph of body.querySelectorAll('p')) {
		if (/^\s*Thanks to\b/.test(paragraph.textContent)) {
			return paragraph;
		}
	}

	return undefined;
}

/**
 * Logins of the users mentioned in an element, in order and without repeats.
 * @param {HTMLElement} element
 */
function mentionedLogins(element) {
	const logins = new Set();

	for (const mention of element.querySelectorAll(
		'a.user-mention[data-hovercard-type="user"]',
	)) {
		const url = new URL(mention.getAttribute('href'));

		logins.add(url.pathname.substring(1));
	}

	return [...logins];
}

/**
 * The text of the first paragraph of release notes that has any, skipping
 * paragraphs that only hold an image.
 * @param {HTMLElement} body
 */
function firstParagraph(body) {
	for (const paragraph of body.querySelectorAll('p')) {
		const text = paragraph.textContent.replace(/\s+/g, ' ').trim();

		if (text) {
			return text;
		}
	}

	return '';
}

/**
 * The file of the first image wide enough for the social card, or else the
 * poster of the first video. Returns undefined when the notes have neither.
 * @param {string[]} uuids
 * @param {Map<string, Attachment>} attachments
 */
function findCardImage(uuids, attachments) {
	let poster;

	for (const uuid of uuids) {
		const attachment = attachments.get(uuid);

		if (attachment.posterFile) {
			if (!poster) {
				poster = join(CACHE_DIR, attachment.posterFile);
			}
		} else if (attachment.width >= SCREENSHOT_WIDTH) {
			return join(CACHE_DIR, attachment.file);
		}
	}

	return poster;
}

/**
 * Everything the build knows about one release.
 * @typedef {object} ReleaseRecord
 * @property {any} release
 * @property {HTMLElement} body The notes with the thanks paragraph removed.
 * @property {string[]} uuids Attachments the notes show, in order.
 * @property {string[]} thanks Logins from the "Thanks to" paragraph.
 * @property {string} description The intro paragraph of the notes.
 * @property {string} cardUrl Url of the social card, set once it is rendered.
 */

/**
 * Fetches releases and contributors from GitHub, downloads attachments and
 * avatars into the cache directory, writes a page for every release, and
 * returns the values of the %S2V_*% placeholders.
 */
export async function loadGitHubContent() {
	const [releases, allContributors] = await Promise.all([
		fetchReleases(),
		fetchGitHub('contributors?per_page=100'),
	]);
	const contributors = allContributors.filter((c) => c.type !== 'Bot');

	const latestRelease = releases[0];
	const downloadAsset = findAsset(latestRelease, DOWNLOAD_ASSET);

	// Avatar urls by lowercase login, since logins are case-insensitive and the
	// cached file names must not differ only in case.
	/** @type {Map<string, string>} */
	const avatarUrls = new Map();
	for (const contributor of contributors) {
		avatarUrls.set(
			contributor.login.toLowerCase(),
			`${contributor.avatar_url}&s=64`,
		);
	}

	/** @type {ReleaseRecord[]} */
	const records = [];
	/** @type {Map<string, string>} */
	const downloadUrls = new Map();
	for (const release of releases) {
		const body = parseFragment(release.body_html ?? '');
		const bodyUuids = [];
		const thanksParagraph = findThanksParagraph(body);
		let thanks = [];

		// The page shows the thanked people as a grid instead of the paragraph.
		if (thanksParagraph) {
			thanks = mentionedLogins(thanksParagraph);
			thanksParagraph.remove();
		}

		for (const login of thanks) {
			const key = login.toLowerCase();

			if (!avatarUrls.has(key)) {
				avatarUrls.set(key, `https://github.com/${login}.png?size=64`);
			}
		}

		for (const media of body.querySelectorAll('img, video')) {
			const attachment = parseAttachmentUrl(media.getAttribute('src'));

			if (attachment) {
				bodyUuids.push(attachment.uuid);
				downloadUrls.set(attachment.uuid, attachment.downloadUrl);
			}
		}

		const description = firstParagraph(body);

		if (!description) {
			throw new Error(
				`Release ${release.tag_name} has no intro paragraph for its description`,
			);
		}

		records.push({
			release,
			body,
			uuids: bodyUuids,
			thanks,
			description,
			cardUrl: '',
		});
	}

	/** @type {Map<string, Attachment>} */
	const attachments = new Map();
	/** @type {Map<string, string>} */
	const avatars = new Map();
	const usedFiles = new Set();

	mkdirSync(CACHE_DIR, { recursive: true });
	const cachedFiles = readdirSync(CACHE_DIR);

	const uuids = [...downloadUrls.keys()];
	const attachmentsLoaded = forEachWithLimit(uuids, 4, async (uuid) => {
		const file = await loadAttachment(
			uuid,
			downloadUrls.get(uuid),
			cachedFiles,
		);
		const path = join(CACHE_DIR, file);

		if (isVideo(file)) {
			const { width, height, duration } = await readVideoSize(path);
			const posterFile = await createPoster(file, duration);

			attachments.set(uuid, { file, width, height, posterFile });
			usedFiles.add(posterFile);
		} else {
			const size = await readImageSize(path);

			attachments.set(uuid, { file, ...size });
		}

		usedFiles.add(file);
	});

	// Avatars change without their url changing, so they are fetched every time.
	const avatarsLoaded = forEachWithLimit(
		[...avatarUrls],
		8,
		async ([login, url]) => {
			const { source } = await download(url);
			// Default avatars ignore the size parameter.
			const webp = await sharp(source)
				.resize(64, 64)
				.webp({ quality: 90 })
				.toBuffer();
			const name = `avatar-${login}.webp`;

			writeCacheFile(name, webp);
			avatars.set(login, CACHE_URL + name);
			usedFiles.add(name);
		},
	);

	await Promise.all([attachmentsLoaded, avatarsLoaded]);

	await forEachWithLimit(records, 4, async (record) => {
		const imagePath = findCardImage(record.uuids, attachments);
		const card = await renderReleaseCard({
			title: `v${record.release.tag_name}`,
			publishedAt: record.release.published_at,
			summary: record.description,
			imagePath,
		});
		const name = `og-${record.release.tag_name}.png`;

		writeCacheFile(name, card);
		usedFiles.add(name);
		record.cardUrl = CACHE_URL + name;
	});

	// Drop files of releases and contributors no longer shown, so the cache
	// does not keep growing.
	for (const file of cachedFiles) {
		if (!usedFiles.has(file)) {
			rmSync(join(CACHE_DIR, file));
		}
	}

	const pages = [];
	for (const record of records) {
		const html = rewriteReleaseBody(record.body, attachments);
		const thanks = [];

		for (const login of record.thanks) {
			thanks.push({ login, avatar: avatars.get(login.toLowerCase()) });
		}

		pages.push({
			release: record.release,
			body: html,
			description: record.description,
			cardUrl: record.cardUrl,
			thanks,
		});
	}

	writeChangelogPages(pages);

	// Keys are the placeholder names without the S2V_ prefix.
	return {
		VERSION: escapeHtml(latestRelease.tag_name),
		RELEASE_DATE: latestRelease.published_at.substring(0, 10),
		DOWNLOAD_URL: escapeHtml(downloadAsset.browser_download_url),
		CLI_DOWNLOADS: renderCliDownloads(latestRelease),
		CONTRIBUTORS: renderContributors(contributors, avatars),
	};
}

/** @param {string} filename */
function isGeneratedPage(filename) {
	const path = resolve(filename);

	return path.startsWith(RELEASE_DIR + sep);
}

/**
 * Fills %S2V_*% placeholders in html pages with the latest release and the
 * contributor list from GitHub. Generated release pages are left alone, so
 * release notes are never scanned for placeholders.
 * @param {Awaited<ReturnType<typeof loadGitHubContent>>} values
 */
export function githubContent(values) {
	return {
		name: 'github-content',
		transformIndexHtml: {
			order: 'pre',
			handler(html, ctx) {
				if (isGeneratedPage(ctx.filename)) {
					return html;
				}

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
