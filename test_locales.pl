#!/usr/bin/perl

use strict;
use warnings;
use lib qw(buildtools);

$0 =~ s/(.*[\\\/])//g;
chdir($1) if $1;

system("hg", "clone", "https://hg.adblockplus.org/buildtools/") unless -e "buildtools";

require LocaleTester;

my %paths = (
  jsd => 'chrome/locale',
);

my @mustDiffer = (
  ['jsd:jsdeobfuscator:clear.accesskey', 'jsd:jsdeobfuscator:pause.accesskey', 'jsd:jsdeobfuscator:editFilters.accesskey', 'jsd:jsdeobfuscator:resetFilters.accesskey'],
  ['jsd:jsdeobfuscator:copyCmd.accesskey', 'jsd:jsdeobfuscator:copyLinkCmd.accesskey', 'jsd:jsdeobfuscator:selectAllCmd.accesskey', 'jsd:jsdeobfuscator:findCmd.accesskey'],
);

my @ignoreUntranslated = (
  quotemeta("jsd:jsdeobfuscator:window.title"),
  quotemeta("jsd:overlay:menuitem.label"),
  quotemeta("jsd:scriptList:url.label"),
  quotemeta("jsd:meta:name"),
);

my %lengthRestrictions = (
  'jsd:meta:description.short' => 250,
);

LocaleTester::testLocales(
  paths => \%paths,
  locales => \@ARGV,
  mustDiffer => \@mustDiffer,
  ignoreUntranslated => \@ignoreUntranslated,
  lengthRestrictions => \%lengthRestrictions,
);
