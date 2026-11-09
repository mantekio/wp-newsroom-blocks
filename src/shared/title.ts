/**
 * Post titles from the REST API as plain text, for the editor's lists and previews.
 */
import { __ } from '@wordpress/i18n';
import { decodeEntities } from '@wordpress/html-entities';

/**
 * Drops the tags from a fragment of HTML, such as a rendered post title. Entities are left as they are.
 *
 * @param html A fragment of HTML.
 */
export function stripTags( html: string ): string {
	return html.replace( /<[^>]*>/g, '' );
}

/**
 * A rendered title as text: tags dropped, entities decoded, and "(no title)" for an untitled post.
 *
 * @param rendered The title as the REST API renders it, which can contain markup such as <em>.
 */
export function titleText( rendered: string ): string {
	return (
		decodeEntities( stripTags( rendered ) ).trim() ||
		__( '(no title)', 'mantek-newsroom-blocks' )
	);
}
