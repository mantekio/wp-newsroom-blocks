/**
 * Breaking news bar: the newest headlines from a category, rendered on the server.
 */
import { registerBlockType, type BlockConfiguration } from '@wordpress/blocks';
import { megaphone } from '@wordpress/icons';

import metadata from './block.json';
import Edit, { type Attributes } from './edit';
import './style.scss';

registerBlockType< Attributes >(
	metadata as unknown as BlockConfiguration< Attributes >,
	{
		icon: megaphone,
		edit: Edit,
		save: () => null,
	}
);
