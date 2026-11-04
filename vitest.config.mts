/**
 * Unit tests for the pure TypeScript helpers. The Playwright end-to-end tests live in tests/e2e.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig( {
	test: {
		include: [ 'tests/js/**/*.test.ts' ],
		environment: 'node',
	},
} );
