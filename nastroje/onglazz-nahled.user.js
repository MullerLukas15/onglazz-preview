// ==UserScript==
// @name         OnGlazz – test živého náhledu
// @namespace    onglazz-preview
// @version      0.2
// @description  Na stránkách produktů onglazz.cz načte náhled z hostingu (jen ve vašem prohlížeči)
// @match        https://onglazz.cz/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function(){var s=document.createElement('script');s.src='https://mullerlukas15.github.io/onglazz-preview/test.js?v='+Date.now();document.head.appendChild(s)})();
