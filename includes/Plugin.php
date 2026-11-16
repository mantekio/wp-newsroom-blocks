<?php
/**
 * Hooks the plugin into WordPress.
 *
 * @package mantek-newsroom-blocks
 */

declare( strict_types = 1 );

namespace ManTek\NewsroomBlocks;

use WP_Block_Type_Registry;
use WP_Post;

/**
 * Registers the blocks, their inserter category, translations and the REST route.
 */
final class Plugin {

	/**
	 * Text domain for PHP and JavaScript strings.
	 */
	public const TEXT_DOMAIN = 'mantek-newsroom-blocks';

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
	 *
	 * Translations need no hook of their own: WordPress loads them just in time, from the language pack
	 * and from the Text Domain and Domain Path headers (for a network-activated copy, only from WordPress 7.2).
	 */
	public static function boot(): void {
		add_action( 'init', array( self::class, 'register_blocks' ) );
		add_filter( 'load_script_translation_file', array( self::class, 'prefer_language_pack' ), 10, 3 );
		add_filter( 'block_categories_all', array( self::class, 'register_category' ) );
		add_filter( 'wp_kses_allowed_html', array( self::class, 'allow_time_element' ), 10, 2 );
		add_action( 'rest_api_init', array( LiveUpdates::class, 'register_routes' ) );
	}

	/**
	 * Inline formatting a post title may keep when it is shown inside a link. Everything else is dropped.
	 */
	private const TITLE_TAGS = array(
		'abbr'   => array( 'title' => true ),
		'b'      => array(),
		'bdi'    => array(),
		'cite'   => array(),
		'code'   => array(),
		'em'     => array(),
		'i'      => array(),
		'mark'   => array(),
		'q'      => array(),
		's'      => array(),
		'small'  => array(),
		'span'   => array(
			'dir'  => true,
			'lang' => true,
		),
		'strong' => array(),
		'sub'    => array(),
		'sup'    => array(),
	);

	/**
	 * Lets authors without the unfiltered_html capability keep the timeline's <time> element.
	 *
	 * WordPress added <time> to the post allow-list in 6.9. On 6.8 it was stripped when such
	 * an author saved, which left every dated timeline event an invalid block. On 6.9 and
	 * later the tag is already allowed and this changes nothing.
	 *
	 * The parameters are untyped because other code can call wp_kses() with any context,
	 * null included, and a filter that rejected it would take the page down.
	 *
	 * @param mixed $tags    Allowed tags and their attributes, normally an array.
	 * @param mixed $context The KSES context, normally a string.
	 * @return mixed The allowed tags, with <time> added for posts.
	 */
	public static function allow_time_element( mixed $tags, mixed $context = null ): mixed {
		if ( is_array( $tags ) && 'post' === $context && ! isset( $tags['time'] ) ) {
			$tags['time'] = array(
				'class'    => true,
				'datetime' => true,
			);
		}

		return $tags;
	}

	/**
	 * A post's title as link text: with the inline formatting a title can carry, such as <em>,
	 * and "(no title)" for an untitled post, so that no link is left without a name.
	 *
	 * @param WP_Post $post The post.
	 */
	public static function title_html( WP_Post $post ): string {
		$title = wp_kses( get_the_title( $post ), self::TITLE_TAGS );
		if ( '' === trim( wp_strip_all_tags( $title ) ) ) {
			return esc_html__( '(no title)', 'mantek-newsroom-blocks' );
		}

		return $title;
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
	 * Uses the language pack's copy of an editor script's translations when one is installed.
	 *
	 * register_blocks() points the editor scripts at the bundled languages/ folder, and WordPress tries that
	 * folder before the language packs, so a correction made on translate.wordpress.org would otherwise reach
	 * the editor only with the next release. The bundled copy stays the fallback for a site with no pack, which
	 * a network-activated copy needs before WordPress 7.2.
	 *
	 * @param mixed $file   The translation file WordPress is about to load, or false.
	 * @param mixed $handle The script handle.
	 * @param mixed $domain The text domain.
	 * @return mixed The pack's copy of the same file when it exists, otherwise the file WordPress asked for.
	 */
	public static function prefer_language_pack( mixed $file, mixed $handle = null, mixed $domain = null ): mixed {
		if ( self::TEXT_DOMAIN !== $domain || ! is_string( $file ) ) {
			return $file;
		}

		if ( ! str_starts_with( $file, dirname( PLUGIN_FILE ) . '/languages/' ) ) {
			return $file;
		}

		$pack = WP_LANG_DIR . '/plugins/' . basename( $file );

		return is_readable( $pack ) ? $pack : $file;
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
			'title' => __( 'Newsroom', 'mantek-newsroom-blocks' ),
			'icon'  => null,
		);

		return $categories;
	}
}
