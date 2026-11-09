<?php
/**
 * Tests for the Read also block's server rendering.
 *
 * @package mantek-newsroom-blocks
 */

declare( strict_types = 1 );

namespace ManTek\NewsroomBlocks\Tests;

use Brain\Monkey\Functions;
use ManTek\NewsroomBlocks\ReadAlso;
use WP_Block;
use WP_Post;

final class ReadAlsoTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		Functions\when( 'wp_unique_id' )->justReturn( 'wp-block-mantek-read-also-1' );
		Functions\when( 'get_permalink' )->alias( static fn ( WP_Post $post ): string => 'https://example.com/?p=' . $post->ID );
		Functions\when( 'get_the_title' )->alias( static fn ( WP_Post $post ): string => $post->post_title );
		Functions\when( 'get_the_post_thumbnail' )->justReturn( '<img alt="" />' );
	}

	public function test_post_ids_are_cleaned_deduplicated_and_capped(): void {
		$raw = array( '3', 3, 0, -1, 'abc', 5, 7, 8, 9, 10, 11 );

		$this->assertSame( array( 3, 7, 8, 9, 10 ), ReadAlso::post_ids( $raw, 5 ) );
	}

	public function test_post_ids_ignore_anything_but_an_array(): void {
		$this->assertSame( array(), ReadAlso::post_ids( 'not-an-array' ) );
		$this->assertSame( array(), ReadAlso::post_ids( null ) );
	}

	public function test_query_keeps_the_editors_order_and_stays_cacheable(): void {
		$args = ReadAlso::query_args( array( 9, 4 ) );

		$this->assertSame( array( 9, 4 ), $args['post__in'] );
		$this->assertSame( 'post__in', $args['orderby'] );
		$this->assertSame( 'publish', $args['post_status'] );
		$this->assertSame( 2, $args['posts_per_page'] );
		$this->assertFalse( $args['suppress_filters'] );
		// Post meta is read only for featured images.
		$this->assertFalse( $args['update_post_meta_cache'] );
		$this->assertTrue( ReadAlso::query_args( array( 9 ), true )['update_post_meta_cache'] );
	}

	public function test_renders_nothing_without_chosen_articles(): void {
		Functions\expect( 'get_posts' )->never();

		$this->assertSame( '', ReadAlso::render( array( 'postIds' => array() ) ) );
	}

	public function test_renders_nothing_when_no_chosen_article_is_published(): void {
		Functions\expect( 'get_posts' )->once()->andReturn( array() );

		$this->assertSame( '', ReadAlso::render( array( 'postIds' => array( 12 ) ) ) );
	}

	public function test_renders_the_links_in_order_under_the_default_heading(): void {
		Functions\expect( 'get_posts' )->once()->andReturn(
			array(
				new WP_Post(
					array(
						'ID'         => 12,
						'post_title' => 'Second <em>story</em>',
					)
				),
				new WP_Post(
					array(
						'ID'         => 7,
						'post_title' => 'First story',
					)
				),
			)
		);

		$html = ReadAlso::render( array( 'postIds' => array( 12, 7 ) ) );

		$this->assertStringContainsString( '<aside class="wp-block" aria-labelledby="wp-block-mantek-read-also-1">', $html );
		$this->assertStringContainsString( 'id="wp-block-mantek-read-also-1">Read also</p>', $html );
		$this->assertLessThan( strpos( $html, '?p=7' ), strpos( $html, '?p=12' ) );
		$this->assertStringNotContainsString( '<img', $html );
		// Markup in a title is formatting, as WordPress shows it, not text.
		$this->assertStringContainsString( '<span class="wp-block-mantek-read-also__title">Second <em>story</em></span>', $html );
	}

	public function test_never_links_a_story_to_itself(): void {
		Functions\expect( 'get_posts' )
			->once()
			->with( \Mockery::on( static fn ( array $args ): bool => array( 7 ) === $args['post__in'] ) )
			->andReturn(
				array(
					new WP_Post(
						array(
							'ID'         => 7,
							'post_title' => 'Other',
						)
					),
				)
			);

		$block = new WP_Block( array(), array( 'postId' => 12 ) );

		$this->assertStringContainsString( '?p=7', ReadAlso::render( array( 'postIds' => array( 12, 7 ) ), $block ) );
	}

	public function test_uses_a_custom_heading_and_shows_thumbnails_when_asked(): void {
		Functions\expect( 'get_posts' )
			->once()
			->with( \Mockery::on( static fn ( array $args ): bool => true === $args['update_post_meta_cache'] ) )
			->andReturn(
				array(
					new WP_Post(
						array(
							'ID'         => 3,
							'post_title' => 'Story',
						)
					),
				)
			);

		$html = ReadAlso::render(
			array(
				'postIds'        => array( 3 ),
				'heading'        => '<strong>Also on this</strong>',
				'showThumbnails' => true,
			)
		);

		$this->assertStringContainsString( '>Also on this</p>', $html );
		$this->assertStringContainsString( '<img alt="" />', $html );
	}
}
