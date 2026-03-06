import { globSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
	appType: 'mpa',
	root: 'src',
	publicDir: '../public',
	build: {
		outDir: '../dist',
		emptyOutDir: true,
		rolldownOptions: {
			input: globSync('src/**/*.html').map((f) => resolve(f)),
		},
	},
});
