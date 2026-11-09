/// <reference types="node" />
/**
 * The screenshots in docs/, taken from the demo story on the two Playground sites, so they can be
 * taken again whenever the blocks change: `npm run screenshots`. Not part of the test suite. The
 * animation also needs ffmpeg; without it, only the still images are taken.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
	expect,
	test,
	type RequestUtils,
} from '@wordpress/e2e-test-utils-playwright';
import type { Locator, Page } from '@playwright/test';

import { installTimers, openStory, tick } from './story';

type Post = { id: number; content: { raw: string } };
type WordPressWindow = Window & {
	wp: {
		data: {
			dispatch: ( store: string ) => {
				set: ( scope: string, name: string, value: unknown ) => void;
			};
		};
	};
};

const DOCS = path.join( __dirname, '../../docs' );
const EN = 'http://127.0.0.1:9400';
const AR = 'http://127.0.0.1:9401';
const LIVE_BLOG = '<!-- wp:mantek/live-updates {"pollInterval":15} -->\n';

// Twice the pixels, so the images stay sharp on high-density screens; tall enough for the whole story.
test.use( {
	deviceScaleFactor: 2,
	viewport: { width: 1000, height: 2200 },
} );

/**
 * Saves the part of the page that holds these elements, with room around them. Animations are
 * stopped, so the headlines of the breaking news bar start at its label.
 *
 * @param page  The page.
 * @param file  The image's name in docs/.
 * @param parts The elements to show.
 * @param alone Whether to hide the blocks around the first one, so none of their text reaches the edges.
 */
async function shoot(
	page: Page,
	file: string,
	parts: Locator[],
	alone = false
) {
	await page.evaluate( async () => {
		window.scrollTo( 0, 0 );
		await document.fonts.ready;
	} );
	// Hidden where they stand, so nothing moves.
	const neighbours = ( visibility: string ) =>
		parts[ 0 ].evaluate( ( block, value ) => {
			for ( const sibling of block.parentElement?.children ?? [] ) {
				if ( sibling !== block ) {
					( sibling as HTMLElement ).style.visibility = value;
				}
			}
		}, visibility );
	if ( alone ) {
		await neighbours( 'hidden' );
	}

	const boxes = await Promise.all(
		parts.map( async ( part ) => {
			const box = await part.boundingBox();
			if ( ! box ) {
				throw new Error( `Nothing to show for ${ file }.` );
			}
			return box;
		} )
	);
	const pad = 24;
	const left = Math.max(
		0,
		Math.min( ...boxes.map( ( box ) => box.x ) ) - pad
	);
	const top = Math.max(
		0,
		Math.min( ...boxes.map( ( box ) => box.y ) ) - pad
	);
	const right =
		Math.max( ...boxes.map( ( box ) => box.x + box.width ) ) + pad;
	const bottom =
		Math.max( ...boxes.map( ( box ) => box.y + box.height ) ) + pad;
	await page.screenshot( {
		path: path.join( DOCS, file ),
		animations: 'disabled',
		clip: { x: left, y: top, width: right - left, height: bottom - top },
	} );

	if ( alone ) {
		await neighbours( '' );
	}
}

/**
 * One live update, as the editor saves it.
 *
 * @param timestamp When it was posted.
 * @param text      What it says.
 * @param important Whether it is a key update.
 */
function entry( timestamp: number, text: string, important = false ): string {
	const attributes = important
		? `{"timestamp":${ timestamp },"important":true}`
		: `{"timestamp":${ timestamp }}`;
	return [
		`<!-- wp:mantek/live-update ${ attributes } -->`,
		'<!-- wp:paragraph -->',
		`<p>${ text }</p>`,
		'<!-- /wp:paragraph -->',
		'<!-- /wp:mantek/live-update -->',
		'',
		'',
	].join( '\n' );
}

/**
 * Publishes two new updates to the English demo story, the newer a key update.
 *
 * @param requestUtils REST access to the English site.
 * @return Puts the story back as it was.
 */
async function publishTwoUpdates(
	requestUtils: RequestUtils
): Promise< () => Promise< unknown > > {
	const [ post ] = await requestUtils.rest< Post[] >( {
		path: '/wp/v2/posts',
		params: { slug: 'election-night', context: 'edit' },
	} );
	const original = post.content.raw;
	const now = Math.floor( Date.now() / 1000 );
	await requestUtils.rest( {
		method: 'POST',
		path: `/wp/v2/posts/${ post.id }`,
		data: {
			content: original.replace(
				LIVE_BLOG,
				LIVE_BLOG +
					entry(
						now,
						'The independent candidate takes the lead as districts two and three report.',
						true
					) +
					entry(
						now - 1,
						'Turnout reached 61 per cent, the commission confirms.'
					)
			),
		},
	} );

	return () =>
		requestUtils.rest( {
			method: 'POST',
			path: `/wp/v2/posts/${ post.id }`,
			data: { content: original },
		} );
}

test.describe( 'Screenshots', () => {
	test( 'the demo story, block by block, in English', async ( { page } ) => {
		await page.context().clearCookies();
		await openStory( page );
		const block = ( name: string ) =>
			page.locator( `.wp-block-mantek-${ name }` );

		// From the headline down to the live blog, as wide as the column of text.
		await shoot( page, 'screenshot-en.png', [
			page.locator( 'h1' ).first(),
			block( 'breaking-news' ),
			block( 'live-updates' ),
		] );
		await shoot(
			page,
			'breaking-news.png',
			[ block( 'breaking-news' ) ],
			true
		);
		await shoot( page, 'read-also.png', [ block( 'read-also' ) ], true );
		await shoot( page, 'timeline.png', [ block( 'timeline' ) ], true );
	} );

	test( 'the demo story in Arabic', async ( { browser } ) => {
		const context = await browser.newContext( {
			baseURL: AR,
			locale: 'ar',
			deviceScaleFactor: 2,
			viewport: { width: 1000, height: 2200 },
			storageState: { cookies: [], origins: [] },
		} );
		const page = await context.newPage();
		await openStory( page );
		const block = ( name: string ) =>
			page.locator( `.wp-block-mantek-${ name }` );

		await shoot( page, 'screenshot-ar.png', [
			page.locator( 'h1' ).first(),
			block( 'breaking-news' ),
			block( 'live-updates' ),
		] );
		await shoot(
			page,
			'breaking-news-ar.png',
			[ block( 'breaking-news' ) ],
			true
		);
		await context.close();
	} );

	test( 'new updates arriving and brought in, as an animation', async ( {
		browser,
		requestUtils,
	} ) => {
		try {
			execFileSync( 'ffmpeg', [ '-version' ], { stdio: 'ignore' } );
		} catch {
			test.skip( true, 'The animation needs ffmpeg.' );
		}

		const size = { width: 760, height: 560 };
		const context = await browser.newContext( {
			baseURL: EN,
			viewport: size,
			recordVideo: { dir: test.info().outputPath( 'video' ), size },
			storageState: { cookies: [], origins: [] },
		} );
		const page = await context.newPage();
		const started = Date.now();
		await installTimers( page );
		await openStory( page );

		// The live blog fills the frame, under its heading.
		await page
			.locator( 'h2.wp-block-heading', { hasText: /^Live$/ } )
			.evaluate( async ( heading ) => {
				heading.scrollIntoView( { block: 'start' } );
				window.scrollBy( 0, -24 );
				await document.fonts.ready;
			} );
		await page.waitForTimeout( 1_000 );

		const from = Date.now();
		const restore = await publishTwoUpdates( requestUtils );
		try {
			await page.waitForTimeout( 600 );
			await tick( page );
			const live = page.locator( '.wp-block-mantek-live-updates' );
			const show = live.getByRole( 'button', {
				name: 'Show 2 new updates',
			} );
			await expect( show ).toBeVisible();
			await page.waitForTimeout( 1_600 );
			await show.hover();
			await page.waitForTimeout( 500 );
			await show.click();
			await expect( live.locator( 'article' ) ).toHaveCount( 5 );
			await page.waitForTimeout( 2_800 );
		} finally {
			await restore();
		}
		const to = Date.now();

		const video = page.video();
		await context.close();
		const recording = await video?.path();
		if ( ! recording ) {
			throw new Error( 'Nothing was recorded.' );
		}
		// One palette for the whole clip, and only the changed part of each frame stored, so it stays small.
		execFileSync( 'ffmpeg', [
			'-y',
			'-loglevel',
			'error',
			'-ss',
			String( ( from - started ) / 1000 ),
			'-t',
			String( ( to - from ) / 1000 ),
			'-i',
			recording,
			'-vf',
			'fps=12,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
			'-loop',
			'0',
			path.join( DOCS, 'live-updates.gif' ),
		] );
	} );

	test( 'the live blog in the editor', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		await page.setViewportSize( { width: 1280, height: 860 } );
		const [ post ] = await requestUtils.rest< Post[] >( {
			path: '/wp/v2/posts',
			params: { slug: 'election-night' },
		} );
		await admin.editPost( post.id );

		// Full screen, without the admin menu, as the editor opens for most people; put back afterwards.
		const fullscreen = ( on: boolean ) =>
			page.evaluate(
				( value ) =>
					( window as unknown as WordPressWindow ).wp.data
						.dispatch( 'core/preferences' )
						.set( 'core/edit-post', 'fullscreenMode', value ),
				on
			);
		await fullscreen( true );
		try {
			const live = editor.canvas.locator(
				'[data-type="mantek/live-updates"]'
			);
			await editor.selectBlocks( live );
			const settings = page.getByRole( 'region', {
				name: 'Editor settings',
			} );
			await expect( settings ).toContainText( 'Coverage is live' );

			// The live blog under its heading, at the top of the canvas.
			await editor.canvas
				.locator( 'h2.wp-block-heading', { hasText: /^Live$/ } )
				.evaluate( ( heading ) =>
					heading.scrollIntoView( { block: 'start' } )
				);
			await page.waitForTimeout( 300 );

			// From under the admin bar, which stays in full screen on newer WordPress, down to the
			// end of the live blog or of the settings, whichever is lower.
			const bar = await page.locator( '#wpadminbar' ).boundingBox();
			const top = bar && bar.height > 0 ? bar.y + bar.height : 0;
			const ends = await Promise.all(
				[
					live,
					settings.getByRole( 'button', { name: 'Advanced' } ),
				].map( async ( part ) => {
					const box = await part.boundingBox();
					return box ? box.y + box.height : 0;
				} )
			);
			const bottom = Math.min( 860, Math.max( ...ends ) + 32 );
			await page.screenshot( {
				path: path.join( DOCS, 'editor.png' ),
				animations: 'disabled',
				clip: { x: 0, y: top, width: 1280, height: bottom - top },
			} );
		} finally {
			await fullscreen( false );
		}
	} );
} );
