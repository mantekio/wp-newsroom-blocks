/// <reference types="node" />
/**
 * The blocks in the post editor: valid markup, the controls, and what they save,
 * as an administrator and as an author.
 */
import path from 'node:path';
import {
	RequestUtils,
	expect,
	test,
} from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';

type BlockEditorSelectors = {
	getBlocks: () => Array< { innerBlocks: Array< { clientId: string } > } >;
};
type WordPressWindow = Window & {
	wp: {
		data: {
			select: ( store: string ) => {
				getPermalink: () => string;
				isEditedPostDirty: () => boolean;
			} & BlockEditorSelectors;
			dispatch: ( store: string ) => {
				duplicateBlocks: ( clientIds: string[] ) => void;
			};
		};
	};
};

/**
 * A user with the author role, who may publish their own posts and edit nothing else.
 * Created on the local test site only.
 */
const AUTHOR = { username: 'newsroom-author', password: 'local-test-only' };
const AUTHOR_STATE = path.join(
	process.env.WP_ARTIFACTS_PATH ?? 'artifacts',
	'storage-states/author.json'
);

/**
 * The published post's address, read from the editor's own store.
 *
 * @param page The editor page, after publishing.
 */
function permalink( page: Page ): Promise< string > {
	return page.evaluate( () =>
		( window as unknown as WordPressWindow ).wp.data
			.select( 'core/editor' )
			.getPermalink()
	);
}

/**
 * The timestamps of the live blog's entries, in the order they are shown.
 *
 * @param editor           The editor fixture.
 * @param editor.getBlocks Reads the post's blocks.
 */
async function stamps( editor: {
	getBlocks: () => Promise<
		Array< {
			innerBlocks: Array< { attributes: Record< string, unknown > } >;
		} >
	>;
} ): Promise< number[] > {
	const [ live ] = await editor.getBlocks();
	return live.innerBlocks.map(
		( entry ) => entry.attributes.timestamp as number
	);
}

// Saved with the user, so the welcome guide never opens over the editor, rather than being
// closed once it has, which left a race that WordPress 6.8 sometimes lost.
test.beforeAll( async ( { requestUtils } ) => {
	await requestUtils.setPreferences( 'core/edit-post', {
		welcomeGuide: false,
	} );
} );

test.describe( 'In the editor', () => {
	test( 'the demo story opens with every block valid', async ( {
		admin,
		editor,
		requestUtils,
	} ) => {
		const [ post ] = await requestUtils.rest< Array< { id: number } > >( {
			path: '/wp/v2/posts',
			params: { slug: 'election-night' },
		} );
		await admin.editPost( post.id );

		await expect(
			editor.canvas.locator( '[data-type="mantek/timeline"]' )
		).toBeVisible();
		await expect(
			editor.canvas.locator( '.block-editor-warning' )
		).toHaveCount( 0 );
		const names = ( await editor.getBlocks() ).map(
			( block ) => block.name
		);
		expect( names ).toEqual(
			expect.arrayContaining( [
				'mantek/breaking-news',
				'mantek/read-also',
				'mantek/timeline',
				'mantek/live-updates',
			] )
		);
	} );

	test( 'a timeline saves and reloads without an invalid block', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost( { title: 'Timeline test' } );
		await editor.insertBlock( { name: 'mantek/timeline' } );

		const events = editor.canvas.locator(
			'[data-type="mantek/timeline-event"]'
		);
		await expect( events ).toHaveCount( 2 );
		await events
			.first()
			.locator( '.wp-block-mantek-timeline-event__time' )
			.click();
		await page.keyboard.type( '09:00' );
		await events
			.first()
			.locator( '.wp-block-mantek-timeline-event__heading' )
			.click();
		await page.keyboard.type( 'Doors open' );

		await editor.publishPost();
		const url = await permalink( page );
		await page.reload();

		await expect( editor.canvas.getByText( 'Doors open' ) ).toBeVisible();
		await expect(
			editor.canvas.locator( '.block-editor-warning' )
		).toHaveCount( 0 );

		await page.goto( url );
		const saved = page.locator( 'ol.wp-block-mantek-timeline' );
		// The second event was left empty, so the site shows only the first.
		await expect( saved.locator( 'li' ) ).toHaveCount( 2 );
		await expect( saved.locator( 'li:visible' ) ).toHaveCount( 1 );
		await expect(
			saved.locator( '.wp-block-mantek-timeline-event__heading' ).first()
		).toHaveText( 'Doors open' );
	} );

	test( 'Read also searches, adds and links an article', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		await requestUtils.createPost( {
			title: 'Background: the count',
			status: 'publish',
			date_gmt: new Date().toISOString(),
		} );
		await admin.createNewPost( { title: 'Read also test' } );
		await editor.insertBlock( { name: 'mantek/read-also' } );

		const block = editor.canvas.locator( '[data-type="mantek/read-also"]' );
		await block
			.getByRole( 'searchbox', { name: 'Search articles' } )
			.fill( 'Background' );
		await block
			.getByRole( 'button', { name: 'Background: the count' } )
			.click();
		await expect(
			block.locator( '.wp-block-mantek-read-also__title' )
		).toHaveText( 'Background: the count' );

		await editor.publishPost();
		const url = await permalink( page );
		await page.goto( url );

		await expect(
			page
				.getByRole( 'complementary', { name: 'Read also' } )
				.getByRole( 'link', { name: 'Background: the count' } )
		).toHaveAttribute( 'href', /background-the-count/ );
	} );

	test( 'a live blog starts empty, and each update goes on top with the caret in it', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost( { title: 'Live test' } );
		await editor.insertBlock( { name: 'mantek/live-updates' } );

		const container = editor.canvas.locator(
			'[data-type="mantek/live-updates"]'
		);
		const entries = container.locator( '[data-type="mantek/live-update"]' );
		// Nothing is added, or stamped, until an editor asks for it.
		await expect( entries ).toHaveCount( 0 );

		await container
			.getByRole( 'button', { name: 'Add the first update' } )
			.click();
		await page.keyboard.type( 'Polls close.' );
		// Straight away, with no click elsewhere first: the toolbar of the entry being
		// written must not cover the button.
		await container
			.getByRole( 'button', { name: 'Add an update' } )
			.click();
		await page.keyboard.type( 'Counting begins.' );

		await expect( entries ).toHaveCount( 2 );
		await expect( entries.first() ).toContainText( 'Counting begins.' );
		await expect( entries.last() ).toContainText( 'Polls close.' );
		await expect( container.getByText( '2 updates' ) ).toBeVisible();

		// Stamped once written, and never with the same time, even within one second.
		await expect
			.poll( () => stamps( editor ) )
			.toEqual( [ expect.any( Number ), expect.any( Number ) ] );
		const [ newer, older ] = await stamps( editor );
		expect( older ).toBeGreaterThan( 0 );
		expect( newer ).toBeGreaterThan( older );

		// An entry left empty is not published, so the count leaves it out, as the site does.
		await container
			.getByRole( 'button', { name: 'Add an update' } )
			.click();
		await expect( entries ).toHaveCount( 3 );
		await expect( container.getByText( '2 updates' ) ).toBeVisible();
	} );

	test( 'a duplicated update gets a time of its own', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost( { title: 'Duplicate test' } );
		await editor.insertBlock( { name: 'mantek/live-updates' } );
		const container = editor.canvas.locator(
			'[data-type="mantek/live-updates"]'
		);
		await container
			.getByRole( 'button', { name: 'Add the first update' } )
			.click();
		await page.keyboard.type( 'Polls close.' );
		await expect
			.poll( async () => ( await stamps( editor ) )[ 0 ] )
			.toBeGreaterThan( 0 );

		// What Duplicate in the block's options menu does.
		await page.evaluate( () => {
			const { data } = ( window as unknown as WordPressWindow ).wp;
			const [ live ] = data.select( 'core/block-editor' ).getBlocks();
			data.dispatch( 'core/block-editor' ).duplicateBlocks( [
				live.innerBlocks[ 0 ].clientId,
			] );
		} );

		await expect(
			container.locator( '[data-type="mantek/live-update"]' )
		).toHaveCount( 2 );
		await expect
			.poll( async () => new Set( await stamps( editor ) ).size )
			.toBe( 2 );
	} );

	test( 'opening an empty live blog changes nothing', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		const post = await requestUtils.createPost( {
			title: 'Empty live blog',
			status: 'draft',
			date_gmt: new Date().toISOString(),
			content: '<!-- wp:mantek/live-updates /-->',
		} );
		await admin.editPost( post.id );

		await expect(
			editor.canvas.getByRole( 'button', {
				name: 'Add the first update',
			} )
		).toBeVisible();
		// Long enough for any change the block would make by itself.
		await page.waitForTimeout( 1_000 );
		expect( await stamps( editor ) ).toEqual( [] );
		expect(
			await page.evaluate( () =>
				( window as unknown as WordPressWindow ).wp.data
					.select( 'core/editor' )
					.isEditedPostDirty()
			)
		).toBe( false );
	} );

	test( 'the breaking news preview shows the chosen category', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost( { title: 'Breaking test' } );
		await editor.insertBlock( { name: 'mantek/breaking-news' } );
		await editor.openDocumentSettingsSidebar();

		await page
			.getByRole( 'combobox', { name: 'Category' } )
			.selectOption( { label: 'Breaking' } );

		await expect(
			editor.canvas.locator( '.wp-block-mantek-breaking-news__item' )
		).toHaveCount( 3 );
	} );
} );

test.describe( 'In the editor, in another timezone than the site', () => {
	// Four hours ahead of the test site, which keeps WordPress's default of UTC.
	test.use( { timezoneId: 'Asia/Dubai' } );

	test( 'a date picked near midnight keeps its day in the label', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost( { title: 'Timezone test' } );
		await editor.insertBlock( { name: 'mantek/timeline' } );
		const event = editor.canvas
			.locator( '[data-type="mantek/timeline-event"]' )
			.first();
		await event
			.locator( '.wp-block-mantek-timeline-event__heading' )
			.click();
		await editor.clickBlockToolbarButton( 'Set the date' );

		const set = async ( name: string, value: string ) => {
			const field = page.getByRole( 'spinbutton', { name } );
			await field.fill( value );
			await field.press( 'Enter' );
		};
		await set( 'Day', '8' );
		await page
			.getByRole( 'combobox', { name: 'Month' } )
			.selectOption( '11' );
		await set( 'Year', '2026' );
		await set( 'Hours', '1' );
		await set( 'Minutes', '0' );
		// Present when the site's time format is 12-hour, as WordPress's default is.
		const am = page.getByRole( 'radio', { name: 'AM', exact: true } );
		if ( await am.count() ) {
			await am.click();
		}

		await expect
			.poll(
				async () =>
					( await editor.getBlocks() )[ 0 ].innerBlocks[ 0 ]
						.attributes.datetime
			)
			.toBe( '2026-11-08T01:00:00' );
		// Read in the browser's timezone, this was labelled November 7.
		await expect(
			event.locator( '.wp-block-mantek-timeline-event__time' )
		).toHaveText( 'November 8, 2026' );
	} );
} );

// Authors write most of a newsroom's stories, and WordPress shows them less than it shows
// administrators: only their own posts when asked for posts to edit, and no categories at all.
test.describe( 'In the editor, as an author', () => {
	test.use( { storageState: AUTHOR_STATE } );

	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllUsers();
		await requestUtils.createUser( {
			...AUTHOR,
			email: 'newsroom-author@example.com',
			roles: [ 'author' ],
		} );
		const author = await RequestUtils.setup( {
			user: AUTHOR,
			storageStatePath: AUTHOR_STATE,
		} );
		await author.setupRest();
		await author.setPreferences( 'core/edit-post', {
			welcomeGuide: false,
		} );
	} );

	test( 'Read also finds articles by other journalists', async ( {
		admin,
		editor,
	} ) => {
		await admin.createNewPost( { title: 'Author test' } );
		await editor.insertBlock( { name: 'mantek/read-also' } );

		const block = editor.canvas.locator( '[data-type="mantek/read-also"]' );
		// Typed key by key, as a person would.
		await block
			.getByRole( 'searchbox', { name: 'Search articles' } )
			.pressSequentially( 'vote count' );
		await block
			.getByRole( 'button', { name: 'How the vote count works' } )
			.click();
		await expect(
			block.locator( '.wp-block-mantek-read-also__title' )
		).toHaveText( 'How the vote count works' );
	} );

	test( 'the breaking news bar lists the categories and previews their headlines', async ( {
		admin,
		editor,
		page,
	} ) => {
		await admin.createNewPost( { title: 'Author bar test' } );
		await editor.insertBlock( { name: 'mantek/breaking-news' } );
		await editor.openDocumentSettingsSidebar();

		await page
			.getByRole( 'combobox', { name: 'Category' } )
			.selectOption( { label: 'Breaking' } );

		await expect(
			editor.canvas.locator( '.wp-block-mantek-breaking-news__item' )
		).toHaveCount( 3 );
	} );
} );
