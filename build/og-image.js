import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

// The background grid has 64px cells starting at the card origin, like the
// site background. The card is a whole number of cells and the content is
// inset by one cell on every side.
const CELL = 64;
export const CARD_WIDTH = 19 * CELL;
export const CARD_HEIGHT = 10 * CELL;
const CONTENT_HEIGHT = CARD_HEIGHT - 2 * CELL;

// The screenshot is cropped to this size, images narrower than the width are
// not used because they would have to be scaled up.
export const SCREENSHOT_WIDTH = 576;
const SCREENSHOT_HEIGHT = CONTENT_HEIGHT;
const SCREENSHOT_BORDER = 3;
const SCREENSHOT_INNER_WIDTH = SCREENSHOT_WIDTH - 2 * SCREENSHOT_BORDER;
const SCREENSHOT_INNER_HEIGHT = SCREENSHOT_HEIGHT - 2 * SCREENSHOT_BORDER;

const LOGO_SIZE = 44;

const BACKGROUND = 'hsl(216 40% 8%)';
const SECONDARY_TEXT = 'hsl(216 30% 78%)';
const ACCENT = '#63a1ff';

// Glows are ellipses spanning a fraction of the card, brightest in the center.
const CORNER_GLOW = `radial-gradient(ellipse ${0.7 * CARD_WIDTH}px ${0.7 * CARD_HEIGHT}px at 15% 85%, rgb(69 143 255 / 16%), rgb(69 143 255 / 0%))`;
const SCREENSHOT_GLOW = `radial-gradient(ellipse ${0.55 * CARD_WIDTH}px ${0.55 * CARD_HEIGHT}px at 70% 50%, rgb(69 143 255 / 10%), rgb(69 143 255 / 0%))`;

export const longDateFormatter = new Intl.DateTimeFormat('en', {
	dateStyle: 'long',
	timeZone: 'UTC',
});

// satori reads neither woff2 nor variable fonts.
const FONT_WEIGHTS = [500, 700, 800];
const fonts = FONT_WEIGHTS.map((weight) => ({
	name: 'Manrope',
	data: readFileSync(resolve(`src/static/fonts/Manrope-${weight}.ttf`)),
	weight,
	style: /** @type {const} */ ('normal'),
}));

/** @param {string} svg */
function svgDataUri(svg) {
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// The logo is the symbol the release pages draw, which only uses plain fills.
const template = readFileSync(resolve('build/release-template.html'), 'utf8');
const logoSymbol = template.match(
	/<symbol id="s2v-logo"[^>]*>([\s\S]*?)<\/symbol>/,
);

if (!logoSymbol) {
	throw new Error('build/release-template.html has no s2v-logo symbol');
}

const logoUri = svgDataUri(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">${logoSymbol[1]}</svg>`,
);

const gridUri = svgDataUri(
	`<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}"><defs><pattern id="g" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse"><path d="M${CELL} 0H0V${CELL}" fill="none" stroke="rgb(71 168 255)" stroke-opacity="0.08" stroke-width="2"/></pattern></defs><rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#g)"/></svg>`,
);

/**
 * @param {string} type
 * @param {Record<string, any>} props
 * @param {...any} children
 */
function h(type, props, ...children) {
	const content = children.length === 1 ? children[0] : children;

	return { type, props: { ...props, children: content } };
}

const grid = h('img', {
	src: gridUri,
	width: CARD_WIDTH,
	height: CARD_HEIGHT,
	style: { position: 'absolute', top: 0, left: 0 },
});

/**
 * The text column fills the width the screenshot leaves free. The release
 * block is pinned to the bottom, the header to the top.
 * @param {object} text
 * @param {string} text.title
 * @param {string} text.date
 * @param {string} text.summary
 * @param {number} text.summaryLines
 */
function textColumn(text) {
	const header = h(
		'div',
		{
			style: {
				display: 'flex',
				alignItems: 'center',
				gap: 6,
				height: CELL,
			},
		},
		h(
			'div',
			{
				style: {
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					width: CELL,
					height: CELL,
				},
			},
			h('img', { src: logoUri, width: LOGO_SIZE, height: LOGO_SIZE }),
		),
		h(
			'div',
			{ style: { fontSize: 26, fontWeight: 700, color: '#fff' } },
			'Source 2 Viewer',
		),
	);

	const title = h(
		'div',
		{
			style: {
				fontSize: 120,
				fontWeight: 800,
				color: ACCENT,
				lineHeight: `${2 * CELL}px`,
				letterSpacing: -4,
			},
		},
		text.title,
	);

	const date = h(
		'div',
		{
			style: {
				fontSize: 24,
				fontWeight: 700,
				color: ACCENT,
				lineHeight: `${CELL}px`,
			},
		},
		text.date,
	);

	const summary = h(
		'div',
		{
			style: {
				display: 'block',
				lineClamp: text.summaryLines,
				textOverflow: 'ellipsis',
				fontSize: 24,
				fontWeight: 500,
				color: SECONDARY_TEXT,
				lineHeight: `${CELL / 2}px`,
			},
		},
		text.summary,
	);

	const release = h(
		'div',
		{ style: { display: 'flex', flexDirection: 'column' } },
		title,
		date,
		summary,
	);

	return h(
		'div',
		{
			style: {
				display: 'flex',
				flexDirection: 'column',
				flex: 1,
				justifyContent: 'space-between',
			},
		},
		header,
		release,
	);
}

/** @param {string} screenshotUri */
function screenshotCard(screenshotUri) {
	return h(
		'div',
		{
			style: {
				display: 'flex',
				boxSizing: 'border-box',
				flexShrink: 0,
				width: SCREENSHOT_WIDTH,
				height: SCREENSHOT_HEIGHT,
				overflow: 'hidden',
				border: `${SCREENSHOT_BORDER}px solid rgb(99 161 255 / 55%)`,
				borderRadius: 24,
				boxShadow: '0 0 40px rgb(69 143 255 / 20%)',
			},
		},
		h('img', {
			src: screenshotUri,
			width: SCREENSHOT_INNER_WIDTH,
			height: SCREENSHOT_INNER_HEIGHT,
		}),
	);
}

/**
 * Renders the Open Graph card of a release as a PNG. Without a
 * screenshot the card is text only.
 * @param {object} release
 * @param {string} release.title
 * @param {string} release.publishedAt
 * @param {string} release.summary
 * @param {string | undefined} release.imagePath
 */
export async function renderReleaseCard(release) {
	const date = longDateFormatter.format(new Date(release.publishedAt));
	const text = textColumn({
		title: release.title,
		date,
		summary: release.summary,
		summaryLines: release.imagePath ? 5 : 4,
	});
	const children = [grid, text];
	let backgroundImage = CORNER_GLOW;

	if (release.imagePath) {
		const screenshot = await sharp(release.imagePath)
			.resize(SCREENSHOT_INNER_WIDTH, SCREENSHOT_INNER_HEIGHT, {
				fit: 'cover',
			})
			.png({ compressionLevel: 0 })
			.toBuffer();
		const screenshotUri = `data:image/png;base64,${screenshot.toString('base64')}`;

		children.push(screenshotCard(screenshotUri));
		backgroundImage = `${SCREENSHOT_GLOW}, ${CORNER_GLOW}`;
	}

	const card = h(
		'div',
		{
			style: {
				display: 'flex',
				boxSizing: 'border-box',
				gap: CELL,
				padding: CELL,
				width: CARD_WIDTH,
				height: CARD_HEIGHT,
				backgroundColor: BACKGROUND,
				backgroundImage,
				fontFamily: 'Manrope',
			},
		},
		...children,
	);

	const svg = await satori(card, {
		width: CARD_WIDTH,
		height: CARD_HEIGHT,
		fonts,
	});

	return sharp(Buffer.from(svg)).png().toBuffer();
}
