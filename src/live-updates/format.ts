/**
 * Locale-aware labels for the live blog, shared by the front end and the unit tests.
 */

/**
 * Numbers that cover every plural category CLDR defines. Must match LiveUpdates::PLURAL_SAMPLES in PHP.
 */
export const PLURAL_SAMPLES = [ 0, 1, 2, 3, 11, 100 ] as const;

/**
 * The page language, with Western digits requested.
 *
 * WordPress prints Western digits in every locale, so the browser does too,
 * and the labels it writes match the ones the server rendered.
 *
 * @param lang A BCP 47 language tag, such as the `lang` attribute of `<html>`.
 */
export function withWesternDigits( lang: string ): string {
	const tag = lang.trim() || 'en';
	return tag.includes( '-u-' ) ? tag : `${ tag }-u-nu-latn`;
}

/**
 * "5 minutes ago" in the page language, rounded the way a reader would say it.
 *
 * @param timestamp Unix time of the update.
 * @param now       Current Unix time.
 * @param locale    Locale for Intl.
 */
export function formatRelative(
	timestamp: number,
	now: number,
	locale: string
): string {
	const seconds = timestamp - now;
	const elapsed = Math.abs( seconds );
	const format = new Intl.RelativeTimeFormat( locale, { numeric: 'auto' } );

	if ( elapsed < 45 ) {
		return format.format( 0, 'second' );
	}
	if ( elapsed < 45 * 60 ) {
		return format.format( Math.round( seconds / 60 ), 'minute' );
	}
	if ( elapsed < 22 * 3600 ) {
		return format.format( Math.round( seconds / 3600 ), 'hour' );
	}
	return format.format( Math.round( seconds / 86400 ), 'day' );
}

/**
 * Picks the translated "Show %s new updates" label in the right plural form and fills in the count.
 *
 * The server sends one label per sample number. The browser finds the sample in the same
 * plural category as the real count, which gives every language, Arabic's six forms included,
 * its correct form without a JavaScript translation file.
 *
 * @param labels Labels keyed by sample number, each containing %s.
 * @param count  Number of new updates.
 * @param locale Locale for Intl.
 */
export function pluralLabel(
	labels: Readonly< Record< string, string > >,
	count: number,
	locale: string
): string {
	const rules = new Intl.PluralRules( locale );
	const category = rules.select( count );
	const sample =
		PLURAL_SAMPLES.find( ( n ) => rules.select( n ) === category ) ?? 100;
	const template = labels[ String( sample ) ] ?? labels[ '100' ] ?? '%s';
	return template.replace(
		'%s',
		new Intl.NumberFormat( locale ).format( count )
	);
}
