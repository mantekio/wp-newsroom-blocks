=== ManTek Newsroom Blocks ===
Contributors: WPORG_USERNAME
Tags: live blog, breaking news, newsroom, rtl, arabic
Requires at least: 6.8
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 0.9.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Newsroom blocks built right to left first: a breaking news bar, Read also, a story timeline and a live blog that updates without reloading.

== Description ==

Four editorial blocks for WordPress newsrooms, built right to left first. They are written for Arabic and English from the start, so in Arabic the layout mirrors, the ticker scrolls the other way, and every count uses the right one of Arabic's six plural forms, with no theme work.

= Breaking news bar =

A scrolling strip of the newest headlines from a category you choose. It shows only posts from the last few hours (24 by default) and disappears by itself when there is nothing that recent, so nobody has to remember to take it down. Readers can pause it or close it. It pauses on hover and keyboard focus, and stands still for readers who ask their system for reduced motion.

= Read also =

A box of up to five related articles, picked by searching in the editor and put in any order. An article that is later unpublished or deleted simply drops out, and a story never links to itself.

= Story timeline =

How a story unfolded, one dated event after another. Each event has a date picker that fills in a label editors can rewrite ("Morning", "Day 2"), a heading and free content. It is saved as plain HTML with machine-readable dates, so it outlives the plugin.

= Live updates =

A live blog. Editors add timestamped updates, newest on top, and can mark key updates. Readers see each update's time and a "how long ago" label that keeps counting. When new updates are published, readers who have the page open get a "Show 2 new updates" button that brings them in without reloading the page. Turning off "Coverage is live" tells readers that coverage has ended and stops the checking, on pages they already have open too.

= Right to left, built in =

* The layout mirrors in Arabic and other right-to-left languages, with no separate styles to maintain.
* The breaking news bar scrolls in the reading direction.
* An Arabic translation is included, written for Arabic readers rather than translated word for word, with all six plural forms.
* Labels use Western digits, as WordPress itself does in Arabic.

= Built for busy sites =

* The live blog asks a small endpoint how many updates are newer than the ones on the page. Its answer is public and cached for 15 seconds, so during a big story a CDN can answer most readers.
* "Show new updates" fetches a fresh copy of the page, which a page cache cannot have kept from before the update.
* Checking pauses while the tab is hidden, and stops once coverage ends.

= Privacy =

The plugin sends nothing to any outside service, sets no cookies and stores nothing in the reader's browser. Readers' browsers ask only your own site for new updates.

= Source code =

The blocks ship compiled. Their source code, the build tools and the tests are on GitHub: https://github.com/mantekio/wp-newsroom-blocks

== Installation ==

1. In your WordPress admin, go to Plugins > Add New Plugin and search for "ManTek Newsroom Blocks".
2. Install and activate it.
3. In the block editor, find the four blocks in the inserter under "Newsroom".

The plugin needs WordPress 6.8 or later and PHP 8.1 or later.

== Frequently Asked Questions ==

= Does it work with a page cache or a CDN? =

Yes. The live blog's check for new updates is cached for 15 seconds, so a CDN can take most of that traffic. To show new updates, the page fetches a fresh copy of itself with the newest update's time in the address, so the cache needs to key on the full address, query string included. A cache set to ignore query strings keeps serving the copy from before the update until it expires.

= Does it work in Arabic and other right-to-left languages? =

Yes. The layout mirrors in any right-to-left language, and an Arabic translation is included. Translations into other languages are welcome on translate.wordpress.org.

= What happens to my content if I remove the plugin? =

The story timeline is saved as plain HTML, so it stays as it is. Live updates stay as ordinary paragraphs, images and other blocks, without their times. The breaking news bar and Read also are built when the page is shown, so they disappear.

= Can I use it on a multisite network? =

Yes. It can be activated on a single site or across the whole network, and its translations load either way.

= Can I change the time of an update? =

Yes. Each update gets its time when it first has content, and the "Change the time" button in its toolbar sets another.

= How often does the live blog check for new updates? =

Every 30 seconds by default, and every 15 seconds at most. You can change it in the block's Coverage settings. Checking stops when you turn off "Coverage is live".

== Screenshots ==

1. A story with all four blocks: the breaking news bar, Read also, the story timeline and the live blog.
2. The same story in the other reading direction.
3. Two updates are published while a reader has the page open, and the reader is offered them.
4. The new updates come in at the top without a reload, the key update marked.
5. The live blog in the editor, with its Coverage settings.

== Changelog ==

= 0.9.0 =

* First release: the breaking news bar, Read also, the story timeline and live updates, built right to left first, with an Arabic translation.
