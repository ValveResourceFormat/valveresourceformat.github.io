import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const SITE_URL = 'https://s2v.app/';

// Meta tags and JSON-LD need absolute urls, which vite does not rewrite, so they
// would keep pointing at the unhashed paths. Emit those files as hashed assets
// and patch the urls into the built html.
function absoluteAssetUrls() {
	const pattern = new RegExp(`${SITE_URL}static/([\\w.-]+)`, 'g');
	const refs = new Map();

	return {
		name: 'absolute-asset-urls',
		apply: 'build',
		enforce: 'post',
		buildStart() {
			for (const file of globSync('src/**/*.html')) {
				for (const [, name] of readFileSync(file, 'utf8').matchAll(pattern)) {
					if (refs.has(name)) {
						continue;
					}

					refs.set(
						name,
						this.emitFile({
							type: 'asset',
							name,
							source: readFileSync(resolve('src/static', name)),
						}),
					);
				}
			}
		},
		generateBundle(_options, bundle) {
			for (const asset of Object.values(bundle)) {
				if (!asset.fileName.endsWith('.html')) {
					continue;
				}

				asset.source = asset.source.replaceAll(
					pattern,
					(_url, name) => SITE_URL + this.getFileName(refs.get(name)),
				);
			}
		},
	};
}

export default defineConfig({
	appType: 'mpa',
	root: 'src',
	publicDir: '../public',
	plugins: [absoluteAssetUrls()],
	build: {
		outDir: '../dist',
		emptyOutDir: true,
		rolldownOptions: {
			input: globSync('src/**/*.html').map((f) => resolve(f)),
		},
	},
});
