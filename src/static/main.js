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

const SvgNamespace = 'http://www.w3.org/2000/svg';
const SkyboxTileSize = 128;
const SkyboxLineHeight = 13;
const SkyboxWaveDelay = 60;
const ReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const FlipTiming = {
	duration: 700,
	easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
};
const VerticalAxis = { x: 0, y: 1 };

// The labels and colors Source 2 Viewer generates for tools materials and triggers
const ToolTextures = [
	{ name: 'post process volume', color: [0, 254, 186] },
	{ name: 'audio blocker', color: [0, 232, 203] },
	{ name: 'audio modifier', color: [37, 189, 252] },
	{ name: 'camera clip', color: [40, 152, 153] },
	{ name: 'climb', color: [0, 0, 0] },
	{ name: 'nav walkable', color: [25, 120, 0] },
	{ name: 'fog volume', color: [197, 0, 255] },
	{ name: 'no nav clip', color: [211, 59, 33] },
	{ name: 'sky vis blocker', color: [93, 195, 255] },
	{ name: 'conveyor', color: [0, 254, 58] },
	{ name: 'func occluder', color: [161, 178, 255] },
	{ name: 'spawn volume', color: [255, 128, 0] },
	{ name: 'block los', color: [0, 0, 255] },
	{ name: 'block bullets', color: [255, 130, 5] },
	{ name: 'block light', color: [110, 150, 12] },
	{ name: 'block sound', color: [116, 148, 2] },
	{ name: 'clip', color: [211, 58, 33] },
	{ name: 'control clip', color: [210, 32, 173] },
	{ name: 'creature clip', color: [219, 93, 8] },
	{ name: 'fog', color: [150, 146, 145] },
	{ name: 'grenade clip', color: [185, 255, 18] },
	{ name: 'ignore npc', color: [186, 109, 156] },
	{ name: 'invisible', color: [254, 141, 193] },
	{ name: 'ladder', color: [254, 152, 123] },
	{ name: 'light probe volume', color: [255, 200, 16] },
	{ name: 'light volume boundary', color: [115, 191, 255] },
	{ name: 'nav clip', color: [197, 8, 166] },
	{ name: 'nodraw', color: [252, 217, 35] },
	{ name: 'nodraw grate', color: [178, 251, 35] },
	{ name: 'npc clip', color: [140, 32, 210] },
	{ name: 'occluder', color: [112, 228, 37] },
	{ name: 'player clip', color: [197, 0, 123] },
	{ name: 'precipitation', color: [141, 191, 224] },
	{ name: 'render portal', color: [0, 254, 254] },
	{ name: 'skip', color: [37, 189, 252] },
	{ name: 'skybox', color: [178, 224, 252] },
	{ name: 'skybox occluder', color: [203, 177, 252] },
	{ name: 'slide', color: [210, 142, 32] },
	{ name: 'teleport clip', color: [1, 152, 164] },
	{ name: 'trigger', color: [255, 156, 0] },
	{ name: 'vis blocker', color: [93, 195, 255] },
	{ name: 'trigger once', color: [255, 156, 0] },
	{ name: 'trigger multiple', color: [255, 156, 0] },
	{ name: 'trigger push', color: [70, 200, 255] },
	{ name: 'trigger teleport', color: [190, 120, 255] },
	{ name: 'trigger hurt', color: [255, 80, 70] },
	{ name: 'trigger gravity', color: [70, 200, 255] },
	{ name: 'trigger catapult', color: [70, 200, 255] },
	{ name: 'trigger changelevel', color: [100, 220, 110] },
	{ name: 'trigger autosave', color: [100, 220, 110] },
	{ name: 'trigger look', color: [255, 230, 140] },
	{ name: 'trigger soundscape', color: [0, 232, 203] },
	{ name: 'buyzone', color: [150, 230, 70] },
	{ name: 'bomb target', color: [255, 90, 130] },
	{ name: 'hostage rescue', color: [90, 230, 220] },
	{ name: 'regenerate', color: [100, 220, 110] },
	{ name: 'water', color: [40, 120, 255] },
	{ name: 'trigger resonance cascade', color: [255, 170, 40] },
	{ name: 'hlx', color: [255, 128, 0] },
	{ name: 'crowbar', color: [190, 40, 30] },
	{ name: 'headcrab clip', color: [214, 196, 150] },
	{ name: 'combine clip', color: [70, 110, 140] },
	{ name: 'rise and shine', color: [40, 60, 80] },
	{ name: 'the cake is a lie', color: [255, 255, 255] },
	{ name: 'companion cube', color: [255, 150, 200] },
	{ name: 'aperture science', color: [235, 235, 235] },
	{ name: 'lambda', color: [255, 140, 0] },
	{ name: 'xpaw', color: [99, 161, 255] },
	{ name: 'the end is never', color: [0, 0, 0] },
];

/** @typedef {{name: string, color: number[]}} ToolTexture */
/** @typedef {{element: HTMLElement, faces: HTMLElement[], name: string, flips: number}} SkyboxTile */
/** @typedef {{x: number, y: number}} FlipAxis */

/**
 * @param {SVGSVGElement} face
 * @param {ToolTexture} texture
 */
function DrawToolTexture(face, texture) {
	const label = face.querySelector('text');
	const words = texture.name.toUpperCase().split(' ');
	const x = label.getAttribute('x');
	let y =
		Number(label.getAttribute('y')) -
		((words.length - 1) * SkyboxLineHeight) / 2;

	label.replaceChildren();

	for (const word of words) {
		const line = document.createElementNS(SvgNamespace, 'tspan');
		line.setAttribute('x', x);
		line.setAttribute('y', y);
		line.textContent = word;
		label.append(line);
		y += SkyboxLineHeight;
	}

	face.style.setProperty('--tool-color', `rgb(${texture.color.join(' ')})`);
}

/** @param {string} currentName */
function PickRandomTexture(currentName) {
	let texture;

	do {
		texture = ToolTextures[Math.floor(Math.random() * ToolTextures.length)];
	} while (texture.name === currentName);

	return texture;
}

/**
 * @param {FlipAxis} axis
 * @param {number} angle
 */
function GetFlipTransform(axis, angle) {
	return `rotate3d(${axis.x}, ${axis.y}, 0, ${angle}deg)`;
}

/** @param {SkyboxTile} tile */
function IsFlipping(tile) {
	for (const animation of tile.element.getAnimations({ subtree: true })) {
		// Once the eased progress reaches 1 the face is flat and only its overshoot remains
		if (animation.effect.getComputedTiming().progress < 1) {
			return true;
		}
	}

	return false;
}

/**
 * @param {SkyboxTile} tile
 * @param {ToolTexture} texture
 * @param {FlipAxis} [axis]
 */
function FlipSkyboxTile(tile, texture, axis = VerticalAxis) {
	if (texture.name === tile.name) {
		return;
	}

	const outgoing = tile.faces[tile.flips % 2];
	tile.flips++;
	tile.name = texture.name;

	const incoming = tile.faces[tile.flips % 2];
	DrawToolTexture(incoming.firstChild, texture);

	const outgoingEnd = GetFlipTransform(axis, 180);
	const incomingStart = GetFlipTransform(axis, -180);
	const incomingEnd = GetFlipTransform(axis, 0);

	outgoing.style.transform = outgoingEnd;
	incoming.style.transform = incomingEnd;

	if (ReducedMotion.matches) {
		return;
	}

	for (const animation of tile.element.getAnimations({ subtree: true })) {
		animation.cancel();
	}

	outgoing.animate({ transform: [incomingEnd, outgoingEnd] }, FlipTiming);
	incoming.animate({ transform: [incomingStart, incomingEnd] }, FlipTiming);
}

/**
 * @param {AudioContext} audio
 * @param {BiquadFilterType} type
 * @param {number} frequency
 * @param {number} q
 * @param {AudioNode} output
 */
function CreateFilter(audio, type, frequency, q, output) {
	const filter = audio.createBiquadFilter();
	filter.type = type;
	filter.frequency.value = frequency;
	filter.Q.value = q;
	filter.connect(output);

	return filter;
}

/** @param {AudioContext} audio */
function CreateNoiseBuffer(audio) {
	const noise = audio.createBuffer(1, audio.sampleRate * 0.1, audio.sampleRate);
	const samples = noise.getChannelData(0);

	for (let i = 0; i < samples.length; i++) {
		samples[i] = Math.random() * 2 - 1;
	}

	return noise;
}

/**
 * @param {AudioContext} audio
 * @param {AudioBuffer} noise
 * @param {AudioNode[]} filters
 * @param {number} time
 * @param {number} level
 * @param {number} decay
 */
function PlayTick(audio, noise, filters, time, level, decay) {
	const source = audio.createBufferSource();
	source.buffer = noise;

	const envelope = audio.createGain();
	envelope.gain.setValueAtTime(level, time);
	envelope.gain.setTargetAtTime(0, time, decay);
	source.connect(envelope);

	for (const filter of filters) {
		envelope.connect(filter);
	}

	source.start(time);
	source.stop(time + decay * 6);
}

/**
 * @param {AudioContext} audio
 * @param {AudioBuffer} noise
 * @param {number} volume
 * @param {number} time
 */
function PlayFlipSound(audio, noise, volume, time) {
	const pitch = 0.95 + Math.random() * 0.1;

	const output = audio.createGain();
	output.gain.value = volume;
	output.connect(audio.destination);

	const filters = [
		CreateFilter(audio, 'highpass', 2000, 1, output),
		CreateFilter(audio, 'bandpass', 2750 * pitch, 2, output),
		CreateFilter(audio, 'bandpass', 6000 * pitch, 2, output),
	];

	const secondTickTime = time + 0.026 + Math.random() * 0.008;

	PlayTick(audio, noise, filters, time, 0.7, 0.006);
	PlayTick(audio, noise, filters, secondTickTime, 1, 0.012);
}

/** @param {HTMLElement} skybox */
function InitSkybox(skybox) {
	const pattern = skybox.querySelector('pattern');
	const tiles = new Map();
	let hoveredCell = '';
	let waveName = 'skybox';
	let audio = null;
	let noise = null;
	let flipTimer = 0;
	let tileSize;
	let columns;
	let rows;

	function FitTiles() {
		columns = Math.max(1, Math.round(skybox.clientWidth / SkyboxTileSize));
		// Whole device pixels keep tile edges from blending into their neighbours, the last column is cut off by a few pixels
		tileSize =
			Math.ceil((skybox.clientWidth / columns) * devicePixelRatio) /
			devicePixelRatio;
		rows = Math.ceil(skybox.clientHeight / tileSize);

		skybox.style.setProperty('--tile-size', `${tileSize}px`);
		pattern.setAttribute(
			'patternTransform',
			`scale(${tileSize / SkyboxTileSize})`,
		);
	}

	new ResizeObserver(FitTiles).observe(skybox);

	/**
	 * @param {number} column
	 * @param {number} row
	 * @returns {SkyboxTile}
	 */
	function GetTile(column, row) {
		const cell = `${column},${row}`;
		let tile = tiles.get(cell);

		if (tile) {
			return tile;
		}

		const element = document.createElement('div');
		element.className = 'skybox-tile';
		element.style.setProperty('--column', column);
		element.style.setProperty('--row', row);

		const faces = [];

		for (let i = 0; i < 2; i++) {
			const face = document.createElement('div');
			face.className = 'skybox-face';

			const svg = document.createElementNS(SvgNamespace, 'svg');
			svg.setAttribute('viewBox', `0 0 ${SkyboxTileSize} ${SkyboxTileSize}`);

			for (const child of pattern.children) {
				svg.append(child.cloneNode(true));
			}

			face.append(svg);
			element.append(face);
			faces.push(face);
		}

		skybox.append(element);
		tile = { element, faces, name: 'skybox', flips: 0 };
		tiles.set(cell, tile);

		return tile;
	}

	/**
	 * @param {number} column
	 * @param {number} row
	 */
	function FlipIdleCell(column, row) {
		const tile = GetTile(column, row);

		if (!IsFlipping(tile)) {
			FlipSkyboxTile(tile, PickRandomTexture(tile.name));
		}
	}

	/** @param {MouseEvent} e */
	function GetCellAt(e) {
		const bounds = skybox.getBoundingClientRect();
		const column = Math.floor((e.clientX - bounds.left) / tileSize);
		const row = Math.floor((e.clientY - bounds.top) / tileSize);

		return { column, row };
	}

	skybox.addEventListener('pointermove', (e) => {
		const { column, row } = GetCellAt(e);
		const cell = `${column},${row}`;

		if (cell === hoveredCell) {
			return;
		}

		hoveredCell = cell;
		FlipIdleCell(column, row);
	});

	skybox.addEventListener('click', (e) => {
		if (!audio) {
			audio = new AudioContext();
			noise = CreateNoiseBuffer(audio);
		}

		audio.resume();

		const origin = GetCellAt(e);
		const texture = PickRandomTexture(waveName);
		waveName = texture.name;

		for (let row = 0; row < rows; row++) {
			for (let column = 0; column < columns; column++) {
				const offsetX = column - origin.column;
				const offsetY = row - origin.row;
				const distance = Math.hypot(offsetX, offsetY);

				let axis;

				if (Math.abs(offsetY) > Math.abs(offsetX)) {
					axis = { x: -Math.sign(offsetY), y: 0 };
				} else if (offsetX !== 0) {
					axis = { x: 0, y: Math.sign(offsetX) };
				}

				setTimeout(
					() => FlipSkyboxTile(GetTile(column, row), texture, axis),
					distance * SkyboxWaveDelay,
				);
			}
		}

		const farthestColumn = Math.max(origin.column, columns - 1 - origin.column);
		const farthestRow = Math.max(origin.row, rows - 1 - origin.row);
		const rings = Math.ceil(Math.hypot(farthestColumn, farthestRow)) + 1;
		const start = audio.currentTime;

		for (let ring = 0; ring < rings; ring++) {
			const volume = 0.05 * (1 - ring / rings);
			const time = start + (ring * SkyboxWaveDelay) / 1000;
			PlayFlipSound(audio, noise, volume, time);
		}
	});

	function FlipRandomCell() {
		FlipIdleCell(
			Math.floor(Math.random() * columns),
			Math.floor(Math.random() * rows),
		);
	}

	new IntersectionObserver((entries) => {
		clearInterval(flipTimer);

		if (entries[0].isIntersecting && !ReducedMotion.matches) {
			flipTimer = setInterval(FlipRandomCell, 2000);
		}
	}).observe(skybox);

	skybox.addEventListener('pointerleave', () => {
		hoveredCell = '';
	});
}

const skybox = document.querySelector('.skybox');
if (skybox) {
	InitSkybox(skybox);
}
