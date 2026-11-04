<?php
/**
 * Front-end markup for the Live updates block.
 *
 * @package wp-newsroom-blocks
 *
 * @var array<string, mixed> $attributes Block attributes.
 * @var string               $content    The rendered entries.
 * @var WP_Block             $block      Block instance.
 */

// The entries arrive rendered; everything else is escaped inside LiveUpdates::render().
echo \ManTek\NewsroomBlocks\LiveUpdates::render( $attributes, $content, $block ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
