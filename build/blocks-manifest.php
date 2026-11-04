<?php
// This file is generated. Do not modify it manually.
return array(
	'breaking-news' => array(
		'$schema' => 'https://schemas.wp.org/trunk/block.json',
		'apiVersion' => 3,
		'name' => 'mantek/breaking-news',
		'version' => '0.9.0',
		'title' => 'Breaking news bar',
		'category' => 'newsroom',
		'description' => 'A scrolling strip of the latest headlines from a category. It disappears by itself when nothing new has been published.',
		'keywords' => array(
			'ticker',
			'breaking',
			'urgent',
			'headlines'
		),
		'textdomain' => 'wp-newsroom-blocks',
		'attributes' => array(
			'label' => array(
				'type' => 'string',
				'default' => ''
			),
			'categoryId' => array(
				'type' => 'integer',
				'default' => 0
			),
			'count' => array(
				'type' => 'integer',
				'default' => 5
			),
			'maxAgeHours' => array(
				'type' => 'integer',
				'default' => 24
			),
			'speed' => array(
				'type' => 'integer',
				'default' => 60
			)
		),
		'supports' => array(
			'html' => false,
			'align' => array(
				'wide',
				'full'
			),
			'interactivity' => true,
			'color' => array(
				'background' => true,
				'text' => true,
				'link' => true
			),
			'spacing' => array(
				'margin' => true,
				'padding' => true
			),
			'typography' => array(
				'fontSize' => true
			)
		),
		'editorScript' => 'file:./index.js',
		'editorStyle' => 'file:./index.css',
		'style' => 'file:./style-index.css',
		'viewScriptModule' => 'file:./view.js',
		'render' => 'file:./render.php'
	),
	'live-update' => array(
		'$schema' => 'https://schemas.wp.org/trunk/block.json',
		'apiVersion' => 3,
		'name' => 'mantek/live-update',
		'version' => '0.9.0',
		'title' => 'Live update',
		'category' => 'newsroom',
		'parent' => array(
			'mantek/live-updates'
		),
		'description' => 'One timestamped entry in a live blog.',
		'textdomain' => 'wp-newsroom-blocks',
		'attributes' => array(
			'timestamp' => array(
				'type' => 'integer',
				'default' => 0
			),
			'important' => array(
				'type' => 'boolean',
				'default' => false
			)
		),
		'supports' => array(
			'html' => false,
			'reusable' => false,
			'interactivity' => true
		),
		'editorScript' => 'file:./index.js',
		'render' => 'file:./render.php'
	),
	'live-updates' => array(
		'$schema' => 'https://schemas.wp.org/trunk/block.json',
		'apiVersion' => 3,
		'name' => 'mantek/live-updates',
		'version' => '0.9.0',
		'title' => 'Live updates',
		'category' => 'newsroom',
		'description' => 'A live blog: timestamped updates, newest first, which readers see arrive without reloading the page.',
		'keywords' => array(
			'live blog',
			'breaking',
			'coverage',
			'minute by minute'
		),
		'textdomain' => 'wp-newsroom-blocks',
		'attributes' => array(
			'isLive' => array(
				'type' => 'boolean',
				'default' => true
			),
			'pollInterval' => array(
				'type' => 'integer',
				'default' => 30
			)
		),
		'usesContext' => array(
			'postId'
		),
		'supports' => array(
			'html' => false,
			'multiple' => false,
			'anchor' => true,
			'interactivity' => true,
			'color' => array(
				'background' => true,
				'text' => true
			),
			'spacing' => array(
				'margin' => true,
				'padding' => true
			)
		),
		'editorScript' => 'file:./index.js',
		'editorStyle' => 'file:./index.css',
		'style' => 'file:./style-index.css',
		'viewScriptModule' => 'file:./view.js',
		'render' => 'file:./render.php'
	),
	'read-also' => array(
		'$schema' => 'https://schemas.wp.org/trunk/block.json',
		'apiVersion' => 3,
		'name' => 'mantek/read-also',
		'version' => '0.9.0',
		'title' => 'Read also',
		'category' => 'newsroom',
		'description' => 'Points readers to related articles you choose, right inside the story.',
		'keywords' => array(
			'related',
			'links',
			'see also',
			'more'
		),
		'textdomain' => 'wp-newsroom-blocks',
		'attributes' => array(
			'postIds' => array(
				'type' => 'array',
				'items' => array(
					'type' => 'integer'
				),
				'default' => array(
					
				)
			),
			'heading' => array(
				'type' => 'string',
				'default' => ''
			),
			'showThumbnails' => array(
				'type' => 'boolean',
				'default' => false
			)
		),
		'usesContext' => array(
			'postId'
		),
		'supports' => array(
			'html' => false,
			'color' => array(
				'background' => true,
				'text' => true,
				'link' => true
			),
			'spacing' => array(
				'margin' => true,
				'padding' => true
			),
			'typography' => array(
				'fontSize' => true,
				'lineHeight' => true
			)
		),
		'example' => array(
			
		),
		'editorScript' => 'file:./index.js',
		'editorStyle' => 'file:./index.css',
		'style' => 'file:./style-index.css',
		'render' => 'file:./render.php'
	),
	'timeline' => array(
		'$schema' => 'https://schemas.wp.org/trunk/block.json',
		'apiVersion' => 3,
		'name' => 'mantek/timeline',
		'version' => '0.9.0',
		'title' => 'Story timeline',
		'category' => 'newsroom',
		'description' => 'Shows how a story unfolded, one dated event after another.',
		'keywords' => array(
			'timeline',
			'chronology',
			'events',
			'sequence'
		),
		'textdomain' => 'wp-newsroom-blocks',
		'supports' => array(
			'html' => false,
			'anchor' => true,
			'align' => array(
				'wide'
			),
			'color' => array(
				'background' => true,
				'text' => true
			),
			'spacing' => array(
				'margin' => true,
				'padding' => true
			),
			'typography' => array(
				'fontSize' => true
			)
		),
		'example' => array(
			'innerBlocks' => array(
				array(
					'name' => 'mantek/timeline-event',
					'attributes' => array(
						'label' => '08:30',
						'heading' => 'Polls open'
					),
					'innerBlocks' => array(
						array(
							'name' => 'core/paragraph',
							'attributes' => array(
								'content' => 'Queues form early at stations across the city.'
							)
						)
					)
				),
				array(
					'name' => 'mantek/timeline-event',
					'attributes' => array(
						'label' => '20:00',
						'heading' => 'Counting begins'
					)
				)
			)
		),
		'editorScript' => 'file:./index.js',
		'style' => 'file:./style-index.css'
	),
	'timeline-event' => array(
		'$schema' => 'https://schemas.wp.org/trunk/block.json',
		'apiVersion' => 3,
		'name' => 'mantek/timeline-event',
		'version' => '0.9.0',
		'title' => 'Timeline event',
		'category' => 'newsroom',
		'parent' => array(
			'mantek/timeline'
		),
		'description' => 'One dated moment in a story timeline.',
		'textdomain' => 'wp-newsroom-blocks',
		'attributes' => array(
			'datetime' => array(
				'type' => 'string',
				'default' => ''
			),
			'label' => array(
				'type' => 'string',
				'source' => 'html',
				'selector' => '.wp-block-mantek-timeline-event__time',
				'default' => ''
			),
			'heading' => array(
				'type' => 'string',
				'source' => 'html',
				'selector' => '.wp-block-mantek-timeline-event__heading',
				'default' => ''
			)
		),
		'supports' => array(
			'html' => false,
			'reusable' => false
		),
		'editorScript' => 'file:./index.js'
	)
);
