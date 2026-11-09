/**
 * Editor UI for the Live updates block: a header, an "Add an update" button that puts the new
 * entry on top with the caret in it, the coverage settings, and the bookkeeping that keeps
 * every entry's time unique.
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	InspectorControls,
	store as blockEditorStore,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';
import {
	createBlock,
	getBlockContent,
	type Block,
	type BlockEditProps,
} from '@wordpress/blocks';
import {
	Button,
	PanelBody,
	RangeControl,
	ToggleControl,
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { useEffect, useRef } from '@wordpress/element';
import { plus } from '@wordpress/icons';

import { drawsOnRender, isBlank } from './content';
import './editor.scss';

export type Attributes = {
	isLive: boolean;
	pollInterval: number;
};

const ENTRY = 'mantek/live-update';

type Entry = {
	id: string;
	stamp: number;
	filled: boolean;
};

/**
 * Each block's answer, worked out once: the editor store keeps a block's object until the block
 * changes, so typing in one block leaves the others' answers standing.
 */
const answers = new WeakMap< Block, boolean >();

/**
 * Whether a block inside an entry gives it something readers will see on the site: a heading
 * with no text, an image or embed with nothing chosen, or a paragraph of spaces does not.
 *
 * @param block A block inside an entry.
 */
function givesContent( block: Block ): boolean {
	let answer = answers.get( block );
	if ( answer === undefined ) {
		answer =
			drawsOnRender( block ) ||
			! isBlank( getBlockContent( block ) ?? '' );
		answers.set( block, answer );
	}
	return answer;
}

/**
 * Reads back the entries from the string the editor store is summarised into.
 *
 * @param signature "clientId:timestamp:filled" for each entry, joined with commas.
 */
function parseEntries( signature: string ): Entry[] {
	return signature
		? signature.split( ',' ).map( ( part ) => {
				const [ id, stamp, filled ] = part.split( ':' );
				return {
					id,
					stamp: Number( stamp ) || 0,
					filled: filled === '1',
				};
			} )
		: [];
}

/**
 * Stamps each entry with the moment it gets its first content, and gives a duplicated or pasted
 * entry a time of its own. Readers' browsers find new updates by their time, and each entry's
 * anchor is named after it, so no two entries may share one.
 *
 * Only entries that appear while the post is open are re-stamped, so a time an editor sets on
 * purpose stays, and opening a post changes nothing that was saved. Each stamp joins the change
 * that caused it in the undo history, so undoing that change takes the stamp with it.
 *
 * @param signature The entries, as parseEntries() reads them.
 */
function useEntryTimes( signature: string ) {
	const known = useRef< Set< string > | null >( null );
	const {
		updateBlockAttributes,
		__unstableMarkNextChangeAsNotPersistent: markNextChangeAsNotPersistent,
	} = useDispatch( blockEditorStore );

	useEffect( () => {
		const entries = parseEntries( signature );
		const previous = known.current;
		known.current = new Set( entries.map( ( entry ) => entry.id ) );

		const uses = new Map< number, number >();
		for ( const { stamp } of entries ) {
			uses.set( stamp, ( uses.get( stamp ) ?? 0 ) + 1 );
		}
		let latest = entries.reduce(
			( max, { stamp } ) => Math.max( max, stamp ),
			0
		);

		for ( const entry of entries ) {
			const copied =
				previous !== null &&
				! previous.has( entry.id ) &&
				entry.stamp > 0 &&
				( uses.get( entry.stamp ) ?? 0 ) > 1;
			if ( ! copied && ( entry.stamp > 0 || ! entry.filled ) ) {
				continue;
			}
			if ( copied ) {
				uses.set( entry.stamp, ( uses.get( entry.stamp ) ?? 1 ) - 1 );
			}
			// Now, or one second after the newest entry, whichever is later: always unique.
			latest = Math.max( latest + 1, Math.floor( Date.now() / 1000 ) );
			markNextChangeAsNotPersistent();
			updateBlockAttributes( entry.id, { timestamp: latest } );
		}
	}, [ signature, markNextChangeAsNotPersistent, updateBlockAttributes ] );
}

export default function Edit( {
	attributes,
	setAttributes,
	clientId,
}: BlockEditProps< Attributes > ) {
	const { isLive, pollInterval } = attributes;

	// One string, so the block renders again only when an entry is added, removed, re-stamped
	// or gets its first content, not on every keystroke.
	const signature = useSelect(
		( select ) => {
			const { getBlockAttributes, getBlockOrder, getBlocks } =
				select( blockEditorStore );
			return getBlockOrder( clientId )
				.map( ( id ) =>
					[
						id,
						Number( getBlockAttributes( id )?.timestamp ) || 0,
						getBlocks( id ).some( givesContent ) ? 1 : 0,
					].join( ':' )
				)
				.join( ',' );
		},
		[ clientId ]
	);
	useEntryTimes( signature );
	const entries = parseEntries( signature );
	// An entry left empty is not published, so the count leaves it out, as the site does.
	const count = entries.filter( ( entry ) => entry.filled ).length;

	const { insertBlock, selectBlock } = useDispatch( blockEditorStore );

	const blockProps = useBlockProps( {
		className: isLive ? 'is-live' : 'is-ended',
	} );
	// No template: an entry exists only once an editor asks for one, so an empty live blog
	// stays empty and opening it changes nothing.
	const innerBlocksProps = useInnerBlocksProps(
		{ className: 'wp-block-mantek-live-updates__entries' },
		{
			allowedBlocks: [ ENTRY ],
			renderAppender: false,
		}
	);

	// Live blogs read newest first, so a new entry goes on top, with the caret already in it.
	const addUpdate = () => {
		const paragraph = createBlock( 'core/paragraph', {
			placeholder: __( 'What is the latest?', 'mantek-newsroom-blocks' ),
		} );
		insertBlock(
			createBlock( ENTRY, {}, [ paragraph ] ),
			0,
			clientId,
			false
		);
		selectBlock( paragraph.clientId );
	};

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Coverage', 'mantek-newsroom-blocks' ) }>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __(
							'Coverage is live',
							'mantek-newsroom-blocks'
						) }
						help={
							isLive
								? __(
										'Readers see a Live badge and are offered new updates without reloading.',
										'mantek-newsroom-blocks'
									)
								: __(
										'Readers see that coverage has ended, and the page stops checking for updates.',
										'mantek-newsroom-blocks'
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
							'mantek-newsroom-blocks'
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
							{ __( 'Live', 'mantek-newsroom-blocks' ) }
						</span>
					) : (
						<span className="wp-block-mantek-live-updates__ended">
							{ __( 'Coverage ended', 'mantek-newsroom-blocks' ) }
						</span>
					) }
					<span className="wp-block-mantek-live-updates__count">
						{ sprintf(
							/* translators: %s: number of updates in the live blog. */
							_n(
								'%s update',
								'%s updates',
								count,
								'mantek-newsroom-blocks'
							),
							// Western digits, as WordPress prints them, whatever the browser's language.
							String( count )
						) }
					</span>
					<Button
						className="wp-block-mantek-live-updates__add"
						variant="secondary"
						icon={ plus }
						onClick={ addUpdate }
					>
						{ entries.length === 0
							? __(
									'Add the first update',
									'mantek-newsroom-blocks'
								)
							: __( 'Add an update', 'mantek-newsroom-blocks' ) }
					</Button>
				</header>
				<div { ...innerBlocksProps } />
			</section>
		</>
	);
}
