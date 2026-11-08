/**
 * Whether an entry in a live blog has anything for readers to see, worked out in the editor as the
 * site works it out, so that the editor stamps and counts exactly the entries the site shows.
 *
 * The site judges what an entry's blocks render, in LiveUpdates::is_blank(). The editor has only
 * what they save, so it applies the same test to that, with the one difference WordPress makes when
 * it renders them: an Image block without a file renders nothing at all.
 */

/**
 * The characters is_blank() ignores: spaces, no-break spaces, and the invisible direction and
 * joining marks. They are listed out because PHP's \s also matches U+0085 and U+180E, which
 * JavaScript's does not.
 */
const INVISIBLE =
	/[\t-\r \u0085\u00A0\u1680\u180E\u2000-\u200F\u2028\u2029\u202F\u205F\u2060\u3000\uFEFF]/g;

/**
 * What a reader sees without any text, as is_blank() lists it, except that an image needs a file.
 */
const MEDIA =
	'img[src]:not([src=""]), picture, video, audio, iframe, embed, object, svg, canvas';

let parser: HTMLTemplateElement | undefined;

/**
 * Whether saved HTML will show a reader nothing once the site renders it.
 *
 * @param html A block's saved HTML.
 */
export function isBlank( html: string ): boolean {
	// A template's content is parsed but inert: no script runs and no image loads.
	parser ??= document.createElement( 'template' );
	parser.innerHTML = html;
	const { content } = parser;
	if ( content.querySelector( MEDIA ) ) {
		return false;
	}
	// The text, its entities decoded, without scripts or styles, as wp_strip_all_tags() leaves it.
	content
		.querySelectorAll( 'script, style' )
		.forEach( ( element ) => element.remove() );
	return ( content.textContent ?? '' ).replace( INVISIBLE, '' ) === '';
}

export type BlockLike = {
	attributes: Record< string, unknown >;
	innerBlocks: BlockLike[];
};

/**
 * Whether a block, or one inside it, gets its content only when the site renders it: one bound to
 * a custom field, say, or a gallery of the images attached to the post. What it saves cannot tell
 * whether it will show anything, so it counts as content. A count one too high is the lesser fault:
 * an entry never stamped would never be offered to readers.
 *
 * @param block A block inside an entry.
 */
export function drawsOnRender( block: BlockLike ): boolean {
	const { metadata, dynamicContent } = block.attributes as {
		metadata?: { bindings?: Record< string, unknown > };
		dynamicContent?: unknown;
	};

	return (
		Object.keys( metadata?.bindings ?? {} ).length > 0 ||
		Boolean( dynamicContent ) ||
		block.innerBlocks.some( drawsOnRender )
	);
}
