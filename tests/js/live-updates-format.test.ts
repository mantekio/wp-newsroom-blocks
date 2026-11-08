import { describe, expect, it } from 'vitest';

import {
	PLURAL_SAMPLES,
	elapsed,
	formatInteger,
	pluralLabel,
	relativeLabel,
	type PluralLabels,
	type RelativeLabels,
} from '../../src/live-updates/format';

/**
 * Builds the labels the server sends for English: gettext's singular for 1, the plural for the rest.
 *
 * @param singular The singular form.
 * @param plural   The plural form.
 */
const english = ( singular: string, plural: string ): PluralLabels =>
	Object.fromEntries(
		PLURAL_SAMPLES.map( ( n ) => [
			String( n ),
			n === 1 ? singular : plural,
		] )
	);

describe( 'elapsed', () => {
	// The same cases as LiveUpdatesTest::test_elapsed_time_is_rounded_as_the_browser_rounds_it
	// in PHP: the server and the browser must agree on every one.
	it.each( [
		[ -30, 'now', 0 ],
		[ 0, 'now', 0 ],
		[ 59, 'now', 0 ],
		[ 60, 'minute', 1 ],
		[ 89, 'minute', 1 ],
		[ 90, 'minute', 2 ],
		[ 48 * 60, 'minute', 48 ],
		[ 59 * 60 + 29, 'minute', 59 ],
		[ 59 * 60 + 30, 'hour', 1 ],
		[ 70 * 60, 'hour', 1 ],
		[ 23 * 3600 + 29 * 60, 'hour', 23 ],
		[ 23 * 3600 + 30 * 60, 'day', 1 ],
		[ 36 * 3600 - 1, 'day', 1 ],
		[ 36 * 3600, 'day', 2 ],
	] )( '%i seconds is %s %i', ( seconds, unit, value ) => {
		expect( elapsed( seconds ) ).toEqual( [ unit, value ] );
	} );
} );

describe( 'formatInteger', () => {
	it( 'groups thousands with the separator WordPress uses for the site language', () => {
		expect( formatInteger( 999, ',' ) ).toBe( '999' );
		expect( formatInteger( 1000, ',' ) ).toBe( '1,000' );
		expect( formatInteger( 1234567, '٬' ) ).toBe( '1٬234٬567' );
		expect( formatInteger( 1000, '' ) ).toBe( '1000' );
	} );

	it( 'always writes Western digits, as WordPress does', () => {
		expect( formatInteger( 12, ',' ) ).toMatch( /^[0-9]+$/ );
	} );
} );

describe( 'pluralLabel', () => {
	const showNew = english( 'Show %s new update', 'Show %s new updates' );

	it( 'uses the singular for one update', () => {
		expect( pluralLabel( showNew, 1, 'en', ',' ) ).toBe(
			'Show 1 new update'
		);
	} );

	it( 'uses the plural for any other count, with the separator', () => {
		expect( pluralLabel( showNew, 4, 'en', ',' ) ).toBe(
			'Show 4 new updates'
		);
		expect( pluralLabel( showNew, 1200, 'en', ',' ) ).toBe(
			'Show 1,200 new updates'
		);
	} );

	it( 'falls back to English rules for a tag Intl does not accept', () => {
		expect( pluralLabel( showNew, 1, 'not a language', ',' ) ).toBe(
			'Show 1 new update'
		);
		expect( pluralLabel( showNew, 1, '', ',' ) ).toBe(
			'Show 1 new update'
		);
	} );

	// Arabic has six plural forms; each sample number stands for one of them.
	const arabic: PluralLabels = {
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
		[ 1000, 'other 1٬000' ],
	] )( 'picks the right Arabic form for %i', ( count, expected ) => {
		expect( pluralLabel( arabic, count, 'ar', '٬' ) ).toBe( expected );
	} );
} );

describe( 'relativeLabel', () => {
	const labels: RelativeLabels = {
		now: 'just now',
		minute: english( '%s minute ago', '%s minutes ago' ),
		hour: english( '%s hour ago', '%s hours ago' ),
		day: english( '%s day ago', '%s days ago' ),
	};

	it( 'says "just now" for the first minute', () => {
		expect( relativeLabel( 30, labels, 'en', ',' ) ).toBe( 'just now' );
	} );

	it( 'counts minutes, hours and days, as the server does', () => {
		expect( relativeLabel( 60, labels, 'en', ',' ) ).toBe( '1 minute ago' );
		// The browser said "1 hour ago" here, while the server said 48 minutes.
		expect( relativeLabel( 48 * 60, labels, 'en', ',' ) ).toBe(
			'48 minutes ago'
		);
		expect( relativeLabel( 3 * 3600, labels, 'en', ',' ) ).toBe(
			'3 hours ago'
		);
		// Never "yesterday", which the server does not say either.
		expect( relativeLabel( 86400, labels, 'en', ',' ) ).toBe( '1 day ago' );
	} );

	it( 'picks the Arabic form, as the server does', () => {
		const arabic: RelativeLabels = {
			...labels,
			minute: {
				0: 'قبل %s دقيقة',
				1: 'قبل دقيقة واحدة',
				2: 'قبل دقيقتين',
				3: 'قبل %s دقائق',
				11: 'قبل %s دقيقة',
				100: 'قبل %s دقيقة',
			},
		};
		expect( relativeLabel( 120, arabic, 'ar', '٬' ) ).toBe( 'قبل دقيقتين' );
		expect( relativeLabel( 5 * 60, arabic, 'ar', '٬' ) ).toBe(
			'قبل 5 دقائق'
		);
		expect( relativeLabel( 48 * 60, arabic, 'ar', '٬' ) ).toBe(
			'قبل 48 دقيقة'
		);
	} );
} );
