<?php
/**
 * Demo content for ManTek Newsroom Blocks, written in the site's language (English or Arabic):
 * a Breaking category with fresh headlines, two related articles, and one story that uses all four blocks.
 *
 * Run by the Playground blueprints in demo/ and tests/e2e/. The news is invented.
 *
 * @package mantek-newsroom-blocks
 */

declare( strict_types = 1 );

namespace ManTek\NewsroomBlocks\Demo;

// Playground keeps WordPress at this fixed path, and WordPress is not loaded yet, so no helper can build it.
require_once '/wordpress/wp-load.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.NotAbsolutePath

/**
 * Creates the demo content.
 */
function seed(): void {
	$arabic = str_starts_with( get_locale(), 'ar' );
	$copy   = $arabic ? array(
		'breaking'  => 'عاجل',
		'headlines' => array(
			'استئناف محادثات وقف إطلاق النار'              => 20,
			'المصرف المركزي يُبقي أسعار الفائدة دون تغيير' => 50,
			'تحذير من عاصفة على الساحل'                    => 90,
		),
		'related'   => array( 'كيف يجري فرز الأصوات', 'خمسة أمور ينبغي معرفتها قبل يوم الاقتراع' ),
		'title'     => 'ليلة الانتخابات: تغطية مباشرة',
		'author'    => 'غرفة الأخبار',
		'section'   => 'الانتخابات',
		'intro'     => 'بدأ فرز الأصوات بعد يوم شهد إقبالاً كبيراً على مراكز الاقتراع في أنحاء المدينة.',
		'timeline'  => 'كيف جرى اليوم',
		'events'    => array(
			array( 'T08:30', '08:30', 'فتح مراكز الاقتراع', 'تشكّلت طوابير مبكرة أمام مراكز الاقتراع.' ),
			array( 'T14:00', '14:00', 'نسبة المشاركة تتجاوز النصف', 'أعلنت اللجنة أن المشاركة تخطّت 50 في المئة.' ),
			array( 'T20:00', '20:00', 'بدء الفرز', 'أُغلقت الصناديق وبدأ العدّ.' ),
		),
		'live'      => 'مباشر',
		'updates'   => array(
			3  => 'النتائج الأولية من الدائرة الأولى تُظهر تقدّماً طفيفاً للمرشح المستقل.',
			25 => 'اللجنة تتوقع إعلان النتائج الرسمية خلال ساعات.',
			70 => 'وصول أول صناديق الاقتراع إلى مركز الفرز الرئيسي.',
		),
		'paragraph' => 'تفاصيل الخبر.',
	) : array(
		'breaking'  => 'Breaking',
		'headlines' => array(
			'Ceasefire talks resume'             => 20,
			'Central bank holds rates steady'    => 50,
			'Storm warning issued for the coast' => 90,
		),
		'related'   => array( 'How the vote count works', 'Five things to know before polling day' ),
		'title'     => 'Election night: live coverage',
		'author'    => 'Newsroom',
		'section'   => 'Elections',
		'intro'     => 'Counting is under way after a day of high turnout at polling stations across the city.',
		'timeline'  => 'How the day unfolded',
		'events'    => array(
			array( 'T08:30', '08:30', 'Polls open', 'Queues formed early outside polling stations.' ),
			array( 'T14:00', '14:00', 'Turnout passes half', 'The commission said turnout was above 50 per cent.' ),
			array( 'T20:00', '20:00', 'Counting begins', 'Ballot boxes were sealed and the count started.' ),
		),
		'live'      => 'Live',
		'updates'   => array(
			3  => 'First results from district one show a narrow lead for the independent candidate.',
			25 => 'The commission expects official results within hours.',
			70 => 'The first ballot boxes reach the main counting centre.',
		),
		'paragraph' => 'The full story.',
	);

	$paragraph = static fn ( string $text ): string => "<!-- wp:paragraph -->\n<p>" . esc_html( $text ) . "</p>\n<!-- /wp:paragraph -->";
	$heading   = static fn ( string $text ): string => "<!-- wp:heading -->\n<h2 class=\"wp-block-heading\">" . esc_html( $text ) . "</h2>\n<!-- /wp:heading -->";

	$category = term_exists( 'breaking', 'category' );
	if ( ! $category ) {
		$category = wp_insert_term( $copy['breaking'], 'category', array( 'slug' => 'breaking' ) );
	}
	$category_id = (int) $category['term_id'];

	$now = time();
	foreach ( $copy['headlines'] as $title => $minutes_ago ) {
		wp_insert_post(
			array(
				'post_title'    => $title,
				'post_status'   => 'publish',
				'post_category' => array( $category_id ),
				'post_date_gmt' => gmdate( 'Y-m-d H:i:s', $now - $minutes_ago * MINUTE_IN_SECONDS ),
				'post_content'  => $paragraph( $copy['paragraph'] ),
			)
		);
	}

	$related = array();
	foreach ( $copy['related'] as $title ) {
		$related[] = wp_insert_post(
			array(
				'post_title'   => $title,
				'post_status'  => 'publish',
				'post_content' => $paragraph( $copy['paragraph'] ),
			)
		);
	}

	// The timeline is a static block, so its markup must match what the editor saves.
	$today  = wp_date( 'Y-m-d' );
	$events = '';
	foreach ( $copy['events'] as list( $time, $label, $title, $text ) ) {
		$events .= sprintf(
			"<!-- wp:mantek/timeline-event {\"datetime\":\"%1\$s\"} -->\n<li class=\"wp-block-mantek-timeline-event\"><time class=\"wp-block-mantek-timeline-event__time\" datetime=\"%1\$s\">%2\$s</time><h3 class=\"wp-block-mantek-timeline-event__heading\">%3\$s</h3><div class=\"wp-block-mantek-timeline-event__content\">%4\$s</div></li>\n<!-- /wp:mantek/timeline-event -->\n\n",
			$today . $time,
			esc_html( $label ),
			esc_html( $title ),
			$paragraph( $text )
		);
	}

	$updates = '';
	foreach ( $copy['updates'] as $minutes_ago => $text ) {
		$updates .= sprintf(
			"<!-- wp:mantek/live-update {\"timestamp\":%d} -->\n%s\n<!-- /wp:mantek/live-update -->\n\n",
			$now - $minutes_ago * MINUTE_IN_SECONDS,
			$paragraph( $text )
		);
	}

	$content = implode(
		"\n\n",
		array(
			sprintf( '<!-- wp:mantek/breaking-news {"categoryId":%d,"maxAgeHours":48} /-->', $category_id ),
			$paragraph( $copy['intro'] ),
			sprintf( '<!-- wp:mantek/read-also {"postIds":[%s]} /-->', implode( ',', $related ) ),
			$heading( $copy['timeline'] ),
			"<!-- wp:mantek/timeline -->\n<ol class=\"wp-block-mantek-timeline\">" . $events . "</ol>\n<!-- /wp:mantek/timeline -->",
			$heading( $copy['live'] ),
			"<!-- wp:mantek/live-updates {\"pollInterval\":15} -->\n" . $updates . '<!-- /wp:mantek/live-updates -->',
		)
	);

	// A byline and a section, so the theme's post meta reads like a real story's.
	$author = username_exists( 'newsroom' );
	if ( ! $author ) {
		$author = wp_insert_user(
			array(
				'user_login'   => 'newsroom',
				'user_pass'    => wp_generate_password( 24 ),
				'user_email'   => 'newsroom@example.com',
				'display_name' => $copy['author'],
				'role'         => 'author',
			)
		);
	}
	$section = term_exists( 'elections', 'category' );
	if ( ! $section ) {
		$section = wp_insert_term( $copy['section'], 'category', array( 'slug' => 'elections' ) );
	}

	wp_insert_post(
		array(
			'post_title'    => $copy['title'],
			'post_name'     => 'election-night',
			'post_status'   => 'publish',
			'post_author'   => is_wp_error( $author ) ? 0 : (int) $author,
			'post_category' => array( (int) $section['term_id'] ),
			'post_content'  => $content,
		)
	);
}

seed();
