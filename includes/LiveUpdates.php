<?php
/**
 * Server rendering and REST endpoint for the Live updates blocks.
 *
 * @package wp-newsroom-blocks
 */

declare( strict_types = 1 );

namespace ManTek\NewsroomBlocks;

use WP_Block;
use WP_Error;
use WP_Post;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * A live blog: the container renders the header and the "new updates" control,
 * each entry renders its own time, and readers poll a small cacheable endpoint.
 */
final class LiveUpdates {

	/**
	 * Interactivity API store namespace.
	 */
	public const STORE = 'mantek/live-updates';

	/**
	 * The container block.
	 */
	public const CONTAINER_BLOCK = 'mantek/live-updates';

	/**
	 * One timestamped update inside the container.
	 */
	public const ENTRY_BLOCK = 'mantek/live-update';

	/**
	 * REST namespace for the polling endpoint.
	 */
	public const REST_NAMESPACE = 'wp-newsroom-blocks/v1';

	/**
	 * The shortest polling interval, in seconds. The endpoint is cached for the same time.
	 */
	public const MIN_INTERVAL = 15;

	/**
	 * Numbers that cover every plural category CLDR defines (zero, one, two, few, many, other).
	 * The browser picks the sample in the same category as the real count, so Arabic gets all six forms.
	 */
	public const PLURAL_SAMPLES = array( 0, 1, 2, 3, 11, 100 );

	/**
	 * Object cache group for parsed summaries.
	 */
	private const CACHE_GROUP = 'wp-newsroom-blocks';

	/**
	 * Renders the container on the front end.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    The rendered entries.
	 * @param WP_Block|null        $block      Block instance, which carries the post ID and the parsed entries.
	 */
	public static function render( array $attributes, string $content, ?WP_Block $block = null ): string {
		$post_id  = isset( $block->context['postId'] ) ? (int) $block->context['postId'] : (int) get_the_ID();
		$entries  = $block instanceof WP_Block ? ( $block->parsed_block['innerBlocks'] ?? array() ) : array();
		$summary  = self::summarize( self::timestamps( $entries ), 0 );
		$is_live  = ! empty( $attributes['isLive'] ) && $post_id > 0;
		$interval = max( self::MIN_INTERVAL, (int) ( $attributes['pollInterval'] ?? 30 ) );

		self::add_state();

		$status = $is_live
			? sprintf( '<span class="wp-block-mantek-live-updates__badge">%s</span>', esc_html__( 'Live', 'wp-newsroom-blocks' ) )
			: sprintf( '<span class="wp-block-mantek-live-updates__ended">%s</span>', esc_html__( 'Coverage ended', 'wp-newsroom-blocks' ) );

		$count = sprintf(
			/* translators: %s: number of updates in the live blog. */
			_n( '%s update', '%s updates', $summary['count'], 'wp-newsroom-blocks' ),
			number_format_i18n( $summary['count'] )
		);

		$context = array(
			'endpoint' => rest_url( sprintf( '%s/live/%d', self::REST_NAMESPACE, $post_id ) ),
			'latest'   => $summary['latest'],
			'newCount' => 0,
			'isLive'   => $is_live,
			'interval' => $interval,
		);

		return sprintf(
			'<section %1$s aria-label="%2$s" data-wp-interactive="%3$s" data-wp-router-region="%4$s" %5$s data-wp-init="callbacks.start" data-wp-watch="callbacks.syncFromServer">'
				. '<header class="wp-block-mantek-live-updates__header">%6$s<span class="wp-block-mantek-live-updates__count">%7$s</span></header>'
				. '<div class="wp-block-mantek-live-updates__notice" aria-live="polite">'
				. '<button type="button" class="wp-block-mantek-live-updates__show" hidden data-wp-bind--hidden="!context.newCount" data-wp-on-async--click="actions.showNew" data-wp-text="state.newLabel"></button>'
				. '</div>'
				. '<div class="wp-block-mantek-live-updates__entries">%8$s</div>'
				. '</section>',
			get_block_wrapper_attributes( array( 'class' => $is_live ? 'is-live' : 'is-ended' ) ),
			esc_attr__( 'Live updates', 'wp-newsroom-blocks' ),
			esc_attr( self::STORE ),
			esc_attr( self::STORE . '/' . $post_id ),
			wp_interactivity_data_wp_context( $context ),
			$status,
			esc_html( $count ),
			$content
		);
	}

	/**
	 * Renders one entry: its time, a "how long ago" label that stays current, and its content.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    The rendered inner blocks.
	 */
	public static function render_entry( array $attributes, string $content ): string {
		$timestamp = max( 0, (int) ( $attributes['timestamp'] ?? 0 ) );
		$important = ! empty( $attributes['important'] );

		$meta = '';
		if ( $timestamp > 0 ) {
			$meta = sprintf(
				'<time class="wp-block-mantek-live-update__time" datetime="%1$s">%2$s</time><span class="wp-block-mantek-live-update__ago" data-wp-text="state.relativeTime"></span>',
				esc_attr( gmdate( 'c', $timestamp ) ),
				esc_html( self::format_time( $timestamp, time() ) )
			);
		}
		if ( $important ) {
			$meta .= sprintf( '<span class="wp-block-mantek-live-update__key">%s</span>', esc_html__( 'Key update', 'wp-newsroom-blocks' ) );
		}

		$extra = array();
		if ( $important ) {
			$extra['class'] = 'is-important';
		}
		if ( $timestamp > 0 ) {
			$extra['id'] = 'update-' . $timestamp;
		}

		return sprintf(
			'<article %1$s %2$s><header class="wp-block-mantek-live-update__meta">%3$s</header><div class="wp-block-mantek-live-update__content">%4$s</div></article>',
			get_block_wrapper_attributes( $extra ),
			wp_interactivity_data_wp_context( array( 'timestamp' => $timestamp ) ),
			$meta,
			$content
		);
	}

	/**
	 * Registers the polling endpoint.
	 */
	public static function register_routes(): void {
		register_rest_route(
			self::REST_NAMESPACE,
			'/live/(?P<id>\d+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( self::class, 'rest_summary' ),
				'permission_callback' => array( self::class, 'rest_can_read' ),
				'args'                => array(
					'id'    => array(
						'type'     => 'integer',
						'minimum'  => 1,
						'required' => true,
					),
					'after' => array(
						'type'    => 'integer',
						'minimum' => 0,
						'default' => 0,
					),
				),
			)
		);
	}

	/**
	 * Anyone may poll a post that anyone may read. Everything else looks like a missing post.
	 *
	 * @param WP_REST_Request<array<string, mixed>> $request The request.
	 */
	public static function rest_can_read( WP_REST_Request $request ): bool|WP_Error {
		$post = get_post( (int) $request['id'] );
		if ( ! $post instanceof WP_Post || ! is_post_publicly_viewable( $post ) || '' !== $post->post_password ) {
			return new WP_Error( 'rest_post_invalid_id', __( 'Invalid post ID.', 'wp-newsroom-blocks' ), array( 'status' => 404 ) );
		}

		return true;
	}

	/**
	 * How many entries the live blog has, the newest timestamp, and how many are newer than `after`.
	 *
	 * The response is public and cached for MIN_INTERVAL seconds, so a CDN absorbs the polling
	 * of a large audience, and the parse is cached until the post changes.
	 *
	 * @param WP_REST_Request<array<string, mixed>> $request The request.
	 */
	public static function rest_summary( WP_REST_Request $request ): WP_REST_Response {
		$post       = get_post( (int) $request['id'] );
		$timestamps = $post instanceof WP_Post ? self::post_timestamps( $post ) : array();

		$response = new WP_REST_Response( self::summarize( $timestamps, (int) $request['after'] ) );
		$response->header( 'Cache-Control', 'public, max-age=' . self::MIN_INTERVAL );

		return $response;
	}

	/**
	 * Entry timestamps of a post's live blog, from the object cache while the post is unchanged.
	 *
	 * @param WP_Post $post The post holding the live blog.
	 * @return list<int>
	 */
	public static function post_timestamps( WP_Post $post ): array {
		$key    = sprintf( 'live-%d-%s', $post->ID, md5( $post->post_modified_gmt ) );
		$cached = wp_cache_get( $key, self::CACHE_GROUP );
		if ( is_array( $cached ) ) {
			return array_values( array_map( 'intval', $cached ) );
		}

		$container  = self::find_container( parse_blocks( $post->post_content ) );
		$timestamps = self::timestamps( $container['innerBlocks'] ?? array() );
		wp_cache_set( $key, $timestamps, self::CACHE_GROUP, HOUR_IN_SECONDS );

		return $timestamps;
	}

	/**
	 * The first live blog in a tree of parsed blocks, at any depth (inside a group or columns, say).
	 *
	 * @param array<array-key, array<string, mixed>> $blocks Parsed blocks, as parse_blocks() returns them.
	 * @return array<string, mixed>|null
	 */
	public static function find_container( array $blocks ): ?array {
		foreach ( $blocks as $parsed ) {
			if ( self::CONTAINER_BLOCK === ( $parsed['blockName'] ?? null ) ) {
				return $parsed;
			}
			$found = self::find_container( is_array( $parsed['innerBlocks'] ?? null ) ? $parsed['innerBlocks'] : array() );
			if ( null !== $found ) {
				return $found;
			}
		}

		return null;
	}

	/**
	 * The timestamp of every entry, in document order. Entries not yet stamped count as 0.
	 *
	 * @param array<array-key, array<string, mixed>> $entries Parsed inner blocks of the container.
	 * @return list<int>
	 */
	public static function timestamps( array $entries ): array {
		$timestamps = array();
		foreach ( $entries as $parsed ) {
			if ( self::ENTRY_BLOCK === ( $parsed['blockName'] ?? null ) ) {
				$timestamps[] = max( 0, (int) ( $parsed['attrs']['timestamp'] ?? 0 ) );
			}
		}

		return $timestamps;
	}

	/**
	 * Counts entries, finds the newest, and counts those newer than a timestamp the reader already has.
	 *
	 * @param list<int> $timestamps Entry timestamps.
	 * @param int       $after      The newest timestamp the reader has seen, or 0 on first load.
	 * @return array{count: int, latest: int, newer: int}
	 */
	public static function summarize( array $timestamps, int $after ): array {
		$newer = 0;
		if ( $after > 0 ) {
			foreach ( $timestamps as $timestamp ) {
				if ( $timestamp > $after ) {
					++$newer;
				}
			}
		}

		return array(
			'count'  => count( $timestamps ),
			'latest' => array() === $timestamps ? 0 : max( $timestamps ),
			'newer'  => $newer,
		);
	}

	/**
	 * The entry's time in the site's format: just the time today, the date as well on earlier days.
	 *
	 * @param int $timestamp Entry time.
	 * @param int $now       Current time.
	 */
	public static function format_time( int $timestamp, int $now ): string {
		$time_format = (string) get_option( 'time_format' );
		if ( wp_date( 'Y-m-d', $timestamp ) === wp_date( 'Y-m-d', $now ) ) {
			return (string) wp_date( $time_format, $timestamp );
		}

		return (string) wp_date( (string) get_option( 'date_format' ) . ' ' . $time_format, $timestamp );
	}

	/**
	 * Shared store state: the clock, the "new updates" labels in every plural form,
	 * and the server-side value of each entry's "how long ago" label.
	 */
	private static function add_state(): void {
		// The %s stays in each label; the browser fills it with the real count.
		$labels = array();
		foreach ( self::PLURAL_SAMPLES as $sample ) {
			/* translators: %s: number of new updates waiting to be shown. */
			$labels[ (string) $sample ] = _n( 'Show %s new update', 'Show %s new updates', $sample, 'wp-newsroom-blocks' );
		}

		wp_interactivity_state(
			self::STORE,
			array(
				'now'          => time(),
				'labels'       => $labels,
				'relativeTime' => static function (): string {
					$context   = wp_interactivity_get_context();
					$timestamp = (int) ( $context['timestamp'] ?? 0 );
					if ( $timestamp <= 0 ) {
						return '';
					}

					/* translators: %s: how long ago an update was posted, such as "5 mins". */
					return sprintf( __( '%s ago', 'wp-newsroom-blocks' ), human_time_diff( $timestamp ) );
				},
			)
		);
	}
}
