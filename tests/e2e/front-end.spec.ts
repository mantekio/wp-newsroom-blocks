/**
 * What readers get on the English demo story, as a logged-out visitor.
 */
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { openStory, scrollDirection } from './story';

type Post = { id: number; content: { raw: string } };

test.describe( 'On the front end', () => {
	test.use( { storageState: { cookies: [], origins: [] } } );

	test( 'the breaking news bar can be paused and closed', async ( {
		page,
	} ) => {
		await openStory( page );
		const bar = page.getByRole( 'region', { name: 'Breaking' } );
		const pause = bar.getByRole( 'button', {
			name: 'Pause the headlines',
		} );

		// Hidden in the server render, shown once the store is ready.
		await expect( pause ).toBeVisible();
		await expect( pause ).toHaveAttribute( 'aria-pressed', 'false' );
		await pause.click();
		await expect( pause ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect( bar ).toHaveClass( /is-paused/ );

		await bar
			.getByRole( 'button', { name: 'Close the breaking news bar' } )
			.click();
		await expect( bar ).toBeHidden();
	} );

	test( 'the bar scrolls left in English, timed to its width', async ( {
		page,
	} ) => {
		await openStory( page );
		const bar = page.locator( '.wp-block-mantek-breaking-news' );

		await expect
			.poll( () =>
				bar.evaluate( ( el ) =>
					getComputedStyle( el ).getPropertyValue(
						'--mantek-breaking-duration'
					)
				)
			)
			.toMatch( /^\d+s$/ );
		expect( await scrollDirection( page ) ).toBe( 'left' );
	} );

	test( 'how-long-ago labels keep counting in the browser', async ( {
		page,
	} ) => {
		// Playwright's page.clock replaces the Performance API, which WordPress's
		// Interactivity runtime reads as it starts, so it would never hydrate. This
		// shifts only Date.now() and lets the test fire the page's intervals itself.
		await page.addInitScript( () => {
			const realNow = Date.now.bind( Date );
			const realSetInterval = window.setInterval.bind( window );
			const clock = { offset: 0, intervals: [] as Array< () => void > };
			Object.assign( window, { testClock: clock } );
			Date.now = () => realNow() + clock.offset;
			window.setInterval = ( ( handler: TimerHandler, ms?: number ) => {
				if ( typeof handler === 'function' ) {
					clock.intervals.push( () => handler() );
				}
				return realSetInterval( handler, ms );
			} ) as typeof window.setInterval;
		} );
		await openStory( page );
		const ago = page.locator( '.wp-block-mantek-live-update__ago' ).first();

		await expect( ago ).toHaveText( /^\d+ minutes? ago$/ );
		const before = parseInt( ( await ago.textContent() ) ?? '', 10 );

		await page.evaluate( () => {
			const { testClock } = window as unknown as {
				testClock: { offset: number; intervals: Array< () => void > };
			};
			testClock.offset = 10 * 60 * 1000;
			testClock.intervals.forEach( ( tick ) => tick() );
		} );
		await expect( ago ).toHaveText(
			new RegExp( `^(${ before + 10 }|${ before + 11 }) minutes ago$` )
		);
	} );

	test( 'new updates are offered, then shown without a page reload', async ( {
		page,
		requestUtils,
	} ) => {
		const [ post ] = await requestUtils.rest< Post[] >( {
			path: '/wp/v2/posts',
			params: { slug: 'election-night', context: 'edit' },
		} );
		const original = post.content.raw;

		await openStory( page );
		const live = page.getByRole( 'region', { name: 'Live updates' } );
		const entries = live.locator( 'article' );
		const before = await entries.count();
		await page.evaluate( () => {
			( window as Window & { sameDocument?: boolean } ).sameDocument =
				true;
		} );

		// A newer entry is published while the reader has the page open.
		const opener = '<!-- wp:mantek/live-updates {"pollInterval":15} -->\n';
		const entry = [
			`<!-- wp:mantek/live-update {"timestamp":${ Math.floor(
				Date.now() / 1000
			) }} -->`,
			'<!-- wp:paragraph -->',
			'<p>Results are in.</p>',
			'<!-- /wp:paragraph -->',
			'<!-- /wp:mantek/live-update -->',
			'',
			'',
		].join( '\n' );
		await requestUtils.rest( {
			method: 'POST',
			path: `/wp/v2/posts/${ post.id }`,
			data: { content: original.replace( opener, opener + entry ) },
		} );

		try {
			const show = live.getByRole( 'button', {
				name: 'Show 1 new update',
			} );
			await expect( show ).toBeVisible( { timeout: 60_000 } );
			await show.click();

			await expect( entries ).toHaveCount( before + 1 );
			await expect( entries.first() ).toContainText( 'Results are in.' );
			await expect( show ).toBeHidden();
			expect(
				await page.evaluate(
					() =>
						( window as Window & { sameDocument?: boolean } )
							.sameDocument
				)
			).toBe( true );
		} finally {
			await requestUtils.rest( {
				method: 'POST',
				path: `/wp/v2/posts/${ post.id }`,
				data: { content: original },
			} );
		}
	} );

	test.describe( 'with reduced motion', () => {
		test.use( { contextOptions: { reducedMotion: 'reduce' } } );

		test( 'the bar stands still and drops the pause button', async ( {
			page,
		} ) => {
			await openStory( page );
			const bar = page.locator( '.wp-block-mantek-breaking-news' );

			await expect(
				bar.locator( '.wp-block-mantek-breaking-news__track' ).first()
			).toHaveCSS( 'animation-name', 'none' );
			await expect(
				bar.getByRole( 'button', { name: 'Pause the headlines' } )
			).toBeHidden();
		} );
	} );
} );
