JavaScript Deobfuscator (DEPRECATED!)
=====================================

**IMPORTANT**: This extension is deprecated, it will not work in Firefox 57 and above. Providing comparable functionality in newer Firefox versions isn't possible.

JavaScript Deobfuscator is a Firefox extension that shows you what JavaScript code runs on a web page, even if it is obfuscated and generated on the fly. Simply open JavaScript Deobfuscator from the Web Developer menu and watch the scripts being compiled/executed. [Detailed description](https://palant.de/2009/02/13/javascript-deobfuscator)

Prerequisites
-------------
* [Python 2.7](https://www.python.org/downloads/)
* [Jinja2 module for Python](http://jinja.pocoo.org/docs/intro/#installation)

How to build
------------

Run the following command:

    python build.py build

This will create a development build with the file name like `jsdeobfuscator-1.2.3.nnnn.xpi`. In order to create a release build use the following command:

    python build.py build --release

How to test
-----------

Testing your changes is easiest if you install the [Extension Auto-Installer extension](https://addons.mozilla.org/addon/autoinstaller/). Then you can push the current repository state to your browser using the following command:

    python build.py autoinstall 8888

JavaScript Deobfuscator will be updated automatically, without any prompts or browser restarts.
