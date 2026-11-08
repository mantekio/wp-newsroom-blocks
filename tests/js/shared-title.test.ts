import { describe, expect, it } from 'vitest';

import { stripTags } from '../../src/shared/title';

describe( 'stripTags', () => {
	it( 'drops the markup a title can carry, and keeps its text', () => {
		expect( stripTags( 'Markup <em>in</em> the <b>title</b>' ) ).toBe(
			'Markup in the title'
		);
	} );

	it( 'leaves entities for decodeEntities(), so escaped tags stay text', () => {
		expect( stripTags( 'Tags &lt;em&gt; &amp; entities' ) ).toBe(
			'Tags &lt;em&gt; &amp; entities'
		);
	} );

	it( 'returns an empty string for an empty title', () => {
		expect( stripTags( '' ) ).toBe( '' );
		expect( stripTags( '<em></em>' ) ).toBe( '' );
	} );
} );
