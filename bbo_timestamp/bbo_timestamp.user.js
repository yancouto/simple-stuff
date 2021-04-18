// ==UserScript==
// @name         BBO chat timestamp
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Add timestamps to chats in BBO
// @author       Yan Couto
// @match        https://www.bridgebase.com/v3/
// @grant        none
// @require http://code.jquery.com/jquery-latest.js
// ==/UserScript==

(function () {
    'use strict';

    console.log("Running BBO script 8");
    $(document).on('DOMNodeInserted', () => {
        const now = new Date();
        $('chat-list-item').filter(function () { return $('.bbotimestamp', this).length == 0; }).prepend(`<p class="bbotimestamp">${now}</p>`);
    });
})();