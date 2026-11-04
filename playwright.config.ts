/// <reference types="node" />
/**
 * End-to-end tests against real WordPress, run by WordPress Playground, so no Docker is needed.
 * Two sites boot side by side from the same plugin folder: English on :9400 and Arabic, right to left, on :9401.
 *
 * WP_VERSION and PHP_VERSION choose the versions, so CI can also test the oldest supported pair.
 */
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PLUGIN = __dirname;
const EN = 'http://127.0.0.1:9400';
const AR = 'http://127.0.0.1:9401';

process.env.WP_ARTIFACTS_PATH ??= path.join( PLUGIN, 'artifacts' );
process.env.STORAGE_STATE_PATH ??= path.join(
	process.env.WP_ARTIFACTS_PATH,
	'storage-states/admin.json'
);
process.env.WP_BASE_URL ??= EN;

/**
 * A copy of a test blueprint with the requested versions. Playground lets a blueprint's
 * preferredVersions override the --wp and --php flags, and treats a blueprint without them
 * as "latest", so the versions have to be written into the blueprint itself.
 *
 * @param source Blueprint path, relative to the plugin.
 */
function blueprint( source: string ): string {
	const json = JSON.parse(
		fs.readFileSync( path.join( PLUGIN, source ), 'utf8' )
	);
	json.preferredVersions = {
		wp: process.env.WP_VERSION ?? 'latest',
		php: process.env.PHP_VERSION ?? '8.3',
	};
	const target = path.join(
		process.env.WP_ARTIFACTS_PATH ?? '',
		path.basename( source )
	);
	fs.mkdirSync( path.dirname( target ), { recursive: true } );
	fs.writeFileSync( target, JSON.stringify( json, null, '\t' ) );
	return target;
}

const playground = ( source: string, port: number ) =>
	[
		'npx wp-playground-cli server',
		`--mount=${ PLUGIN }:/wordpress/wp-content/plugins/wp-newsroom-blocks`,
		`--blueprint=${ blueprint( source ) }`,
		`--port=${ port }`,
	].join( ' ' );

export default defineConfig( {
	testDir: './tests/e2e',
	outputDir: path.join( process.env.WP_ARTIFACTS_PATH, 'test-results' ),
	globalSetup:
		require.resolve( '@wordpress/scripts/config/playwright/global-setup.js' ),
	reporter: process.env.CI ? [ [ 'github' ], [ 'list' ] ] : [ [ 'list' ] ],
	forbidOnly: !! process.env.CI,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	timeout: 120_000,
	use: {
		headless: true,
		viewport: { width: 1280, height: 900 },
		storageState: process.env.STORAGE_STATE_PATH,
		actionTimeout: 15_000,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	webServer: [
		{
			command: playground( 'tests/e2e/blueprint.json', 9400 ),
			url: EN,
			timeout: 300_000,
			reuseExistingServer: ! process.env.CI,
		},
		{
			command: playground( 'tests/e2e/blueprint-ar.json', 9401 ),
			url: AR,
			timeout: 300_000,
			reuseExistingServer: ! process.env.CI,
		},
	],
	projects: [
		{
			name: 'english',
			testIgnore: /rtl\.spec\.ts/,
			use: { ...devices[ 'Desktop Chrome' ], baseURL: EN },
		},
		{
			name: 'arabic',
			testMatch: /rtl\.spec\.ts/,
			use: {
				...devices[ 'Desktop Chrome' ],
				baseURL: AR,
				locale: 'ar',
				storageState: { cookies: [], origins: [] },
			},
		},
	],
} );
