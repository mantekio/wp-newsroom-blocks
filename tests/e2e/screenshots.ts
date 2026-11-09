/// <reference types="node" />
/**
 * The screenshots in docs/, taken from the demo story on the two Playground sites, so they can be
 * taken again whenever the blocks change: `npm run screenshots`. Not part of the test suite. The
 * animation also needs ffmpeg; without it, only the still images are taken.
 *
 * The WordPress.org screenshots in .wordpress-org/ come from the same story. To take only those:
 * `npm run screenshots -- --grep WordPress.org`.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
	Admin,
	Editor,
	expect,
	PageUtils,
	RequestUtils,
	test,
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
		i18n: { __: ( text: string ) => string };
	};
};

const DOCS = path.join( __dirname, '../../docs' );
const WPORG = path.join( __dirname, '../../.wordpress-org' );
const EN = 'http://127.0.0.1:9400';
const AR = 'http://127.0.0.1:9401';
const LIVE_BLOG = '<!-- wp:mantek/live-updates {"pollInterval":15} -->\n';

/**
 * The two demo sites, with the words the screenshots look for on each: the live blog's heading,
 * the button offering two new updates, and the live blog's setting in the editor. `updates` are
 * the two updates published while a reader watches, the newer first and marked as a key update.
 * `dateFormat` is the one a site installed in that language starts with, where the demo site's
 * differs: the Arabic site was installed in English and then switched, so it kept "F j, Y".
 */
type Language = {
	code: 'en' | 'ar';
	baseURL: string;
	live: RegExp;
	show: string;
	coverage: string;
	updates: [ string, string ];
	dateFormat?: string;
};

const LANGUAGES: Language[] = [
	{
		code: 'en',
		baseURL: EN,
		live: /^Live$/,
		show: 'Show 2 new updates',
		coverage: 'Coverage is live',
		updates: [
			'The independent candidate takes the lead as districts two and three report.',
			'Turnout reached 61 per cent, the commission confirms.',
		],
	},
	{
		code: 'ar',
		baseURL: AR,
		live: /^مباشر$/,
		show: 'عرض تحديثين جديدين',
		coverage: 'التغطية مستمرة',
		updates: [
			'المرشح المستقل يتصدّر مع ورود نتائج الدائرتين الثانية والثالثة.',
			'اللجنة تؤكد أن المشاركة بلغت 61 في المئة.',
		],
		// Core's Arabic translation of "F j, Y".
		dateFormat: 'j F، Y',
	},
];

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
 * @param file  The image's name in docs/, or a full path.
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
		path: path.resolve( DOCS, file ),
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
 * Publishes two new updates to the demo story, the newer a key update.
 *
 * @param requestUtils REST access to the site.
 * @param updates      What the two updates say, the newer first.
 * @return Puts the story back as it was.
 */
async function publishTwoUpdates(
	requestUtils: RequestUtils,
	updates: [ string, string ] = LANGUAGES[ 0 ].updates
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
					entry( now, updates[ 0 ], true ) +
					entry( now - 1, updates[ 1 ] )
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

type EditorShot = {
	page: Page;
	admin: Admin;
	editor: Editor;
	postId: number;
	file: string;
	heading: RegExp;
	coverage: string;
};

/**
 * Saves the live blog in the editor, selected, with its settings beside it.
 *
 * @param shot          What to take.
 * @param shot.page     The page.
 * @param shot.admin    Admin helpers for that page.
 * @param shot.editor   Editor helpers for that page.
 * @param shot.postId   The demo story.
 * @param shot.file     The image's name in docs/, or a full path.
 * @param shot.heading  The live blog's heading.
 * @param shot.coverage The live blog's setting, which the settings must show.
 */
async function shootEditor( {
	page,
	admin,
	editor,
	postId,
	file,
	heading,
	coverage,
}: EditorShot ) {
	await page.setViewportSize( { width: 1280, height: 860 } );
	await admin.editPost( postId );

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
		// Core's own labels, in the editor's language.
		const [ settingsLabel, advancedLabel ] = await page.evaluate( () => {
			const { __ } = ( window as unknown as WordPressWindow ).wp.i18n;
			return [ __( 'Editor settings' ), __( 'Advanced' ) ];
		} );
		const settings = page.getByRole( 'region', { name: settingsLabel } );
		await expect( settings ).toContainText( coverage );

		// The live blog under its heading, at the top of the canvas. The blocks above are hidden
		// where they stand: when the post ends too soon to scroll the heading right up, the end
		// of the block above would show as a cut-off line under the toolbar.
		await editor.canvas
			.locator( 'h2.wp-block-heading', { hasText: heading } )
			.evaluate( ( element ) => {
				for (
					let above = element.previousElementSibling;
					above;
					above = above.previousElementSibling
				) {
					( above as HTMLElement ).style.visibility = 'hidden';
				}
				element.scrollIntoView( { block: 'start' } );
			} );
		await page.waitForTimeout( 300 );

		// From under the admin bar, which stays in full screen on newer WordPress, down to the
		// end of the live blog or of the settings, whichever is lower.
		const bar = await page.locator( '#wpadminbar' ).boundingBox();
		const top = bar && bar.height > 0 ? bar.y + bar.height : 0;
		const ends = await Promise.all(
			[
				live,
				settings.getByRole( 'button', { name: advancedLabel } ),
			].map( async ( part ) => {
				const box = await part.boundingBox();
				return box ? box.y + box.height : 0;
			} )
		);
		const bottom = Math.min( 860, Math.max( ...ends ) + 32 );
		await page.screenshot( {
			path: path.resolve( DOCS, file ),
			animations: 'disabled',
			clip: { x: 0, y: top, width: 1280, height: bottom - top },
		} );
	} finally {
		await fullscreen( false );
	}
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
		const [ post ] = await requestUtils.rest< Post[] >( {
			path: '/wp/v2/posts',
			params: { slug: 'election-night' },
		} );
		await shootEditor( {
			page,
			admin,
			editor,
			postId: post.id,
			file: 'editor.png',
			heading: LANGUAGES[ 0 ].live,
			coverage: LANGUAGES[ 0 ].coverage,
		} );
	} );
} );

/**
 * The WordPress.org directory's screenshots, numbered to match the captions in readme.txt. Each has
 * an Arabic twin, `screenshot-N-ar.png`, which the directory shows Arabic visitors instead. Their
 * first is the Arabic story and their second the English one, so for every visitor the second
 * shows the same story in the other reading direction.
 */
test.describe( 'WordPress.org screenshots', () => {
	const file = ( n: number, code: string ) =>
		path.join(
			WPORG,
			`screenshot-${ n }${ code === 'en' ? '' : `-${ code }` }.png`
		);
	const storage = ( language: Language ) =>
		path.join(
			process.env.WP_ARTIFACTS_PATH ?? 'artifacts',
			`storage-states/admin${
				language.code === 'en' ? '' : `-${ language.code }`
			}.json`
		);
	const rest = ( language: Language ) =>
		RequestUtils.setup( {
			baseURL: language.baseURL,
			storageStatePath: storage( language ),
		} );

	test( 'the story, in each reading direction', async ( { browser } ) => {
		for ( const language of LANGUAGES ) {
			const context = await browser.newContext( {
				baseURL: language.baseURL,
				locale: language.code,
				deviceScaleFactor: 2,
				viewport: { width: 1000, height: 2200 },
				storageState: { cookies: [], origins: [] },
			} );
			const page = await context.newPage();
			await openStory( page );
			const block = ( name: string ) =>
				page.locator( `.wp-block-mantek-${ name }` );

			// The English story is first for English visitors and second for Arabic ones; the
			// Arabic story the other way round.
			const own = language.code === 'en' ? 1 : 2;
			await shoot( page, file( own, 'en' ), [
				page.locator( 'h1' ).first(),
				block( 'breaking-news' ),
				block( 'live-updates' ),
			] );
			fs.copyFileSync( file( own, 'en' ), file( 3 - own, 'ar' ) );
			await context.close();
		}
	} );

	test( 'two new updates, offered and then shown', async ( { browser } ) => {
		for ( const language of LANGUAGES ) {
			const requestUtils = await rest( language );
			const context = await browser.newContext( {
				baseURL: language.baseURL,
				locale: language.code,
				deviceScaleFactor: 2,
				viewport: { width: 760, height: 560 },
				storageState: { cookies: [], origins: [] },
			} );
			const page = await context.newPage();
			await installTimers( page );
			await openStory( page );

			// The live blog fills the frame, under its heading, as in the animation. The blocks
			// above are hidden where they stand, or the end of the timeline shows at the top edge.
			const frame = () =>
				page
					.locator( 'h2.wp-block-heading', {
						hasText: language.live,
					} )
					.evaluate( async ( heading ) => {
						for (
							let above = heading.previousElementSibling;
							above;
							above = above.previousElementSibling
						) {
							( above as HTMLElement ).style.visibility =
								'hidden';
						}
						heading.scrollIntoView( { block: 'start' } );
						window.scrollBy( 0, -24 );
						await document.fonts.ready;
					} );
			await frame();
			await page.waitForTimeout( 1_000 );

			const restore = await publishTwoUpdates(
				requestUtils,
				language.updates
			);
			try {
				await page.waitForTimeout( 600 );
				await tick( page );
				const live = page.locator( '.wp-block-mantek-live-updates' );
				const show = live.getByRole( 'button', {
					name: language.show,
				} );
				await expect( show ).toBeVisible();
				await page.screenshot( {
					path: file( 3, language.code ),
					animations: 'disabled',
				} );

				await show.click();
				await expect( live.locator( 'article' ) ).toHaveCount( 5 );
				// Keyboard focus moves to the first new update, and the theme rings whatever has
				// focus; the screenshot shows the updates themselves.
				await live.evaluate( ( block ) =>
					(
						block.ownerDocument.activeElement as HTMLElement | null
					 )?.blur()
				);
				await frame();
				await page.waitForTimeout( 300 );
				await page.screenshot( {
					path: file( 4, language.code ),
					animations: 'disabled',
				} );
			} finally {
				await restore();
				await context.close();
			}
		}
	} );

	test( 'the live blog in the editor', async ( { browser, browserName } ) => {
		for ( const language of LANGUAGES ) {
			const requestUtils = await rest( language );
			const [ post ] = await requestUtils.rest< Post[] >( {
				path: '/wp/v2/posts',
				params: { slug: 'election-night' },
			} );
			const context = await browser.newContext( {
				baseURL: language.baseURL,
				locale: language.code,
				deviceScaleFactor: 2,
				storageState: storage( language ),
			} );
			const page = await context.newPage();
			const pageUtils = new PageUtils( { page, browserName } );
			const editor = new Editor( { page } );
			const admin = new Admin( { page, pageUtils, editor } );
			const { date_format: dateFormat } = await requestUtils.rest< {
				date_format: string;
			} >( { path: '/wp/v2/settings' } );
			const setDateFormat = ( value: string ) =>
				requestUtils.rest( {
					method: 'POST',
					path: '/wp/v2/settings',
					data: { date_format: value },
				} );
			if ( language.dateFormat ) {
				await setDateFormat( language.dateFormat );
			}
			try {
				await shootEditor( {
					page,
					admin,
					editor,
					postId: post.id,
					file: file( 5, language.code ),
					heading: language.live,
					coverage: language.coverage,
				} );
			} finally {
				if ( language.dateFormat ) {
					await setDateFormat( dateFormat );
				}
				await context.close();
			}
		}
	} );
} );
