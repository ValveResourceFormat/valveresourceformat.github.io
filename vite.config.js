import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { SITE_URL } from './build/changelog-pages.js';
import { githubContent, loadGitHubContent } from './build/github-content.js';

// Meta tags and JSON-LD need absolute urls, which vite does not rewrite, so they
// would keep pointing at the unhashed paths. Emit those files as hashed assets
// and patch the urls into the built html.
function absoluteAssetUrls() {
	const pattern = new RegExp(`${SITE_URL}static/([\\w.-]+(?:/[\\w.-]+)*)`, 'g');
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

// Lists every built page except the ones marked noindex, like the /release/ redirect.
function sitemap() {
	return {
		name: 'sitemap',
		apply: 'build',
		enforce: 'post',
		generateBundle(_options, bundle) {
			let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
			xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

			for (const asset of Object.values(bundle)) {
				if (!asset.fileName.endsWith('.html')) {
					continue;
				}

				if (asset.source.includes('<meta name="robots" content="noindex">')) {
					continue;
				}

				const path = asset.fileName.replace(/(^|\/)index\.html$/, '$1');
				xml += `\t<url><loc>${SITE_URL}${path}</loc></url>\n`;
			}

			xml += '</urlset>\n';

			this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: xml });
		},
	};
}

export default defineConfig(async ({ isPreview }) => {
	const plugins = [absoluteAssetUrls(), sitemap()];

	// Release pages are written into the root before the inputs are listed.
	if (!isPreview) {
		plugins.push(githubContent(await loadGitHubContent()));
	}

	return {
		appType: 'mpa',
		root: 'src',
		publicDir: '../public',
		plugins,
		build: {
			outDir: '../dist',
			emptyOutDir: true,
			// Emit every asset as a file, small ones like avatars are not inlined into the html.
			assetsInlineLimit: 0,
			rolldownOptions: {
				input: globSync('src/**/*.html').map((f) => resolve(f)),
			},
		},
	};
});
