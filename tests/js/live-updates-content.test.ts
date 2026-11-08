import { describe, expect, it } from 'vitest';

import { drawsOnRender, type BlockLike } from '../../src/live-updates/content';

/**
 * A block as the editor holds it, with only what drawsOnRender() reads.
 *
 * @param attributes  Its attributes.
 * @param innerBlocks The blocks inside it.
 */
const block = (
	attributes: Record< string, unknown > = {},
	innerBlocks: BlockLike[] = []
): BlockLike => ( { attributes, innerBlocks } );

describe( 'drawsOnRender', () => {
	it( 'is false for a block that saves its own content', () => {
		expect( drawsOnRender( block( { content: 'Polls close.' } ) ) ).toBe(
			false
		);
	} );

	it( 'is true for a block bound to a source such as a custom field', () => {
		const bound = block( {
			metadata: {
				bindings: {
					content: {
						source: 'core/post-meta',
						args: { key: 'turnout' },
					},
				},
			},
		} );

		expect( drawsOnRender( bound ) ).toBe( true );
	} );

	it( 'is false for metadata without bindings', () => {
		expect(
			drawsOnRender( block( { metadata: { name: 'Results' } } ) )
		).toBe( false );
		expect( drawsOnRender( block( { metadata: { bindings: {} } } ) ) ).toBe(
			false
		);
	} );

	it( 'is true for a gallery of the images attached to the post', () => {
		const gallery = block( {
			dynamicContent: { source: 'core/attached-media' },
		} );

		expect( drawsOnRender( gallery ) ).toBe( true );
	} );

	it( 'looks inside other blocks', () => {
		const quote = block( {}, [
			block( { content: 'Polls close.' } ),
			block( {
				metadata: {
					bindings: { content: { source: 'core/post-meta' } },
				},
			} ),
		] );

		expect( drawsOnRender( quote ) ).toBe( true );
		expect( drawsOnRender( block( {}, [ block() ] ) ) ).toBe( false );
	} );
} );
