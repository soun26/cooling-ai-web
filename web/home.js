'use strict';
const $=id=>document.getElementById(id);
function text(tag,value){const el=document.createElement(tag);el.textContent=value;return el;}
// Keep an incoming private invitation in the fragment, never send it to assets.
const invitation=new URLSearchParams(location.hash.slice(1)).get('access')||sessionStorage.getItem('research-access');
if(invitation){sessionStorage.setItem('research-access',invitation);$('research-link').hash=new URLSearchParams({access:invitation}).toString();}
