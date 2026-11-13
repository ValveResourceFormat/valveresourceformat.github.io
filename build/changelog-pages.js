import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CARD_HEIGHT, CARD_WIDTH, longDateFormatter } from './og-image.js';

export const SITE_URL = 'https://s2v.app/';

// Generated pages live inside the vite root so they build like the other pages.
export const RELEASE_DIR = resolve('src/release');

const TEMPLATE_PATH = resolve('build/release-template.html');
const TEMPLATE = readFileSync(TEMPLATE_PATH, 'utf8');

// /release/ has no page of its own and sends visitors to the latest release.
const REDIRECT_TEMPLATE = readFileSync(
	resolve('build/release-redirect.html'),
	'utf8',
);

const dateFormatter = new Intl.DateTimeFormat('en', {
	dateStyle: 'medium',
	timeZone: 'UTC',
});

const shortDateFormatter = new Intl.DateTimeFormat('en', {
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC',
});

/** @param {string} text */
export function escapeHtml(text) {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

/**
 * @typedef {object} ReleasePage
 * @property {any} release
 * @property {string} body Rewritten release notes html.
 * @property {string} description The intro paragraph of the release notes.
 * @property {{login: string, avatar: string}[]} thanks People in the notes' "Thanks to" paragraph.
 * @property {string} cardUrl Url of the generated social card, from the site root.
 */

/** @param {any} release */
function releasePath(release) {
	return `release/${release.tag_name}/`;
}

/** @param {any} release */
function formatDate(release) {
	const date = dateFormatter.format(new Date(release.published_at));

	return `<time class="release-date" datetime="${escapeHtml(release.published_at)}">${date}</time>`;
}

/**
 * Fills the %NAME% placeholders of the page template in one pass, so values
 * are never scanned for placeholders.
 * @param {object} page
 * @param {string} page.title
 * @param {string} page.description
 * @param {string} page.path
 * @param {string} page.imageUrl
 * @param {string} page.imageAlt
 * @param {string} page.publishedTime
 * @param {string} page.sidebar Already escaped html.
 * @param {string} page.content Already escaped html.
 */
function renderDocument(page) {
	const values = {
		TITLE: escapeHtml(page.title),
		DESCRIPTION: escapeHtml(page.description),
		URL: escapeHtml(SITE_URL + page.path),
		IMAGE_URL: escapeHtml(page.imageUrl),
		IMAGE_WIDTH: String(CARD_WIDTH),
		IMAGE_HEIGHT: String(CARD_HEIGHT),
		IMAGE_ALT: escapeHtml(page.imageAlt),
		PUBLISHED_TIME: escapeHtml(page.publishedTime),
		SIDEBAR: page.sidebar,
		CONTENT: page.content,
	};

	return TEMPLATE.replace(/%([A-Z_]+)%/g, (placeholder, key) => {
		if (!Object.hasOwn(values, key)) {
			throw new Error(`Unknown placeholder ${placeholder} in ${TEMPLATE_PATH}`);
		}

		return values[key];
	});
}

/**
 * @param {any} release
 * @param {boolean} latest
 * @param {boolean} current Whether the page being rendered is this release.
 */
function renderTimelineLink(release, latest, current) {
	const published = new Date(release.published_at);
	const version = escapeHtml(`v${release.tag_name}`);
	const shortDate = escapeHtml(shortDateFormatter.format(published));
	const badge = latest ? '<em>Latest</em>' : '';
	let rowClass = 'release-timeline-row';
	let ariaCurrent = '';

	if (current) {
		rowClass += ' is-current';
		ariaCurrent = ' aria-current="page"';
	}

	return `<a class="${rowClass}"${ariaCurrent} href="/${releasePath(release)}"><b>${version}</b>${badge}<span class="release-timeline-date">${shortDate}</span></a>`;
}

/**
 * Renders the release list grouped by year, newest first.
 * @param {ReleasePage[]} pages
 * @param {any} currentRelease The release the page is for.
 */
function renderTimeline(pages, currentRelease) {
	let html = '<div class="release-timeline-list">';
	let year = 0;

	for (let i = 0; i < pages.length; i++) {
		const release = pages[i].release;
		const releaseYear = new Date(release.published_at).getUTCFullYear();

		if (releaseYear !== year) {
			year = releaseYear;
			html += `<div class="release-timeline-year">${year}</div>`;
		}

		html += renderTimelineLink(release, i === 0, release === currentRelease);
	}

	html += '</div>';

	return html;
}

/**
 * @param {ReleasePage[]} pages
 * @param {any} release The release the page is for.
 */
function renderSidebar(pages, release) {
	const timeline = renderTimeline(pages, release);
	let html =
		'<button class="release-timeline-button" type="button" commandfor="release-timeline-menu" command="show-modal">All releases</button>';
	html += `<dialog class="release-timeline-menu" id="release-timeline-menu"><nav class="release-timeline" aria-label="All releases">${timeline}</nav></dialog>`;

	return html;
}

/**
 * A contributor chip with their avatar and name, as on the homepage.
 * @param {string} login
 * @param {string} url Where the chip links to.
 * @param {string} avatar Url of the cached avatar.
 */
export function renderContributor(login, url, avatar) {
	let html = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="contributor">`;
	html += `<img src="${escapeHtml(avatar)}" alt="" width="32" height="32" loading="lazy">`;
	html += `<span class="contributor-name">${escapeHtml(login)}</span>`;
	html += '</a>';

	return html;
}

/** @param {ReleasePage} page */
function renderThanks(page) {
	if (page.thanks.length === 0) {
		return '';
	}

	let html = '<section class="release-thanks">';
	html += '<h2>Thanks to</h2>';
	html += '<div class="contributor-list">';

	for (const person of page.thanks) {
		html += renderContributor(
			person.login,
			`https://github.com/${person.login}`,
			person.avatar,
		);
	}

	html += '</div>';
	html += '</section>';

	return html;
}

/**
 * @param {ReleasePage} page
 * @param {ReleasePage[]} pages Every release page, for the sidebar.
 */
function renderReleasePage(page, pages) {
	const release = page.release;
	const version = `v${release.tag_name}`;
	const published = longDateFormatter.format(new Date(release.published_at));

	let content = '<article class="release-post">';
	content += '<header class="release-post-header">';
	content += formatDate(release);
	content += `<h1>Source 2 Viewer ${escapeHtml(version)}</h1>`;
	content += '<div class="release-meta">';
	content += `<a href="${escapeHtml(release.html_url)}">View on GitHub</a>`;
	content += '</div>';
	content += '</header>';
	content += `<div class="release-content">${page.body}</div>`;
	content += renderThanks(page);
	content += '</article>';

	return renderDocument({
		title: `Source 2 Viewer ${version}`,
		description: page.description,
		path: releasePath(release),
		imageUrl: new URL(page.cardUrl, SITE_URL).href,
		imageAlt: `Source 2 Viewer ${version}, released ${published}`,
		publishedTime: release.published_at,
		sidebar: renderSidebar(pages, release),
		content,
	});
}

/**
 * Writes a page for every release, newest first.
 * @param {ReleasePage[]} pages
 */
export function writeChangelogPages(pages) {
	rmSync(RELEASE_DIR, { recursive: true, force: true });
	mkdirSync(RELEASE_DIR);

	for (const page of pages) {
		const directory = join(RELEASE_DIR, page.release.tag_name);
		const html = renderReleasePage(page, pages);

		mkdirSync(directory);
		writeFileSync(join(directory, 'index.html'), html);
	}

	const latestPath = releasePath(pages[0].release);
	const redirect = REDIRECT_TEMPLATE.replaceAll(
		'%URL%',
		escapeHtml(SITE_URL + latestPath),
	).replaceAll('%PATH%', escapeHtml(`/${latestPath}`));

	writeFileSync(join(RELEASE_DIR, 'index.html'), redirect);
}
