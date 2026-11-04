/**
 * Read also: a short list of related articles, chosen in the editor and rendered on the server.
 */
import { registerBlockType, type BlockConfiguration } from '@wordpress/blocks';
import { postList } from '@wordpress/icons';

import metadata from './block.json';
import Edit, { type Attributes } from './edit';
import './style.scss';

registerBlockType< Attributes >(
	metadata as unknown as BlockConfiguration< Attributes >,
	{
		icon: postList,
		edit: Edit,
		save: () => null,
	}
);
