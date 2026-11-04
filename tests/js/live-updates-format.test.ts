import { describe, expect, it } from 'vitest';

import {
	PLURAL_SAMPLES,
	formatRelative,
	pluralLabel,
	withWesternDigits,
} from '../../src/live-updates/format';

const NOW = 1_800_000_000;

describe( 'withWesternDigits', () => {
	it( 'asks Intl for Western digits, as WordPress prints them', () => {
		expect( withWesternDigits( 'ar' ) ).toBe( 'ar-u-nu-latn' );
		expect( withWesternDigits( 'en-US' ) ).toBe( 'en-US-u-nu-latn' );
	} );

	it( 'keeps a tag that already chooses its own extensions', () => {
		expect( withWesternDigits( 'ar-u-nu-arab' ) ).toBe( 'ar-u-nu-arab' );
	} );

	it( 'falls back to English when the page has no language', () => {
		expect( withWesternDigits( '' ) ).toBe( 'en-u-nu-latn' );
	} );
} );

describe( 'formatRelative', () => {
	it( 'says "now" for the first seconds', () => {
		expect( formatRelative( NOW - 10, NOW, 'en' ) ).toBe( 'now' );
	} );

	it( 'counts minutes, then hours, then days', () => {
		expect( formatRelative( NOW - 5 * 60, NOW, 'en' ) ).toBe(
			'5 minutes ago'
		);
		expect( formatRelative( NOW - 3 * 3600, NOW, 'en' ) ).toBe(
			'3 hours ago'
		);
		expect( formatRelative( NOW - 2 * 86400, NOW, 'en' ) ).toBe(
			'2 days ago'
		);
	} );

	it( 'writes Arabic with Western digits', () => {
		expect( formatRelative( NOW - 5 * 60, NOW, 'ar-u-nu-latn' ) ).toBe(
			'قبل 5 دقائق'
		);
	} );
} );

describe( 'pluralLabel', () => {
	// What the server sends for English: gettext's singular for 1, the plural for the rest.
	const english = Object.fromEntries(
		PLURAL_SAMPLES.map( ( n ) => [
			String( n ),
			n === 1 ? 'Show %s new update' : 'Show %s new updates',
		] )
	);

	it( 'uses the singular for one update', () => {
		expect( pluralLabel( english, 1, 'en' ) ).toBe( 'Show 1 new update' );
	} );

	it( 'uses the plural for any other count', () => {
		expect( pluralLabel( english, 4, 'en' ) ).toBe( 'Show 4 new updates' );
		expect( pluralLabel( english, 1200, 'en-u-nu-latn' ) ).toBe(
			'Show 1,200 new updates'
		);
	} );

	// Arabic has six plural forms; each sample number stands for one of them.
	const arabic: Record< string, string > = {
		0: 'zero %s',
		1: 'one %s',
		2: 'two %s',
		3: 'few %s',
		11: 'many %s',
		100: 'other %s',
	};

	it.each( [
		[ 0, 'zero 0' ],
		[ 1, 'one 1' ],
		[ 2, 'two 2' ],
		[ 7, 'few 7' ],
		[ 25, 'many 25' ],
		[ 102, 'other 102' ],
	] )( 'picks the right Arabic form for %i', ( count, expected ) => {
		expect( pluralLabel( arabic, count, 'ar-u-nu-latn' ) ).toBe( expected );
	} );
} );
