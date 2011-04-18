/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is JavaScript Deobfuscator.
 *
 * The Initial Developer of the Original Code is
 * Wladimir Palant.
 * Portions created by the Initial Developer are Copyright (C) 2009-2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

window.addEventListener("load", function()
{
  for each (let menuitem in [document.getElementById("jsdeobfuscator-menuitem"), document.getElementById("appmenu_jsdeobfuscator")])
  {
    if (!menuitem)
      continue;

    menuitem.addEventListener("command", function()
    {
      let wnd = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                          .getService(Components.interfaces.nsIWindowMediator)
                          .getMostRecentWindow("jsdeobfuscator:main");
      if (wnd)
        wnd.focus();
      else
        window.openDialog("chrome://jsdeobfuscator/content/jsdeobfuscator.xul", "_blank", "chrome,resizable,centerscreen,dialog=no");
    }, false);
  }
}, false);
