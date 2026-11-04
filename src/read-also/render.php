<?php
/**
 * Front-end markup for the Read also block.
 *
 * @package wp-newsroom-blocks
 *
 * @var array<string, mixed> $attributes Block attributes.
 * @var WP_Block             $block      Block instance.
 */

// Everything is escaped inside ReadAlso::render().
echo \ManTek\NewsroomBlocks\ReadAlso::render( $attributes, $block ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
