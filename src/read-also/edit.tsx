/**
 * Editor UI for the Read also block: search published articles, pick up to five, and order them.
 */
import { __, sprintf } from '@wordpress/i18n';
import {
	InspectorControls,
	RichText,
	useBlockProps,
} from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import {
	Button,
	PanelBody,
	SearchControl,
	Spinner,
	ToggleControl,
} from '@wordpress/components';
import { useDebounce } from '@wordpress/compose';
import { store as coreStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { useState } from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';
import { chevronDown, chevronUp, closeSmall } from '@wordpress/icons';

import { MAX_POSTS, addPost, movePost, removePost } from './utils';
import './editor.scss';

export type Attributes = {
	postIds: number[];
	heading: string;
	showThumbnails: boolean;
};

type PostRecord = {
	id: number;
	title: { rendered: string };
};

type Props = BlockEditProps< Attributes > & {
	context: { postId?: number };
};

const FIELDS = 'id,title';

/**
 * The title as text, with a fallback for untitled posts.
 *
 * @param post A post from the REST API.
 */
function titleOf( post: PostRecord ): string {
	return (
		decodeEntities( post.title.rendered ) ||
		__( '(no title)', 'wp-newsroom-blocks' )
	);
}

export default function Edit( {
	attributes,
	setAttributes,
	isSelected,
	context,
}: Props ) {
	const { postIds, heading, showThumbnails } = attributes;
	const [ search, setSearch ] = useState( '' );
	const [ query, setQuery ] = useState( '' );
	const updateQuery = useDebounce( setQuery, 300 );

	const { chosen, chosenLoaded } = useSelect(
		( select ) => {
			if ( postIds.length === 0 ) {
				return { chosen: [] as PostRecord[], chosenLoaded: true };
			}
			const chosenQuery = {
				include: postIds,
				per_page: postIds.length,
				_fields: FIELDS,
			};
			return {
				chosen: ( select( coreStore ).getEntityRecords(
					'postType',
					'post',
					chosenQuery
				) ?? [] ) as PostRecord[],
				chosenLoaded: select( coreStore ).hasFinishedResolution(
					'getEntityRecords',
					[ 'postType', 'post', chosenQuery ]
				),
			};
		},
		[ postIds ]
	);

	const { results, searching } = useSelect(
		( select ) => {
			if ( query.trim().length < 2 ) {
				return { results: [] as PostRecord[], searching: false };
			}
			const searchQuery = {
				search: query.trim(),
				per_page: 8,
				_fields: FIELDS,
			};
			return {
				results: ( select( coreStore ).getEntityRecords(
					'postType',
					'post',
					searchQuery
				) ?? [] ) as PostRecord[],
				searching: ! select( coreStore ).hasFinishedResolution(
					'getEntityRecords',
					[ 'postType', 'post', searchQuery ]
				),
			};
		},
		[ query ]
	);

	const byId = new Map( chosen.map( ( post ) => [ post.id, post ] ) );
	const candidates = results.filter(
		( post ) => post.id !== context.postId && ! postIds.includes( post.id )
	);
	const isFull = postIds.length >= MAX_POSTS;
	const blockProps = useBlockProps();

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Settings', 'wp-newsroom-blocks' ) }>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __(
							'Show featured images',
							'wp-newsroom-blocks'
						) }
						checked={ showThumbnails }
						onChange={ ( value ) =>
							setAttributes( { showThumbnails: value } )
						}
					/>
				</PanelBody>
			</InspectorControls>

			<aside { ...blockProps }>
				<RichText
					tagName="p"
					className="wp-block-mantek-read-also__heading"
					value={ heading }
					onChange={ ( value: string ) =>
						setAttributes( { heading: value } )
					}
					placeholder={ __( 'Read also', 'wp-newsroom-blocks' ) }
					allowedFormats={ [] }
					disableLineBreaks
				/>

				{ postIds.length === 0 ? (
					<p className="wp-block-mantek-read-also__hint">
						{ __(
							'Search below to add up to five related articles.',
							'wp-newsroom-blocks'
						) }
					</p>
				) : (
					<ul className="wp-block-mantek-read-also__list">
						{ postIds.map( ( id, index ) => {
							const post = byId.get( id );
							let title = '…';
							if ( post ) {
								title = titleOf( post );
							} else if ( chosenLoaded ) {
								title = __(
									'Unavailable: no longer published',
									'wp-newsroom-blocks'
								);
							}
							return (
								<li
									key={ id }
									className="wp-block-mantek-read-also__item"
								>
									<span className="wp-block-mantek-read-also__title">
										{ title }
									</span>
									{ isSelected && (
										<span className="wp-block-mantek-read-also__actions">
											<Button
												size="small"
												icon={ chevronUp }
												label={ __(
													'Move up',
													'wp-newsroom-blocks'
												) }
												disabled={ index === 0 }
												accessibleWhenDisabled
												onClick={ () =>
													setAttributes( {
														postIds: movePost(
															postIds,
															index,
															-1
														),
													} )
												}
											/>
											<Button
												size="small"
												icon={ chevronDown }
												label={ __(
													'Move down',
													'wp-newsroom-blocks'
												) }
												disabled={
													index === postIds.length - 1
												}
												accessibleWhenDisabled
												onClick={ () =>
													setAttributes( {
														postIds: movePost(
															postIds,
															index,
															1
														),
													} )
												}
											/>
											<Button
												size="small"
												icon={ closeSmall }
												label={ __(
													'Remove',
													'wp-newsroom-blocks'
												) }
												onClick={ () =>
													setAttributes( {
														postIds: removePost(
															postIds,
															id
														),
													} )
												}
											/>
										</span>
									) }
								</li>
							);
						} ) }
					</ul>
				) }

				{ isSelected && ! isFull && (
					<div className="wp-block-mantek-read-also__picker">
						<SearchControl
							__nextHasNoMarginBottom
							label={ __(
								'Search articles',
								'wp-newsroom-blocks'
							) }
							value={ search }
							onChange={ ( value: string ) => {
								setSearch( value );
								updateQuery( value );
							} }
						/>
						{ searching && <Spinner /> }
						{ ! searching &&
							query.trim().length >= 2 &&
							candidates.length === 0 && (
								<p className="wp-block-mantek-read-also__hint">
									{ __(
										'No published articles match that search.',
										'wp-newsroom-blocks'
									) }
								</p>
							) }
						{ candidates.length > 0 && (
							<ul className="wp-block-mantek-read-also__results">
								{ candidates.map( ( post ) => (
									<li key={ post.id }>
										<Button
											variant="link"
											onClick={ () =>
												setAttributes( {
													postIds: addPost(
														postIds,
														post.id
													),
												} )
											}
										>
											{ titleOf( post ) }
										</Button>
									</li>
								) ) }
							</ul>
						) }
					</div>
				) }

				{ isSelected && isFull && (
					<p className="wp-block-mantek-read-also__hint">
						{ sprintf(
							/* translators: %d: the most articles one block can link to. */
							__(
								'That is the maximum of %d articles. Remove one to add another.',
								'wp-newsroom-blocks'
							),
							MAX_POSTS
						) }
					</p>
				) }
			</aside>
		</>
	);
}
