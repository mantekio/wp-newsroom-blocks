/**
 * Scroll timing for the breaking news bar, kept apart from the store so it is easy to test.
 */

/**
 * Seconds one loop takes at a given speed, never so fast that it cannot be read.
 *
 * @param width Width of one copy of the headlines, in pixels.
 * @param speed Pixels per second.
 */
export function scrollDuration( width: number, speed: number ): number {
	return Math.max( 8, Math.round( width / Math.max( 1, speed ) ) );
}
