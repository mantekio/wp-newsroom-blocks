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
	 * Object cache group for parsed live blogs.
	 */
	private const CACHE_GROUP = 'wp-newsroom-blocks';

	/**
	 * Anchors given to the entries of the live blog being rendered, so two entries with the same time still get distinct ones.
	 *
	 * @var array<string, int>
	 */
	private static array $anchors = array();

	/**
	 * Entries without a time in the live blog being rendered, counted so each still gets a key of its own.
	 */
	private static int $untimed = 0;

	/**
	 * Renders the container on the front end.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    The rendered entries.
	 * @param WP_Block|null        $block      Block instance, which carries the post ID and the parsed entries.
	 */
	public static function render( array $attributes, string $content, ?WP_Block $block = null ): string {
		// The entries render before their container, so the next live blog on the page starts afresh.
		self::$anchors = array();
		self::$untimed = 0;

		$post_id  = isset( $block->context['postId'] ) ? (int) $block->context['postId'] : (int) get_the_ID();
		$entries  = $block instanceof WP_Block ? ( $block->parsed_block['innerBlocks'] ?? array() ) : array();
		$summary  = self::summarize( self::timestamps( $entries ), 0 );
		$is_live  = ! empty( $attributes['isLive'] ) && $post_id > 0;
		$interval = max( self::MIN_INTERVAL, (int) ( $attributes['pollInterval'] ?? 30 ) );

		self::add_state();

		$count = sprintf(
			/* translators: %s: number of updates in the live blog. */
			_n( '%s update', '%s updates', $summary['count'], 'wp-newsroom-blocks' ),
			number_format_i18n( $summary['count'] )
		);

		$context = array(
			'endpoint' => rest_url( sprintf( '%s/live/%d', self::REST_NAMESPACE, $post_id ) ),
			'latest'   => $summary['latest'],
			'newest'   => $summary['latest'],
			'newCount' => 0,
			'isLive'   => $is_live,
			'interval' => $interval,
		);

		// Both states are in the markup, so a reader whose page is already open sees coverage end without reloading.
		return sprintf(
			'<section %1$s aria-label="%2$s" data-wp-interactive="%3$s" data-wp-router-region="%4$s" %5$s data-wp-class--is-live="context.isLive" data-wp-class--is-ended="!context.isLive" data-wp-init="callbacks.startClock" data-wp-watch---poll="callbacks.poll" data-wp-watch---sync="callbacks.syncFromServer">'
				. '<header class="wp-block-mantek-live-updates__header">'
				. '<span class="wp-block-mantek-live-updates__badge"%6$s data-wp-bind--hidden="!context.isLive">%7$s</span>'
				. '<span class="wp-block-mantek-live-updates__ended"%8$s data-wp-bind--hidden="context.isLive">%9$s</span>'
				. '<span class="wp-block-mantek-live-updates__count">%10$s</span>'
				. '</header>'
				. '<div class="wp-block-mantek-live-updates__notice" aria-live="polite">'
				. '<button type="button" class="wp-block-mantek-live-updates__show" hidden data-wp-bind--hidden="!context.newCount" data-wp-on-async--click="actions.showNew" data-wp-text="state.newLabel"></button>'
				. '</div>'
				. '<div class="wp-block-mantek-live-updates__entries">%11$s</div>'
				. '</section>',
			get_block_wrapper_attributes( array( 'class' => $is_live ? 'is-live' : 'is-ended' ) ),
			esc_attr__( 'Live updates', 'wp-newsroom-blocks' ),
			esc_attr( self::STORE ),
			esc_attr( self::STORE . '/' . $post_id ),
			wp_interactivity_data_wp_context( $context ),
			$is_live ? '' : ' hidden',
			esc_html__( 'Live', 'wp-newsroom-blocks' ),
			$is_live ? ' hidden' : '',
			esc_html__( 'Coverage ended', 'wp-newsroom-blocks' ),
			esc_html( $count ),
			$content
		);
	}

	/**
	 * Renders one entry: its time, a "how long ago" label that stays current, and its content.
	 * An entry left empty in the editor renders nothing, and is not counted.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    The rendered inner blocks.
	 */
	public static function render_entry( array $attributes, string $content ): string {
		if ( self::is_blank( $content ) ) {
			return '';
		}

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

		$anchor = $timestamp > 0 ? self::anchor( $timestamp ) : '';

		$extra = array();
		if ( $important ) {
			$extra['class'] = 'is-important';
		}
		if ( '' !== $anchor ) {
			$extra['id'] = $anchor;
		}

		// The key lets the router match each entry with its own fresh copy when it swaps in new
		// updates. Matched by position instead, an entry would keep the context of the one that
		// used to sit in its place, and with it that entry's "how long ago" label.
		$key = $anchor;
		if ( '' === $key ) {
			++self::$untimed;
			$key = 'untimed-' . self::$untimed;
		}

		// tabindex="-1" lets the page move focus to an entry once it is shown, without adding it to the tab order.
		return sprintf(
			'<article %1$s tabindex="-1" data-wp-key="%2$s" %3$s><header class="wp-block-mantek-live-update__meta">%4$s</header><div class="wp-block-mantek-live-update__content">%5$s</div></article>',
			get_block_wrapper_attributes( $extra ),
			esc_attr( $key ),
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
			'/live/(?P<id>[1-9]\d*)',
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
	 * How many entries the live blog has, the newest timestamp, how many are newer than `after`,
	 * and whether coverage is still live, so that open pages stop checking once it is not.
	 *
	 * The response is public and cached for MIN_INTERVAL seconds, so a CDN absorbs the polling
	 * of a large audience.
	 *
	 * @param WP_REST_Request<array<string, mixed>> $request The request.
	 */
	public static function rest_summary( WP_REST_Request $request ): WP_REST_Response {
		$post      = get_post( (int) $request['id'] );
		$live_blog = $post instanceof WP_Post ? self::live_blog( $post ) : array(
			'timestamps' => array(),
			'isLive'     => false,
		);

		$response = new WP_REST_Response(
			self::summarize( $live_blog['timestamps'], (int) $request['after'] ) + array( 'isLive' => $live_blog['isLive'] )
		);
		$response->header( 'Cache-Control', 'public, max-age=' . self::MIN_INTERVAL );

		return $response;
	}

	/**
	 * A post's live blog in brief: the timestamp of each entry, and whether coverage is live.
	 * A post without a live blog counts as not live, so pages stop checking it.
	 *
	 * The result is kept in the object cache under a hash of the content, so with a persistent
	 * object cache the post is parsed again only when it changes.
	 *
	 * @param WP_Post $post The post holding the live blog.
	 * @return array{timestamps: list<int>, isLive: bool}
	 */
	public static function live_blog( WP_Post $post ): array {
		$key    = sprintf( 'live-blog-%d-%s', $post->ID, md5( $post->post_content ) );
		$cached = wp_cache_get( $key, self::CACHE_GROUP );
		if ( is_array( $cached ) && is_array( $cached['timestamps'] ?? null ) && is_bool( $cached['isLive'] ?? null ) ) {
			return array(
				'timestamps' => array_values( array_map( 'intval', $cached['timestamps'] ) ),
				'isLive'     => $cached['isLive'],
			);
		}

		$container = self::find_container( parse_blocks( $post->post_content ) );
		$live_blog = array(
			'timestamps' => self::timestamps( $container['innerBlocks'] ?? array() ),
			// The block saves isLive only when it differs from the default, which is live.
			'isLive'     => null !== $container && false !== ( $container['attrs']['isLive'] ?? true ),
		);
		wp_cache_set( $key, $live_blog, self::CACHE_GROUP, HOUR_IN_SECONDS );

		return $live_blog;
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
	 * The timestamp of every entry with content, in document order. Entries not yet stamped count as 0.
	 *
	 * @param array<array-key, array<string, mixed>> $entries Parsed inner blocks of the container.
	 * @return list<int>
	 */
	public static function timestamps( array $entries ): array {
		$timestamps = array();
		foreach ( $entries as $parsed ) {
			if ( self::ENTRY_BLOCK !== ( $parsed['blockName'] ?? null ) || self::is_blank( self::saved_html( $parsed ) ) ) {
				continue;
			}
			$timestamps[] = max( 0, (int) ( $parsed['attrs']['timestamp'] ?? 0 ) );
		}

		return $timestamps;
	}

	/**
	 * Whether HTML holds nothing a reader would see: no text, and no image, video, audio or embedded frame.
	 *
	 * @param string $html Rendered or saved HTML.
	 */
	public static function is_blank( string $html ): bool {
		if ( 1 === preg_match( '/<(?:img|picture|video|audio|iframe|embed|object|svg|canvas)\b/i', $html ) ) {
			return false;
		}

		$text = html_entity_decode( wp_strip_all_tags( $html ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		// Spaces, no-break spaces, and the invisible direction and joining marks.
		$visible = preg_replace( '/[\s\x{00A0}\x{200B}-\x{200F}\x{2060}\x{FEFF}]+/u', '', $text );

		// Text that is not valid UTF-8 cannot be checked, so it counts as content.
		return '' === $visible;
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
	 * How long ago, as a unit and a whole number: under a minute is "now", then minutes, hours
	 * and days, each rounded to the nearest. A time in the future counts as now.
	 *
	 * The browser works it out the same way, in elapsed() in format.ts, so a label never
	 * changes when the page's scripts take over.
	 *
	 * @param int $seconds Seconds since the update.
	 * @return array{0: 'now'|'minute'|'hour'|'day', 1: int}
	 */
	public static function elapsed( int $seconds ): array {
		if ( $seconds < MINUTE_IN_SECONDS ) {
			return array( 'now', 0 );
		}
		$minutes = (int) round( $seconds / MINUTE_IN_SECONDS );
		if ( $minutes < 60 ) {
			return array( 'minute', $minutes );
		}
		$hours = (int) round( $seconds / HOUR_IN_SECONDS );
		if ( $hours < 24 ) {
			return array( 'hour', $hours );
		}

		return array( 'day', (int) round( $seconds / DAY_IN_SECONDS ) );
	}

	/**
	 * The "how long ago" label of an update, such as "5 minutes ago", in the site's language.
	 *
	 * @param int $seconds Seconds since the update.
	 */
	public static function relative_label( int $seconds ): string {
		list( $unit, $number ) = self::elapsed( $seconds );
		if ( 'now' === $unit ) {
			return __( 'just now', 'wp-newsroom-blocks' );
		}

		return sprintf( self::relative_template( $unit, $number ), number_format_i18n( $number ) );
	}

	/**
	 * The translated "how long ago" label for a unit, in the plural form that suits the number, with %s for the number.
	 *
	 * @param 'minute'|'hour'|'day' $unit   The unit.
	 * @param int                   $number How many of them.
	 */
	private static function relative_template( string $unit, int $number ): string {
		if ( 'minute' === $unit ) {
			/* translators: %s: number of minutes. */
			return _n( '%s minute ago', '%s minutes ago', $number, 'wp-newsroom-blocks' );
		}
		if ( 'hour' === $unit ) {
			/* translators: %s: number of hours. */
			return _n( '%s hour ago', '%s hours ago', $number, 'wp-newsroom-blocks' );
		}

		/* translators: %s: number of days. */
		return _n( '%s day ago', '%s days ago', $number, 'wp-newsroom-blocks' );
	}

	/**
	 * A unique anchor for an entry: update-<timestamp>, then update-<timestamp>-2 for a second entry with the same time.
	 *
	 * @param int $timestamp Entry time.
	 */
	private static function anchor( int $timestamp ): string {
		$anchor                   = 'update-' . $timestamp;
		self::$anchors[ $anchor ] = ( self::$anchors[ $anchor ] ?? 0 ) + 1;

		return 1 === self::$anchors[ $anchor ] ? $anchor : $anchor . '-' . self::$anchors[ $anchor ];
	}

	/**
	 * Everything a parsed block saved, its inner blocks included.
	 *
	 * @param array<array-key, mixed> $parsed A parsed block.
	 */
	private static function saved_html( array $parsed ): string {
		$html = is_string( $parsed['innerHTML'] ?? null ) ? $parsed['innerHTML'] : '';
		foreach ( is_array( $parsed['innerBlocks'] ?? null ) ? $parsed['innerBlocks'] : array() as $inner ) {
			if ( is_array( $inner ) ) {
				$html .= self::saved_html( $inner );
			}
		}

		return $html;
	}

	/**
	 * Shared store state: the clock, the language and number format the labels use, the
	 * "new updates" and "how long ago" labels in every plural form, and the server-side
	 * value of each entry's "how long ago" label.
	 */
	private static function add_state(): void {
		$now = time();

		// The %s stays in each label; the browser fills it with the real number.
		$labels   = array();
		$relative = array( 'now' => __( 'just now', 'wp-newsroom-blocks' ) );
		foreach ( self::PLURAL_SAMPLES as $sample ) {
			/* translators: %s: number of new updates waiting to be shown. */
			$labels[ (string) $sample ] = _n( 'Show %s new update', 'Show %s new updates', $sample, 'wp-newsroom-blocks' );
			foreach ( array( 'minute', 'hour', 'day' ) as $unit ) {
				$relative[ $unit ][ (string) $sample ] = self::relative_template( $unit, $sample );
			}
		}

		wp_interactivity_state(
			self::STORE,
			array(
				'now'          => $now,
				// The plural rules the labels were translated for: English when there is no translation.
				'locale'       => is_textdomain_loaded( Plugin::TEXT_DOMAIN ) ? str_replace( '_', '-', determine_locale() ) : 'en',
				// The site language's thousands separator, as number_format_i18n() prints it.
				'separator'    => str_replace( array( '1', '0' ), '', number_format_i18n( 1000 ) ),
				'labels'       => $labels,
				'relative'     => $relative,
				'relativeTime' => static function () use ( $now ): string {
					$context   = wp_interactivity_get_context();
					$timestamp = (int) ( $context['timestamp'] ?? 0 );

					return $timestamp > 0 ? self::relative_label( $now - $timestamp ) : '';
				},
			)
		);
	}
}
