<?php
/**
 * Hooks the plugin into WordPress.
 *
 * @package wp-newsroom-blocks
 */

declare( strict_types = 1 );

namespace ManTek\NewsroomBlocks;

use WP_Block_Type_Registry;

/**
 * Registers the blocks, their inserter category, translations and the REST route.
 */
final class Plugin {

	/**
	 * Text domain for PHP and JavaScript strings.
	 */
	public const TEXT_DOMAIN = 'wp-newsroom-blocks';

	/**
	 * Namespace shared by every block in the plugin.
	 */
	public const BLOCK_NAMESPACE = 'mantek';

	/**
	 * Inserter category the blocks appear under.
	 */
	public const CATEGORY = 'newsroom';

	/**
	 * Adds the plugin's hooks.
	 */
	public static function boot(): void {
		add_action( 'init', array( self::class, 'load_textdomain' ), 1 );
		add_action( 'init', array( self::class, 'register_blocks' ) );
		add_filter( 'block_categories_all', array( self::class, 'register_category' ) );
		add_filter( 'wp_kses_allowed_html', array( self::class, 'allow_time_element' ), 10, 2 );
		add_action( 'rest_api_init', array( LiveUpdates::class, 'register_routes' ) );
	}

	/**
	 * Lets authors without the unfiltered_html capability keep the timeline's <time> element.
	 *
	 * WordPress added <time> to the post allow-list in 6.9. On 6.8 it was stripped when such
	 * an author saved, which left every dated timeline event an invalid block. On 6.9 and
	 * later the tag is already allowed and this changes nothing.
	 *
	 * @param array<string, array<string, bool>> $tags    Allowed tags and their attributes.
	 * @param string|array<mixed>                $context The KSES context.
	 * @return array<string, array<string, bool>>
	 */
	public static function allow_time_element( array $tags, string|array $context ): array {
		if ( 'post' === $context && ! isset( $tags['time'] ) ) {
			$tags['time'] = array(
				'class'    => true,
				'datetime' => true,
			);
		}

		return $tags;
	}

	/**
	 * Loads the translations bundled in languages/.
	 */
	public static function load_textdomain(): void {
		load_plugin_textdomain( self::TEXT_DOMAIN, false, dirname( plugin_basename( PLUGIN_FILE ) ) . '/languages' );
	}

	/**
	 * Registers every block in the build manifest, then points their editor scripts at the bundled translations.
	 */
	public static function register_blocks(): void {
		$build = dirname( PLUGIN_FILE ) . '/build';
		wp_register_block_types_from_metadata_collection( $build, $build . '/blocks-manifest.php' );

		$languages = dirname( PLUGIN_FILE ) . '/languages';
		foreach ( WP_Block_Type_Registry::get_instance()->get_all_registered() as $name => $block_type ) {
			if ( ! str_starts_with( $name, self::BLOCK_NAMESPACE . '/' ) ) {
				continue;
			}
			foreach ( $block_type->editor_script_handles as $handle ) {
				wp_set_script_translations( $handle, self::TEXT_DOMAIN, $languages );
			}
		}
	}

	/**
	 * Adds the Newsroom category to the inserter, unless something else already did.
	 *
	 * @param array<int, array<string, mixed>> $categories Registered block categories.
	 * @return array<int, array<string, mixed>>
	 */
	public static function register_category( array $categories ): array {
		foreach ( $categories as $category ) {
			if ( self::CATEGORY === ( $category['slug'] ?? '' ) ) {
				return $categories;
			}
		}

		$categories[] = array(
			'slug'  => self::CATEGORY,
			'title' => __( 'Newsroom', 'wp-newsroom-blocks' ),
			'icon'  => null,
		);

		return $categories;
	}
}
