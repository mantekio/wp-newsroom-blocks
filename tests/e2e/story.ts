/**
 * Opens the demo story, and fails at once if WordPress rendered something else.
 *
 * Without working rewrite rules WordPress serves the blog index for any address,
 * and the index shows the story's full content too, so block assertions would
 * still pass while testing the wrong page.
 */
import { expect, type Page } from '@playwright/test';

export async function openStory( page: Page ): Promise< void > {
	await page.goto( '/election-night/' );
	await expect( page.locator( 'body' ) ).toHaveClass( /\bsingle-post\b/ );
}

/**
 * Which way the breaking news headlines are moving, measured from where the track really is,
 * so the test holds however the direction is implemented.
 *
 * @param page A page showing the demo story.
 */
export async function scrollDirection(
	page: Page
): Promise< 'left' | 'right' | 'still' > {
	const shift = await page
		.locator( '.wp-block-mantek-breaking-news__track' )
		.first()
		.evaluate( async ( track ) => {
			await new Promise( ( resolve ) => setTimeout( resolve, 600 ) );
			return new DOMMatrixReadOnly( getComputedStyle( track ).transform )
				.m41;
		} );
	if ( shift < 0 ) {
		return 'left';
	}
	return shift > 0 ? 'right' : 'still';
}
