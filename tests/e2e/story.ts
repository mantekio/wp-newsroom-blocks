/**
 * Helpers shared by the front-end tests: opening the demo story, measuring the ticker, and
 * driving the page's timers.
 */
import { expect, type Page } from '@playwright/test';

/**
 * Opens the demo story, and fails at once if WordPress rendered something else.
 *
 * Without working rewrite rules WordPress serves the blog index for any address,
 * and the index shows the story's full content too, so block assertions would
 * still pass while testing the wrong page.
 *
 * @param page The page to open it in.
 */
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

type TestClock = {
	offset: number;
	intervals: Map< number, () => void >;
};

/**
 * Lets a test move the page's clock and fire its intervals, for the page about to be opened.
 *
 * Playwright's page.clock replaces the Performance API, which WordPress's Interactivity
 * runtime reads as it starts, so it would never hydrate. This shifts only Date.now() and
 * keeps track of the intervals still running, which tick() fires.
 *
 * @param page The page, before it opens the story.
 */
export async function installTimers( page: Page ): Promise< void > {
	await page.addInitScript( () => {
		const realNow = Date.now.bind( Date );
		const realSetInterval = window.setInterval.bind( window );
		const realClearInterval = window.clearInterval.bind( window );
		const clock: TestClock = { offset: 0, intervals: new Map() };
		Object.assign( window, { testClock: clock } );
		Date.now = () => realNow() + clock.offset;
		window.setInterval = ( (
			handler: TimerHandler,
			ms?: number,
			...args: unknown[]
		) => {
			const id = realSetInterval( handler, ms, ...args );
			if ( typeof handler === 'function' ) {
				clock.intervals.set( id, () => handler( ...args ) );
			}
			return id;
		} ) as typeof window.setInterval;
		window.clearInterval = ( ( id?: number ) => {
			if ( id !== undefined ) {
				clock.intervals.delete( id );
			}
			realClearInterval( id );
		} ) as typeof window.clearInterval;
	} );
}

/**
 * Moves the page's clock forward, then fires every interval that is still running.
 *
 * @param page    A page opened after installTimers().
 * @param minutes How far to move the clock.
 */
export async function tick( page: Page, minutes = 0 ): Promise< void > {
	await page.evaluate( ( ms ) => {
		const { testClock } = window as unknown as { testClock: TestClock };
		testClock.offset += ms;
		testClock.intervals.forEach( ( fire ) => fire() );
	}, minutes * 60_000 );
}
