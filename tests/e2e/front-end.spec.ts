/**
 * What readers get on the English demo story, as a logged-out visitor.
 */
import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import { elapsed } from '../../src/live-updates/format';
import { installTimers, openStory, scrollDirection, tick } from './story';

type Post = { id: number; content: { raw: string } };

const LIVE_BLOG = '<!-- wp:mantek/live-updates {"pollInterval":15} -->\n';

/**
 * The English "how long ago" label for an age, rounded as the plugin rounds it.
 *
 * @param seconds Seconds since the update.
 */
function englishLabel( seconds: number ): string {
	const [ unit, value ] = elapsed( seconds );
	return unit === 'now'
		? 'just now'
		: `${ value } ${ unit }${ value === 1 ? '' : 's' } ago`;
}

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

		const close = bar.getByRole( 'button', {
			name: 'Close the breaking news bar',
		} );
		await close.focus();
		await page.keyboard.press( 'Enter' );
		await expect( bar ).toBeHidden();
		// The button went with the bar, so focus moves on to what follows it, Read also's
		// first link, rather than dropping back to the top of the page.
		await expect(
			page
				.getByRole( 'complementary', { name: 'Read also' } )
				.getByRole( 'link', { name: 'How the vote count works' } )
		).toBeFocused();
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

	test( 'a single headline that fits holds still', async ( {
		page,
		requestUtils,
	} ) => {
		const category = await requestUtils.rest< { id: number } >( {
			method: 'POST',
			path: '/wp/v2/categories',
			data: { name: `Solo ${ Date.now() }` },
		} );
		await requestUtils.rest( {
			method: 'POST',
			path: '/wp/v2/posts',
			data: {
				title: 'One',
				status: 'publish',
				categories: [ category.id ],
			},
		} );
		const post = await requestUtils.createPost( {
			title: 'Still bar test',
			status: 'publish',
			date_gmt: new Date().toISOString(),
			content: `<!-- wp:mantek/breaking-news {"categoryId":${ category.id }} /-->`,
		} );

		await page.goto( post.link );
		const bar = page.locator( '.wp-block-mantek-breaking-news' );

		await expect( bar ).toHaveClass( /\bis-still\b/ );
		await expect(
			bar.locator( '.wp-block-mantek-breaking-news__track' ).first()
		).toHaveCSS( 'animation-name', 'none' );
		// No copy beside it, and nothing to pause; it can still be closed.
		await expect(
			bar.locator( '.wp-block-mantek-breaking-news__track[aria-hidden]' )
		).toBeHidden();
		await expect(
			bar.locator( '.wp-block-mantek-breaking-news__pause' )
		).toBeHidden();
		await expect(
			bar.getByRole( 'button', { name: 'Close the breaking news bar' } )
		).toBeVisible();
	} );

	test( 'a link colour set on the bar reaches its headlines', async ( {
		page,
		requestUtils,
	} ) => {
		const [ breaking ] = await requestUtils.rest< Array< { id: number } > >(
			{ path: '/wp/v2/categories', params: { slug: 'breaking' } }
		);
		const post = await requestUtils.createPost( {
			title: 'Link colour test',
			status: 'publish',
			date_gmt: new Date().toISOString(),
			content: `<!-- wp:mantek/breaking-news {"categoryId":${ breaking.id },"maxAgeHours":48,"style":{"elements":{"link":{"color":{"text":"#00ff00"}}}}} /-->`,
		} );

		await page.goto( post.link );
		await expect(
			page.locator( '.wp-block-mantek-breaking-news__item a' ).first()
		).toHaveCSS( 'color', 'rgb(0, 255, 0)' );

		// Without one, the headlines take the bar's own text colour.
		await openStory( page );
		await expect(
			page.locator( '.wp-block-mantek-breaking-news__item a' ).first()
		).toHaveCSS( 'color', 'rgb(255, 255, 255)' );
	} );

	test( 'how-long-ago labels keep counting in the browser', async ( {
		page,
	} ) => {
		await installTimers( page );
		await openStory( page );
		const ago = page.locator( '.wp-block-mantek-live-update__ago' ).first();

		await expect( ago ).toHaveText( /^\d+ minutes? ago$/ );
		const before = parseInt( ( await ago.textContent() ) ?? '', 10 );

		await tick( page, 10 );
		await expect( ago ).toHaveText(
			new RegExp( `^(${ before + 10 }|${ before + 11 }) minutes ago$` )
		);
	} );

	test( 'new updates are offered, then shown without a reload, past a page cache', async ( {
		page,
		requestUtils,
	} ) => {
		const [ post ] = await requestUtils.rest< Post[] >( {
			path: '/wp/v2/posts',
			params: { slug: 'election-night', context: 'edit' },
		} );
		const original = post.content.raw;

		// A page cache in front of WordPress: the story's address keeps answering with the
		// copy the reader first got, as a CDN or a host's cache does until the copy expires.
		let cached: string | undefined;
		await page.route(
			( url ) => url.pathname === '/election-night/' && ! url.search,
			async ( route ) => {
				if ( cached === undefined ) {
					const response = await route.fetch();
					cached = await response.text();
					await route.fulfill( { response, body: cached } );
					return;
				}
				await route.fulfill( {
					status: 200,
					contentType: 'text/html; charset=UTF-8',
					headers: { 'cache-control': 'public, max-age=300' },
					body: cached,
				} );
			}
		);

		await openStory( page );
		const live = page.getByRole( 'region', { name: 'Live updates' } );
		const entries = live.locator( 'article' );
		const before = await entries.count();
		await page.evaluate( () => {
			( window as Window & { sameDocument?: boolean } ).sameDocument =
				true;
		} );

		// A newer entry is published while the reader has the page open.
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
			data: { content: original.replace( LIVE_BLOG, LIVE_BLOG + entry ) },
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
			// The button that was used has gone, so focus is on the new update.
			await expect( entries.first() ).toBeFocused();
			expect(
				await page.evaluate(
					() =>
						( window as Window & { sameDocument?: boolean } )
							.sameDocument
				)
			).toBe( true );

			// Each label counts from its own entry's time, not from the entry that sat in its
			// place before the swap. The page's clock moves every 30 seconds, so a label may be
			// up to that far behind the real age.
			const rows = await entries.evaluateAll( ( articles ) =>
				articles.map( ( article ) => ( {
					datetime:
						article
							.querySelector( 'time' )
							?.getAttribute( 'datetime' ) ?? '',
					label:
						article.querySelector(
							'.wp-block-mantek-live-update__ago'
						)?.textContent ?? '',
				} ) )
			);
			const now = Date.now() / 1000;
			for ( const { datetime, label } of rows ) {
				const age = Math.round( now - Date.parse( datetime ) / 1000 );
				const expected = new Set< string >();
				for ( let lag = -2; lag <= 35; lag++ ) {
					expected.add( englishLabel( age - lag ) );
				}
				expect(
					[ ...expected ],
					`the label of ${ datetime }`
				).toContain( label );
			}
		} finally {
			await requestUtils.rest( {
				method: 'POST',
				path: `/wp/v2/posts/${ post.id }`,
				data: { content: original },
			} );
		}
	} );

	test( 'an update waiting for its photo is offered only once the photo is in', async ( {
		page,
		requestUtils,
	} ) => {
		const [ post ] = await requestUtils.rest< Post[] >( {
			path: '/wp/v2/posts',
			params: { slug: 'election-night', context: 'edit' },
		} );
		const original = post.content.raw;

		// Routed requests skip the browser's cache, so every check reaches WordPress.
		const endpoint = ( url: URL ) =>
			url.href.includes( '/mantek-newsroom-blocks/v1/live/' );
		await page.route( endpoint, ( route ) => route.continue() );
		await installTimers( page );
		await openStory( page );
		const live = page.getByRole( 'region', { name: 'Live updates' } );
		const entries = live.locator( 'article' );
		const before = await entries.count();

		// What the endpoint tells the next check. Only a check made from now on counts: one the page
		// started on its own, before the latest change, would answer for the content before it.
		const check = async () => {
			const since = Date.now();
			const response = page.waitForResponse(
				( answer ) =>
					endpoint( new URL( answer.url() ) ) &&
					answer.request().timing().startTime >= since
			);
			await tick( page );
			return ( await ( await response ).json() ) as { newer: number };
		};
		// The same update both times, with the time it was given when it was added.
		const timestamp = Math.floor( Date.now() / 1000 );
		const publish = ( image: string ) =>
			requestUtils.rest( {
				method: 'POST',
				path: `/wp/v2/posts/${ post.id }`,
				data: {
					content: original.replace(
						LIVE_BLOG,
						LIVE_BLOG +
							[
								`<!-- wp:mantek/live-update {"timestamp":${ timestamp }} -->`,
								'<!-- wp:image -->',
								image,
								'<!-- /wp:image -->',
								'<!-- /wp:mantek/live-update -->',
								'',
								'',
							].join( '\n' )
					),
				},
			} );

		try {
			// Published before its file was chosen, so the page would show nothing new: nothing is offered.
			await publish(
				'<figure class="wp-block-image"><img alt=""/></figure>'
			);
			expect( ( await check() ).newer ).toBe( 0 );
			await expect(
				live.getByRole( 'button', { name: /^Show / } )
			).toBeHidden();

			// The file is chosen: now the update is offered, and brings the photo in.
			await publish(
				'<figure class="wp-block-image"><img src="/wp-includes/images/w-logo-blue.png" alt="The count"/></figure>'
			);
			expect( ( await check() ).newer ).toBe( 1 );
			const show = live.getByRole( 'button', {
				name: 'Show 1 new update',
			} );
			await expect( show ).toBeVisible();
			await show.click();

			await expect( entries ).toHaveCount( before + 1 );
			await expect( entries.first().locator( 'img' ) ).toHaveAttribute(
				'alt',
				'The count'
			);
			await expect(
				live.locator( '.wp-block-mantek-live-updates__count' )
			).toHaveText( `${ before + 1 } updates` );
		} finally {
			await requestUtils.rest( {
				method: 'POST',
				path: `/wp/v2/posts/${ post.id }`,
				data: { content: original },
			} );
		}
	} );

	test( 'ending coverage reaches pages already open, and stops their checking', async ( {
		page,
		requestUtils,
	} ) => {
		const [ post ] = await requestUtils.rest< Post[] >( {
			path: '/wp/v2/posts',
			params: { slug: 'election-night', context: 'edit' },
		} );
		const original = post.content.raw;

		// Routed requests skip the browser's cache, so every check reaches WordPress.
		let checks = 0;
		await page.route(
			( url ) => url.href.includes( '/mantek-newsroom-blocks/v1/live/' ),
			async ( route ) => {
				checks += 1;
				await route.continue();
			}
		);
		await installTimers( page );
		await openStory( page );
		const live = page.getByRole( 'region', { name: 'Live updates' } );
		await expect( live.getByText( 'Live', { exact: true } ) ).toBeVisible();

		await requestUtils.rest( {
			method: 'POST',
			path: `/wp/v2/posts/${ post.id }`,
			data: {
				content: original.replace(
					LIVE_BLOG,
					'<!-- wp:mantek/live-updates {"isLive":false,"pollInterval":15} -->\n'
				),
			},
		} );

		try {
			// The next check learns that coverage has ended, and the page says so.
			await tick( page );
			await expect( live.getByText( 'Coverage ended' ) ).toBeVisible();
			await expect(
				live.getByText( 'Live', { exact: true } )
			).toBeHidden();
			await expect( live ).toHaveClass( /\bis-ended\b/ );

			// And it checks no more.
			const made = checks;
			await tick( page );
			await page.waitForTimeout( 1_000 );
			expect( checks ).toBe( made );
		} finally {
			await requestUtils.rest( {
				method: 'POST',
				path: `/wp/v2/posts/${ post.id }`,
				data: { content: original },
			} );
		}
	} );

	test( 'the block templates print nothing when requested directly', async ( {
		request,
	} ) => {
		for ( const block of [
			'breaking-news',
			'live-update',
			'live-updates',
			'read-also',
		] ) {
			const response = await request.get(
				`/wp-content/plugins/mantek-newsroom-blocks/build/${ block }/render.php`
			);
			expect( await response.text(), block ).toBe( '' );
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
