<?php
/**
 * Tests for the plugin bootstrap.
 *
 * @package wp-newsroom-blocks
 */

declare( strict_types = 1 );

namespace ManTek\NewsroomBlocks\Tests;

use Brain\Monkey\Actions;
use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use ManTek\NewsroomBlocks\LiveUpdates;
use ManTek\NewsroomBlocks\Plugin;
use WP_Post;

final class PluginTest extends TestCase {

	public function test_boot_hooks_registration_translations_category_and_rest(): void {
		Actions\expectAdded( 'init' )->twice();
		Filters\expectAdded( 'block_categories_all' )->once()->with( array( Plugin::class, 'register_category' ) );
		Filters\expectAdded( 'wp_kses_allowed_html' )->once()->with( array( Plugin::class, 'allow_time_element' ), 10, 2 );
		Actions\expectAdded( 'rest_api_init' )->once()->with( array( LiveUpdates::class, 'register_routes' ) );

		Plugin::boot();
	}

	public function test_adds_the_newsroom_category_once(): void {
		$categories = Plugin::register_category( array( array( 'slug' => 'text' ) ) );

		$this->assertSame( array( 'text', 'newsroom' ), array_column( $categories, 'slug' ) );
		$this->assertSame( 'Newsroom', $categories[1]['title'] );
		$this->assertSame( $categories, Plugin::register_category( $categories ) );
	}

	public function test_allows_the_time_element_in_posts_when_wordpress_does_not(): void {
		$tags = Plugin::allow_time_element( array( 'p' => array( 'class' => true ) ), 'post' );

		$this->assertSame(
			array(
				'class'    => true,
				'datetime' => true,
			),
			$tags['time']
		);
	}

	public function test_leaves_an_existing_time_rule_and_other_contexts_alone(): void {
		$existing = array( 'time' => array( 'datetime' => true ) );

		$this->assertSame( $existing, Plugin::allow_time_element( $existing, 'post' ) );
		$this->assertSame( array(), Plugin::allow_time_element( array(), 'strip' ) );
		$this->assertSame( array(), Plugin::allow_time_element( array(), array( 'a' => array() ) ) );
	}

	public function test_accepts_whatever_other_code_passes_to_kses(): void {
		// wp_kses( $html, null ) reaches the filter with a null context.
		$this->assertSame( array( 'b' => array() ), Plugin::allow_time_element( array( 'b' => array() ), null ) );
		// A filter elsewhere may hand on something other than an array; it passes through.
		$this->assertSame( 'not an array', Plugin::allow_time_element( 'not an array', 'post' ) );
		$this->assertNull( Plugin::allow_time_element( null, 'post' ) );
	}

	public function test_titles_keep_inline_formatting_and_lose_other_markup(): void {
		Functions\when( 'get_the_title' )->alias( static fn ( WP_Post $post ): string => $post->post_title );

		$title = Plugin::title_html( new WP_Post( array( 'post_title' => 'Markup <em>in</em> <a href="/x">the</a> title &amp; <script>alert(1)</script>' ) ) );

		$this->assertSame( 'Markup <em>in</em> the title &amp; alert(1)', $title );
	}

	public function test_an_untitled_post_still_gives_its_link_a_name(): void {
		Functions\when( 'get_the_title' )->alias( static fn ( WP_Post $post ): string => $post->post_title );

		$this->assertSame( '(no title)', Plugin::title_html( new WP_Post( array( 'post_title' => '' ) ) ) );
		$this->assertSame( '(no title)', Plugin::title_html( new WP_Post( array( 'post_title' => ' <em></em> ' ) ) ) );
	}
}
