/// <reference types="node" />
/**
 * The Arabic demo story on a right-to-left site: direction, translations and plural forms.
 */
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { RequestUtils } from '@wordpress/e2e-test-utils-playwright';

import { openStory, scrollDirection } from './story';

type Post = { id: number; content: { raw: string } };

const ARABIC_INDIC_DIGITS = /[٠-٩]/;

test.describe( 'Right to left, in Arabic', () => {
	test.beforeEach( async ( { page } ) => {
		await openStory( page );
	} );

	test( 'the page reads right to left, in Arabic', async ( { page } ) => {
		await expect( page.locator( 'html' ) ).toHaveAttribute( 'dir', 'rtl' );
		await expect(
			page.getByRole( 'region', { name: 'عاجل' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'complementary', { name: 'اقرأ أيضاً' } )
		).toBeVisible();
		await expect(
			page.locator( '.wp-block-mantek-live-updates__count' )
		).toHaveText( '3 تحديثات' );
	} );

	test( 'the timeline rail moves to the right', async ( { page } ) => {
		const timeline = page.locator( '.wp-block-mantek-timeline' );
		const layout = await timeline.evaluate( ( el ) => {
			const style = getComputedStyle( el );
			const rail = getComputedStyle( el, '::before' );
			return {
				paddingLeft: style.paddingLeft,
				paddingRight: style.paddingRight,
				railLeft: rail.left,
				railRight: rail.right,
			};
		} );

		expect( layout.paddingLeft ).toBe( '0px' );
		expect( layout.paddingRight ).not.toBe( '0px' );
		// Browsers report both offsets of a positioned box in pixels; the short one is its side.
		expect( parseFloat( layout.railRight ) ).toBeLessThan(
			parseFloat( layout.railLeft )
		);
	} );

	test( 'the bar scrolls right, the reading direction', async ( {
		page,
	} ) => {
		expect( await scrollDirection( page ) ).toBe( 'right' );
	} );

	test( 'how-long-ago labels are Arabic, with Western digits', async ( {
		page,
	} ) => {
		const ago = page.locator( '.wp-block-mantek-live-update__ago' ).first();

		await expect( ago ).toHaveText( /^قبل / );
		expect( await ago.textContent() ).not.toMatch( ARABIC_INDIC_DIGITS );
	} );

	test( 'two new updates get the Arabic dual form', async ( {
		page,
		baseURL,
	} ) => {
		const requestUtils = await RequestUtils.setup( {
			baseURL,
			storageStatePath: path.join(
				process.env.WP_ARTIFACTS_PATH ?? 'artifacts',
				'storage-states/admin-ar.json'
			),
		} );
		const [ post ] = await requestUtils.rest< Post[] >( {
			path: '/wp/v2/posts',
			params: { slug: 'election-night', context: 'edit' },
		} );
		const original = post.content.raw;

		const now = Math.floor( Date.now() / 1000 );
		const opener = '<!-- wp:mantek/live-updates {"pollInterval":15} -->\n';
		const entry = ( timestamp: number, text: string ) =>
			[
				`<!-- wp:mantek/live-update {"timestamp":${ timestamp }} -->`,
				'<!-- wp:paragraph -->',
				`<p>${ text }</p>`,
				'<!-- /wp:paragraph -->',
				'<!-- /wp:mantek/live-update -->',
				'',
				'',
			].join( '\n' );
		await requestUtils.rest( {
			method: 'POST',
			path: `/wp/v2/posts/${ post.id }`,
			data: {
				content: original.replace(
					opener,
					opener +
						entry( now + 1, 'النتائج الرسمية.' ) +
						entry( now, 'إعلان الفائز.' )
				),
			},
		} );

		try {
			await expect(
				page.getByRole( 'button', { name: 'عرض تحديثين جديدين' } )
			).toBeVisible( { timeout: 60_000 } );
		} finally {
			await requestUtils.rest( {
				method: 'POST',
				path: `/wp/v2/posts/${ post.id }`,
				data: { content: original },
			} );
		}
	} );
} );
