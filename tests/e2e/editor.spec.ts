/**
 * The blocks in the post editor: valid markup, the controls, and what they save.
 */
import { expect, test } from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';

type EditorStore = { getPermalink: () => string };
type WordPressWindow = Window & {
	wp: { data: { select: ( store: string ) => EditorStore } };
};

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
		await expect( saved.locator( 'li' ) ).toHaveCount( 2 );
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

	test( 'Add an update puts the new, stamped entry on top', async ( {
		admin,
		editor,
	} ) => {
		await admin.createNewPost( { title: 'Live test' } );
		await editor.insertBlock( { name: 'mantek/live-updates' } );

		const container = editor.canvas.locator(
			'[data-type="mantek/live-updates"]'
		);
		const entries = container.locator( '[data-type="mantek/live-update"]' );
		await expect( entries ).toHaveCount( 1 );

		await container
			.getByRole( 'button', { name: 'Add an update' } )
			.click();
		await expect( entries ).toHaveCount( 2 );
		await expect( container.getByText( '2 updates' ) ).toBeVisible();

		const [ live ] = await editor.getBlocks();
		const stamps = live.innerBlocks.map(
			( entry ) => entry.attributes.timestamp as number
		);
		expect( stamps.every( ( stamp ) => stamp > 0 ) ).toBe( true );
		expect( stamps[ 0 ] ).toBeGreaterThanOrEqual( stamps[ 1 ] );
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
