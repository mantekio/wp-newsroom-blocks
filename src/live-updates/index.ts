/**
 * Live updates: a live blog whose entries are saved as blocks and rendered on the server.
 */
import { registerBlockType, type BlockConfiguration } from '@wordpress/blocks';
import { InnerBlocks } from '@wordpress/block-editor';
import { createElement } from '@wordpress/element';
import { update } from '@wordpress/icons';

import metadata from './block.json';
import Edit, { type Attributes } from './edit';
import './style.scss';

registerBlockType< Attributes >(
	metadata as unknown as BlockConfiguration< Attributes >,
	{
		icon: update,
		edit: Edit,
		// Only the entries are saved; the server renders the header and the controls.
		save: () => createElement( InnerBlocks.Content ),
	}
);
