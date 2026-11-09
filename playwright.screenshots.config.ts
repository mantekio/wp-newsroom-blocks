/// <reference types="node" />
/**
 * Takes the screenshots in docs/ with `npm run screenshots`, on the same two Playground sites as
 * the end-to-end tests. A configuration of its own, so the test suite never rewrites the images.
 */
import { defineConfig } from '@playwright/test';

import config from './playwright.config';

export default defineConfig( {
	...config,
	testMatch: /screenshots\.ts$/,
	retries: 0,
	projects: [ { name: 'screenshots', use: config.projects?.[ 0 ]?.use } ],
} );
