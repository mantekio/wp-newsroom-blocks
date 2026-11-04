/**
 * Editor UI for the Live updates block: a header, an "Add an update" button that puts the
 * new entry on top, and the coverage settings.
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	InspectorControls,
	store as blockEditorStore,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';
import { createBlock, type BlockEditProps } from '@wordpress/blocks';
import {
	Button,
	PanelBody,
	RangeControl,
	ToggleControl,
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { plus } from '@wordpress/icons';

import './editor.scss';

export type Attributes = {
	isLive: boolean;
	pollInterval: number;
};

const ENTRY = 'mantek/live-update';

export default function Edit( {
	attributes,
	setAttributes,
	clientId,
}: BlockEditProps< Attributes > ) {
	const { isLive, pollInterval } = attributes;
	const count = useSelect(
		( select ) => select( blockEditorStore ).getBlockCount( clientId ),
		[ clientId ]
	);
	const { insertBlock } = useDispatch( blockEditorStore );

	const blockProps = useBlockProps( {
		className: isLive ? 'is-live' : 'is-ended',
	} );
	const innerBlocksProps = useInnerBlocksProps(
		{ className: 'wp-block-mantek-live-updates__entries' },
		{
			allowedBlocks: [ ENTRY ],
			template: [ [ ENTRY ] ],
			renderAppender: false,
		}
	);

	// Live blogs read newest first, so a new entry goes to the top.
	const addUpdate = () => insertBlock( createBlock( ENTRY ), 0, clientId );

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Coverage', 'wp-newsroom-blocks' ) }>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Coverage is live', 'wp-newsroom-blocks' ) }
						help={
							isLive
								? __(
										'Readers see a Live badge and are offered new updates without reloading.',
										'wp-newsroom-blocks'
									)
								: __(
										'Readers see that coverage has ended, and the page stops checking for updates.',
										'wp-newsroom-blocks'
									)
						}
						checked={ isLive }
						onChange={ ( value ) =>
							setAttributes( { isLive: value } )
						}
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __(
							'Check for new updates every (seconds)',
							'wp-newsroom-blocks'
						) }
						min={ 15 }
						max={ 300 }
						step={ 15 }
						value={ pollInterval }
						disabled={ ! isLive }
						onChange={ ( value ) =>
							setAttributes( { pollInterval: value ?? 30 } )
						}
					/>
				</PanelBody>
			</InspectorControls>

			<section { ...blockProps }>
				<header className="wp-block-mantek-live-updates__header">
					{ isLive ? (
						<span className="wp-block-mantek-live-updates__badge">
							{ __( 'Live', 'wp-newsroom-blocks' ) }
						</span>
					) : (
						<span className="wp-block-mantek-live-updates__ended">
							{ __( 'Coverage ended', 'wp-newsroom-blocks' ) }
						</span>
					) }
					<span className="wp-block-mantek-live-updates__count">
						{ sprintf(
							/* translators: %s: number of updates in the live blog. */
							_n(
								'%s update',
								'%s updates',
								count,
								'wp-newsroom-blocks'
							),
							count.toLocaleString()
						) }
					</span>
				</header>
				<Button
					className="wp-block-mantek-live-updates__add"
					variant="secondary"
					icon={ plus }
					onClick={ addUpdate }
				>
					{ __( 'Add an update', 'wp-newsroom-blocks' ) }
				</Button>
				<div { ...innerBlocksProps } />
			</section>
		</>
	);
}
