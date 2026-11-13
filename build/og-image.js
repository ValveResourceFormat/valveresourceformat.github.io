import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

// The screenshot is cropped to this size, images narrower than the width are
// not used because they would have to be scaled up.
export const SCREENSHOT_WIDTH = 660;
const SCREENSHOT_HEIGHT = 490;

const BACKGROUND = 'hsl(216 40% 8%)';
const SECONDARY_TEXT = 'hsl(216 30% 78%)';
const ACCENT = '#63a1ff';

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
	`<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}"><defs><pattern id="g" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="rgb(71 168 255)" stroke-opacity="0.08" stroke-width="2"/></pattern></defs><rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#g)"/></svg>`,
);

/**
 * A radial glow over the whole card.
 * @param {string} centerX
 * @param {string} centerY
 * @param {string} radius
 * @param {number} opacity
 */
function glowUri(centerX, centerY, radius, opacity) {
	return svgDataUri(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}"><defs><radialGradient id="r" cx="${centerX}" cy="${centerY}" r="${radius}"><stop offset="0" stop-color="#458fff" stop-opacity="${opacity}"/><stop offset="1" stop-color="#458fff" stop-opacity="0"/></radialGradient></defs><rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#r)"/></svg>`,
	);
}

/**
 * @param {string} type
 * @param {Record<string, any>} props
 * @param {...any} children
 */
function h(type, props, ...children) {
	const content = children.length === 1 ? children[0] : children;

	return { type, props: { ...props, children: content } };
}

/** @param {string} uri */
function fullCardImage(uri) {
	return h('img', {
		src: uri,
		width: CARD_WIDTH,
		height: CARD_HEIGHT,
		style: { position: 'absolute', top: 0, left: 0 },
	});
}

/** @param {number} size */
function logo(size) {
	return h('img', { src: logoUri, width: size, height: size });
}

/** @param {number} lines */
function clampLines(lines) {
	return { display: 'block', lineClamp: lines, textOverflow: 'ellipsis' };
}

/**
 * @param {object} text
 * @param {string} text.title
 * @param {string} text.date
 * @param {string} text.summary
 * @param {string} text.padding
 * @param {number} text.width
 * @param {number} text.summaryWidth
 * @param {number} text.summaryLines
 */
function textColumn(text) {
	const header = h(
		'div',
		{ style: { display: 'flex', alignItems: 'center', gap: 16 } },
		logo(44),
		h(
			'div',
			{ style: { fontSize: 26, fontWeight: 700, color: '#fff' } },
			'Source 2 Viewer',
		),
	);

	const release = h(
		'div',
		{ style: { display: 'flex', flexDirection: 'column' } },
		h(
			'div',
			{
				style: {
					fontSize: 132,
					fontWeight: 800,
					color: ACCENT,
					lineHeight: 1,
					letterSpacing: -4,
				},
			},
			text.title,
		),
		h(
			'div',
			{
				style: {
					fontSize: 24,
					fontWeight: 700,
					color: ACCENT,
					marginTop: 12,
				},
			},
			text.date,
		),
		h(
			'div',
			{
				style: {
					...clampLines(text.summaryLines),
					fontSize: 23,
					fontWeight: 500,
					color: SECONDARY_TEXT,
					marginTop: 14,
					lineHeight: 1.4,
					width: text.summaryWidth,
				},
			},
			text.summary,
		),
	);

	return h(
		'div',
		{
			style: {
				display: 'flex',
				flexDirection: 'column',
				padding: text.padding,
				boxSizing: 'border-box',
				width: text.width,
				height: CARD_HEIGHT,
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
				position: 'absolute',
				left: 500,
				top: 70,
				width: SCREENSHOT_WIDTH,
				height: SCREENSHOT_HEIGHT,
				display: 'flex',
				overflow: 'hidden',
				border: '3px solid rgb(99 161 255 / 55%)',
				borderRadius: 24,
				boxShadow: '0 0 40px rgb(69 143 255 / 20%)',
			},
		},
		h('img', {
			src: screenshotUri,
			width: SCREENSHOT_WIDTH,
			height: SCREENSHOT_HEIGHT,
			style: { objectFit: 'cover' },
		}),
	);
}

/** @param {any[]} children */
function cardRoot(...children) {
	return h(
		'div',
		{
			style: {
				display: 'flex',
				width: CARD_WIDTH,
				height: CARD_HEIGHT,
				background: BACKGROUND,
				position: 'relative',
				fontFamily: 'Manrope',
			},
		},
		...children,
	);
}

/**
 * Renders the 1200x630 Open Graph card of a release as a PNG. Without a
 * screenshot the card is text only.
 * @param {object} release
 * @param {string} release.title
 * @param {string} release.publishedAt
 * @param {string} release.summary
 * @param {string | undefined} release.imagePath
 */
export async function renderReleaseCard(release) {
	const date = longDateFormatter.format(new Date(release.publishedAt));
	const grid = fullCardImage(gridUri);
	const classicGlow = fullCardImage(glowUri('15%', '85%', '70%', 0.16));
	let card;

	if (release.imagePath) {
		const screenshot = await sharp(release.imagePath)
			.resize(SCREENSHOT_WIDTH, SCREENSHOT_HEIGHT, { fit: 'cover' })
			.png()
			.toBuffer();
		const screenshotUri = `data:image/png;base64,${screenshot.toString('base64')}`;

		card = cardRoot(
			grid,
			classicGlow,
			fullCardImage(glowUri('70%', '50%', '55%', 0.1)),
			textColumn({
				title: release.title,
				date,
				summary: release.summary,
				padding: '60px 0 60px 56px',
				width: 440,
				summaryWidth: 390,
				summaryLines: 5,
			}),
			screenshotCard(screenshotUri),
		);
	} else {
		card = cardRoot(
			grid,
			classicGlow,
			textColumn({
				title: release.title,
				date,
				summary: release.summary,
				padding: '60px 56px',
				width: CARD_WIDTH,
				summaryWidth: 900,
				summaryLines: 3,
			}),
		);
	}

	const svg = await satori(card, {
		width: CARD_WIDTH,
		height: CARD_HEIGHT,
		fonts,
	});

	return sharp(Buffer.from(svg)).png().toBuffer();
}
