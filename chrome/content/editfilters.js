/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

var result;

function start()
{
  for each (let type in ["include", "exclude"])
  {
    document.getElementById(type).value = window.arguments[0][type].join("\n");
    document.getElementById(type).setSelectionRange(0, 0);
  }
  result = window.arguments[1];
}

function saveFilters()
{
  for each (let type in ["include", "exclude"])
  {
    result[type] = document.getElementById(type).value
                           .split("\n")
                           .map(function(prefix) prefix.replace(/\s/g, ""))
                           .filter(function(prefix) prefix);
  }
}
