<?php
/**
 * Front-end markup for the Read also block.
 *
 * @package mantek-newsroom-blocks
 *
 * @var array<string, mixed> $attributes Block attributes.
 * @var WP_Block             $block      Block instance.
 */

defined( 'ABSPATH' ) || exit;

// Everything is escaped inside ReadAlso::render().
echo \ManTek\NewsroomBlocks\ReadAlso::render( $attributes, $block ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
