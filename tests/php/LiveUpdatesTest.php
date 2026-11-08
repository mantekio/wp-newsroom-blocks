<?php
/**
 * Tests for the Live updates blocks and their polling endpoint.
 *
 * @package wp-newsroom-blocks
 */

declare( strict_types = 1 );

namespace ManTek\NewsroomBlocks\Tests;

use Brain\Monkey\Functions;
use ManTek\NewsroomBlocks\LiveUpdates;
use PHPUnit\Framework\Attributes\DataProvider;
use WP_Block;
use WP_Error;
use WP_Post;
use WP_REST_Request;

final class LiveUpdatesTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		Functions\when( 'number_format_i18n' )->alias( static fn ( int $number ): string => number_format( $number ) );
	}

	/**
	 * One entry as parse_blocks() returns it: its timestamp, and a paragraph of content.
	 *
	 * @param int    $timestamp Entry time.
	 * @param string $html      The paragraph's saved HTML.
	 * @return array<string, mixed>
	 */
	private function entry( int $timestamp, string $html = '<p>News.</p>' ): array {
		return array(
			'blockName'   => 'mantek/live-update',
			'attrs'       => $timestamp > 0 ? array( 'timestamp' => $timestamp ) : array(),
			'innerHTML'   => '',
			'innerBlocks' => array(
				array(
					'blockName'   => 'core/paragraph',
					'attrs'       => array(),
					'innerHTML'   => $html,
					'innerBlocks' => array(),
				),
			),
		);
	}

	/**
	 * A live blog with three entries, the newest first, as parse_blocks() returns it.
	 *
	 * @param array<string, mixed> $attrs The container's saved attributes.
	 * @return array<string, mixed>
	 */
	private function container( array $attrs = array() ): array {
		return array(
			'blockName'   => 'mantek/live-updates',
			'attrs'       => $attrs,
			'innerBlocks' => array( $this->entry( 300 ), $this->entry( 200 ), $this->entry( 100 ) ),
		);
	}

	/**
	 * The state the container hands to the Interactivity API, captured as it renders.
	 *
	 * @param array<string, mixed> $attributes Container attributes.
	 * @return array{html: string, state: array<string, mixed>}
	 */
	private function render_container( array $attributes ): array {
		$state = array();
		Functions\when( 'rest_url' )->alias( static fn ( string $path ): string => 'https://example.com/wp-json/' . $path );
		Functions\when( 'wp_interactivity_state' )->alias(
			static function ( string $store, array $value ) use ( &$state ): array {
				$state = $value;
				return $value;
			}
		);

		$html = LiveUpdates::render( $attributes, '<article>…</article>', new WP_Block( $this->container(), array( 'postId' => 5 ) ) );

		return array(
			'html'  => $html,
			'state' => $state,
		);
	}

	public function test_summary_counts_entries_and_finds_the_newest(): void {
		$this->assertSame(
			array(
				'count'  => 3,
				'latest' => 300,
				'newer'  => 0,
			),
			LiveUpdates::summarize( array( 300, 200, 100 ), 0 )
		);
	}

	public function test_summary_counts_only_entries_newer_than_the_reader_has(): void {
		$this->assertSame( 2, LiveUpdates::summarize( array( 300, 200, 100 ), 100 )['newer'] );
		$this->assertSame( 0, LiveUpdates::summarize( array( 300 ), 300 )['newer'] );
	}

	public function test_summary_of_an_empty_live_blog(): void {
		$this->assertSame(
			array(
				'count'  => 0,
				'latest' => 0,
				'newer'  => 0,
			),
			LiveUpdates::summarize( array(), 50 )
		);
	}

	public function test_timestamps_come_only_from_entries(): void {
		$entries   = $this->container()['innerBlocks'];
		$entries[] = array(
			'blockName' => 'core/paragraph',
			'attrs'     => array(),
			'innerHTML' => '<p>Not an entry.</p>',
		);
		$entries[] = $this->entry( 0 );

		$this->assertSame( array( 300, 200, 100, 0 ), LiveUpdates::timestamps( $entries ) );
	}

	public function test_timestamps_skip_entries_left_empty(): void {
		$entries = array(
			$this->entry( 400, '<p></p>' ),
			$this->entry( 300 ),
			$this->entry( 250, "<p>&nbsp; \u{200F}</p>" ),
			$this->entry( 200, '<figure class="wp-block-image"><img src="https://example.com/a.jpg" alt=""/></figure>' ),
			array(
				'blockName'   => 'mantek/live-update',
				'attrs'       => array( 'timestamp' => 150 ),
				'innerHTML'   => '',
				'innerBlocks' => array(),
			),
		);

		$this->assertSame( array( 300, 200 ), LiveUpdates::timestamps( $entries ) );
	}

	/**
	 * @return array<string, array{string, bool}>
	 */
	public static function blank_html(): array {
		return array(
			'nothing'                => array( '', true ),
			'an empty paragraph'     => array( '<p></p>', true ),
			'spaces and marks'       => array( "<p>&nbsp;\u{200E} </p>", true ),
			'text'                   => array( '<p>Polls close.</p>', false ),
			'an image'               => array( '<figure><img src="a.jpg" alt=""/></figure>', false ),
			'an embed, by its URL'   => array( '<figure class="wp-block-embed"><div class="wp-block-embed__wrapper">https://youtu.be/x</div></figure>', false ),
			'a video'                => array( '<video controls src="a.mp4"></video>', false ),
			'invalid UTF-8 is text'  => array( "<p>\xC3</p>", false ),
			'Arabic text is content' => array( '<p>عاجل</p>', false ),
		);
	}

	#[DataProvider( 'blank_html' )]
	public function test_knows_an_entry_with_nothing_to_show( string $html, bool $blank ): void {
		$this->assertSame( $blank, LiveUpdates::is_blank( $html ) );
	}

	public function test_finds_a_live_blog_nested_inside_other_blocks(): void {
		$blocks = array(
			array(
				'blockName'   => 'core/paragraph',
				'innerBlocks' => array(),
			),
			array(
				'blockName'   => 'core/group',
				'innerBlocks' => array(
					array(
						'blockName'   => 'core/column',
						'innerBlocks' => array( $this->container() ),
					),
				),
			),
		);

		$this->assertSame( $this->container(), LiveUpdates::find_container( $blocks ) );
		$this->assertNull( LiveUpdates::find_container( array( $blocks[0] ) ) );
	}

	public function test_endpoint_hides_posts_the_public_cannot_read(): void {
		Functions\when( 'get_post' )->alias(
			static fn ( int $id ): ?WP_Post => match ( $id ) {
				1 => new WP_Post( array( 'ID' => 1 ) ),
				2 => new WP_Post( array( 'ID' => 2 ) ),
				3 => new WP_Post(
					array(
						'ID'            => 3,
						'post_password' => 'secret',
					)
				),
				default => null,
			}
		);
		Functions\when( 'is_post_publicly_viewable' )->alias( static fn ( WP_Post $post ): bool => 2 !== $post->ID );

		$this->assertTrue( LiveUpdates::rest_can_read( new WP_REST_Request( array( 'id' => 1 ) ) ) );

		foreach ( array( 2, 3, 99 ) as $id ) {
			$error = LiveUpdates::rest_can_read( new WP_REST_Request( array( 'id' => $id ) ) );
			$this->assertInstanceOf( WP_Error::class, $error );
			$this->assertSame( array( 'status' => 404 ), $error->get_error_data() );
		}
	}

	public function test_endpoint_reports_newer_entries_and_can_be_cached_publicly(): void {
		$container = $this->container();
		Functions\when( 'get_post' )->justReturn(
			new WP_Post(
				array(
					'ID'           => 5,
					'post_content' => '<!-- the live blog -->',
				)
			)
		);
		Functions\expect( 'wp_cache_get' )->once()->with( 'live-blog-5-' . md5( '<!-- the live blog -->' ), 'wp-newsroom-blocks' )->andReturn( false );
		Functions\expect( 'parse_blocks' )->once()->andReturn( array( $container ) );
		Functions\expect( 'wp_cache_set' )->once();

		$response = LiveUpdates::rest_summary(
			new WP_REST_Request(
				array(
					'id'    => 5,
					'after' => 200,
				)
			)
		);

		$this->assertSame(
			array(
				'count'  => 3,
				'latest' => 300,
				'newer'  => 1,
				'isLive' => true,
			),
			$response->get_data()
		);
		$this->assertSame( 'public, max-age=15', $response->headers['Cache-Control'] );
	}

	public function test_endpoint_tells_open_pages_that_coverage_has_ended(): void {
		Functions\when( 'get_post' )->justReturn( new WP_Post( array( 'ID' => 5 ) ) );
		Functions\when( 'wp_cache_get' )->justReturn( false );
		Functions\when( 'wp_cache_set' )->justReturn( true );
		Functions\when( 'parse_blocks' )->justReturn( array( $this->container( array( 'isLive' => false ) ) ) );

		$this->assertFalse( LiveUpdates::rest_summary( new WP_REST_Request( array( 'id' => 5 ) ) )->get_data()['isLive'] );
	}

	public function test_a_post_without_a_live_blog_is_not_live(): void {
		Functions\when( 'get_post' )->justReturn( new WP_Post( array( 'ID' => 5 ) ) );
		Functions\when( 'wp_cache_get' )->justReturn( false );
		Functions\when( 'wp_cache_set' )->justReturn( true );
		Functions\when( 'parse_blocks' )->justReturn( array( array( 'blockName' => 'core/paragraph' ) ) );

		$this->assertSame(
			array(
				'count'  => 0,
				'latest' => 0,
				'newer'  => 0,
				'isLive' => false,
			),
			LiveUpdates::rest_summary( new WP_REST_Request( array( 'id' => 5 ) ) )->get_data()
		);
	}

	public function test_endpoint_skips_parsing_while_the_post_is_unchanged(): void {
		Functions\when( 'get_post' )->justReturn( new WP_Post( array( 'ID' => 5 ) ) );
		Functions\when( 'wp_cache_get' )->justReturn(
			array(
				'timestamps' => array( 300, 200 ),
				'isLive'     => true,
			)
		);
		Functions\expect( 'parse_blocks' )->never();

		$response = LiveUpdates::rest_summary( new WP_REST_Request( array( 'id' => 5 ) ) );

		$this->assertSame( 2, $response->get_data()['count'] );
	}

	public function test_a_cached_value_of_another_shape_is_parsed_again(): void {
		Functions\when( 'get_post' )->justReturn( new WP_Post( array( 'ID' => 5 ) ) );
		Functions\when( 'wp_cache_get' )->justReturn( array( 300, 200 ) );
		Functions\when( 'wp_cache_set' )->justReturn( true );
		Functions\expect( 'parse_blocks' )->once()->andReturn( array( $this->container() ) );

		$this->assertSame( 3, LiveUpdates::rest_summary( new WP_REST_Request( array( 'id' => 5 ) ) )->get_data()['count'] );
	}

	public function test_entry_shows_its_time_and_a_live_how_long_ago_label(): void {
		Functions\when( 'get_option' )->alias( static fn ( string $name ): string => 'time_format' === $name ? 'H:i' : 'j F Y' );
		Functions\when( 'wp_date' )->alias( static fn ( string $format, int $timestamp ): string => gmdate( $format, $timestamp ) );

		$timestamp = time() - 120;
		$html      = LiveUpdates::render_entry(
			array(
				'timestamp' => $timestamp,
				'important' => true,
			),
			'<p>Polls close.</p>'
		);

		$this->assertStringContainsString( sprintf( '<time class="wp-block-mantek-live-update__time" datetime="%s">', gmdate( 'c', $timestamp ) ), $html );
		$this->assertStringContainsString( 'data-wp-text="state.relativeTime"', $html );
		$this->assertStringContainsString( sprintf( 'id="update-%d"', $timestamp ), $html );
		$this->assertStringContainsString( sprintf( 'data-wp-key="update-%d"', $timestamp ), $html );
		$this->assertStringContainsString( 'class="is-important"', $html );
		$this->assertStringContainsString( '>Key update</span>', $html );
		$this->assertStringContainsString( sprintf( "data-wp-context='{\"timestamp\":%d}'", $timestamp ), $html );
		$this->assertStringContainsString( ' tabindex="-1" ', $html );
		$this->assertStringContainsString( '<p>Polls close.</p>', $html );
	}

	public function test_an_entry_left_empty_renders_nothing(): void {
		$this->assertSame( '', LiveUpdates::render_entry( array( 'timestamp' => 1_234_500 ), "<p></p>\n" ) );
	}

	public function test_entries_with_the_same_time_get_anchors_of_their_own(): void {
		Functions\when( 'get_option' )->justReturn( 'H:i' );
		Functions\when( 'wp_date' )->alias( static fn ( string $format, int $timestamp ): string => gmdate( $format, $timestamp ) );

		$first  = LiveUpdates::render_entry( array( 'timestamp' => 1_234_567 ), '<p>First.</p>' );
		$second = LiveUpdates::render_entry( array( 'timestamp' => 1_234_567 ), '<p>Second.</p>' );

		$this->assertStringContainsString( 'id="update-1234567"', $first );
		$this->assertStringContainsString( 'id="update-1234567-2"', $second );
		// The router matches entries by these keys, so they must be as unique as the anchors.
		$this->assertStringContainsString( 'data-wp-key="update-1234567"', $first );
		$this->assertStringContainsString( 'data-wp-key="update-1234567-2"', $second );

		// Each live blog's anchors are its own: rendering the container starts the count again.
		$this->render_container( array( 'isLive' => true ) );
		$this->assertStringContainsString( 'id="update-1234567"', LiveUpdates::render_entry( array( 'timestamp' => 1_234_567 ), '<p>Again.</p>' ) );
	}

	public function test_entries_without_a_time_still_get_keys_of_their_own(): void {
		$this->render_container( array( 'isLive' => true ) );

		$first  = LiveUpdates::render_entry( array(), '<p>First.</p>' );
		$second = LiveUpdates::render_entry( array(), '<p>Second.</p>' );

		$this->assertStringContainsString( 'data-wp-key="untimed-1"', $first );
		$this->assertStringContainsString( 'data-wp-key="untimed-2"', $second );
		// No time, so no anchor to link to.
		$this->assertStringNotContainsString( ' id="', $first );

		// Each live blog's keys are its own, like its anchors.
		$this->render_container( array( 'isLive' => true ) );
		$this->assertStringContainsString( 'data-wp-key="untimed-1"', LiveUpdates::render_entry( array(), '<p>Again.</p>' ) );
	}

	public function test_time_includes_the_date_for_earlier_days(): void {
		Functions\when( 'get_option' )->alias( static fn ( string $name ): string => 'time_format' === $name ? 'H:i' : 'j F Y' );
		Functions\when( 'wp_date' )->alias( static fn ( string $format, int $timestamp ): string => gmdate( $format, $timestamp ) );

		$now = gmmktime( 18, 0, 0, 11, 4, 2026 );

		$this->assertSame( '09:15', LiveUpdates::format_time( gmmktime( 9, 15, 0, 11, 4, 2026 ), $now ) );
		$this->assertSame( '3 November 2026 23:50', LiveUpdates::format_time( gmmktime( 23, 50, 0, 11, 3, 2026 ), $now ) );
	}

	/**
	 * The same cases as the elapsed() tests in tests/js/live-updates-format.test.ts: the server
	 * and the browser must agree on every one, or a label changes when the scripts take over.
	 *
	 * @return array<string, array{int, string, int}>
	 */
	public static function elapsed_times(): array {
		return array(
			'the future is now'           => array( -30, 'now', 0 ),
			'zero'                        => array( 0, 'now', 0 ),
			'under a minute'              => array( 59, 'now', 0 ),
			'one minute'                  => array( 60, 'minute', 1 ),
			'89 seconds'                  => array( 89, 'minute', 1 ),
			'90 seconds'                  => array( 90, 'minute', 2 ),
			'48 minutes, not an hour'     => array( 48 * 60, 'minute', 48 ),
			'just under an hour'          => array( 59 * 60 + 29, 'minute', 59 ),
			'rounds up to an hour'        => array( 59 * 60 + 30, 'hour', 1 ),
			'70 minutes'                  => array( 70 * 60, 'hour', 1 ),
			'just under a day'            => array( 23 * 3600 + 29 * 60, 'hour', 23 ),
			'rounds up to a day'          => array( 23 * 3600 + 30 * 60, 'day', 1 ),
			'just under a day and a half' => array( 36 * 3600 - 1, 'day', 1 ),
			'a day and a half'            => array( 36 * 3600, 'day', 2 ),
		);
	}

	#[DataProvider( 'elapsed_times' )]
	public function test_elapsed_time_is_rounded_as_the_browser_rounds_it( int $seconds, string $unit, int $value ): void {
		$this->assertSame( array( $unit, $value ), LiveUpdates::elapsed( $seconds ) );
	}

	public function test_relative_labels_name_the_unit_and_the_number(): void {
		$this->assertSame( 'just now', LiveUpdates::relative_label( 20 ) );
		$this->assertSame( '1 minute ago', LiveUpdates::relative_label( 60 ) );
		$this->assertSame( '48 minutes ago', LiveUpdates::relative_label( 48 * 60 ) );
		$this->assertSame( '3 hours ago', LiveUpdates::relative_label( 3 * 3600 ) );
		$this->assertSame( '1 day ago', LiveUpdates::relative_label( 86400 ) );
		$this->assertSame( '1,000 days ago', LiveUpdates::relative_label( 1000 * 86400 ) );
	}

	public function test_container_renders_the_badge_count_and_polling_context(): void {
		$html = $this->render_container(
			array(
				'isLive'       => true,
				'pollInterval' => 5,
			)
		)['html'];

		$this->assertStringContainsString( 'data-wp-router-region="mantek/live-updates/5"', $html );
		$this->assertStringContainsString( '<span class="wp-block-mantek-live-updates__badge" data-wp-bind--hidden="!context.isLive">Live</span>', $html );
		// Coverage can end while the page is open, so its notice is there too, hidden.
		$this->assertStringContainsString( '<span class="wp-block-mantek-live-updates__ended" hidden data-wp-bind--hidden="context.isLive">Coverage ended</span>', $html );
		$this->assertStringContainsString( '>3 updates</span>', $html );
		$this->assertStringContainsString( '"endpoint":"https:\/\/example.com\/wp-json\/wp-newsroom-blocks\/v1\/live\/5"', $html );
		$this->assertStringContainsString( '"latest":300', $html );
		$this->assertStringContainsString( '"newest":300', $html );
		// The interval never drops below the cache lifetime of the endpoint.
		$this->assertStringContainsString( '"interval":15', $html );
		$this->assertStringContainsString( 'data-wp-watch---poll="callbacks.poll"', $html );
		$this->assertStringContainsString( 'data-wp-watch---sync="callbacks.syncFromServer"', $html );
		$this->assertStringContainsString( '<article>…</article>', $html );
	}

	public function test_container_after_coverage_ends_stops_polling(): void {
		$html = $this->render_container( array( 'isLive' => false ) )['html'];

		$this->assertStringContainsString( '<span class="wp-block-mantek-live-updates__badge" hidden data-wp-bind--hidden="!context.isLive">Live</span>', $html );
		$this->assertStringContainsString( '<span class="wp-block-mantek-live-updates__ended" data-wp-bind--hidden="context.isLive">Coverage ended</span>', $html );
		$this->assertStringContainsString( '"isLive":false', $html );
		$this->assertStringContainsString( 'class="is-ended"', $html );
	}

	public function test_store_state_gives_the_browser_what_it_needs_to_write_the_same_labels(): void {
		$state = $this->render_container( array( 'isLive' => true ) )['state'];

		// English plural rules when no translation is loaded, and the site's separator.
		$this->assertSame( 'en', $state['locale'] );
		$this->assertSame( ',', $state['separator'] );
		$this->assertSame( 'Show %s new update', $state['labels']['1'] );
		$this->assertSame( 'Show %s new updates', $state['labels']['11'] );
		$this->assertSame( 'just now', $state['relative']['now'] );
		$this->assertSame( '%s minute ago', $state['relative']['minute']['1'] );
		$this->assertSame( '%s hours ago', $state['relative']['hour']['2'] );
		$this->assertSame( '%s days ago', $state['relative']['day']['100'] );
		$this->assertSame( array( '0', '1', '2', '3', '11', '100' ), array_map( 'strval', array_keys( $state['relative']['day'] ) ) );

		// The server's own value of an entry's label, read from that entry's context.
		Functions\when( 'wp_interactivity_get_context' )->justReturn( array( 'timestamp' => $state['now'] - 5 * 60 ) );
		$this->assertSame( '5 minutes ago', $state['relativeTime']() );
	}

	public function test_store_state_uses_the_plural_rules_of_a_loaded_translation(): void {
		Functions\when( 'is_textdomain_loaded' )->justReturn( true );
		Functions\when( 'determine_locale' )->justReturn( 'pt_BR' );

		$this->assertSame( 'pt-BR', $this->render_container( array( 'isLive' => true ) )['state']['locale'] );
	}
}
