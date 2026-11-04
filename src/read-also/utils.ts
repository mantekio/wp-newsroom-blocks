/**
 * Pure helpers for the list of chosen articles, kept apart from React so they are easy to test.
 */

/**
 * The most articles one block links to. The server enforces the same limit.
 */
export const MAX_POSTS = 5;

/**
 * Adds an article at the end, unless it is already there or the list is full.
 *
 * @param ids Current post IDs, in display order.
 * @param id  Post ID to add.
 * @param max Largest allowed list.
 */
export function addPost(
	ids: readonly number[],
	id: number,
	max: number = MAX_POSTS
): number[] {
	if ( id <= 0 || ids.includes( id ) || ids.length >= max ) {
		return [ ...ids ];
	}
	return [ ...ids, id ];
}

/**
 * Removes an article from the list.
 *
 * @param ids Current post IDs.
 * @param id  Post ID to remove.
 */
export function removePost( ids: readonly number[], id: number ): number[] {
	return ids.filter( ( value ) => value !== id );
}

/**
 * Moves the article at `index` one place up (-1) or down (1). Moves past either end are ignored.
 *
 * @param ids   Current post IDs.
 * @param index Position of the article to move.
 * @param delta Direction of the move.
 */
export function movePost(
	ids: readonly number[],
	index: number,
	delta: -1 | 1
): number[] {
	const target = index + delta;
	const next = [ ...ids ];
	if (
		index < 0 ||
		index >= ids.length ||
		target < 0 ||
		target >= ids.length
	) {
		return next;
	}
	[ next[ index ], next[ target ] ] = [ next[ target ], next[ index ] ];
	return next;
}
