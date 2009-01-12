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
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var EXPORTED_SYMBOLS = ["isEnabled", "toggleEnabled"];

var debuggerService = Components.classes["@mozilla.org/js/jsd/debugger-service;1"]
                                .getService(Components.interfaces.jsdIDebuggerService);
var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                               .getService(Components.interfaces.nsIConsoleService);

var ioServ = Components.classes["@mozilla.org/network/io-service;1"]
                       .getService(Components.interfaces.nsIIOService);
var dirServ = Components.classes["@mozilla.org/file/directory_service;1"]
                        .getService(Components.interfaces.nsIProperties);
function getDirURL(key)
{
  try
  {
    let file = dirServ.get(key, Components.interfaces.nsIFile);
    return ioServ.newFileURI(file).spec.toLowerCase().replace(/\/+/g, "/");
  }
  catch (e)
  {
    return null;
  }
}
var appDir = getDirURL("GreD");
var profDir = getDirURL("ProfD");

var enabled = false;
var debuggerWasOn = false;

function isEnabled()
{
  return enabled;
}

function toggleEnabled()
{
  enabled = !enabled;

  if (enabled)
  {
    debuggerService.scriptHook = scriptHook;
    debuggerWasOn = debuggerService.isOn;
    if (!debuggerWasOn)
      debuggerService.on();
  }
  else
  {
    debuggerService.scriptHook = null;
    if (!debuggerWasOn)
      debuggerService.off();
  }
}

var scriptHook =
{
  onScriptCreated: function(script)
  {
    // Ignore chrome scripts and anything executed in browser dir/profile
    let fileName = script.fileName.toLowerCase().replace(/\/+/g, "/");
    if (fileName.indexOf("chrome:/") == 0 ||
        (appDir && fileName.indexOf(appDir) == 0) ||
        (profDir && fileName.indexOf(profDir) == 0))
    {
      return;
    }

    consoleService.logStringMessage("Script compiled (@" + script.fileName + ":" + script.baseLineNumber + "):\n\n" + script.functionSource);
  },
  onScriptDestroyed: function(script)
  {
  },
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.jsdIScriptHook])
}
