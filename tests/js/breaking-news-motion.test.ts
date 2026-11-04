import { describe, expect, it } from 'vitest';

import { scrollDuration } from '../../src/breaking-news/motion';

describe( 'scrollDuration', () => {
	it( 'divides the width by the speed', () => {
		expect( scrollDuration( 1200, 60 ) ).toBe( 20 );
	} );

	it( 'never scrolls a loop in under eight seconds', () => {
		expect( scrollDuration( 100, 200 ) ).toBe( 8 );
	} );

	it( 'treats a zero speed as one pixel per second', () => {
		expect( scrollDuration( 600, 0 ) ).toBe( 600 );
	} );
} );
