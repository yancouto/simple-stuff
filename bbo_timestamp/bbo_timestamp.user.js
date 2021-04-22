// ==UserScript==
// @name         BBO chat timestamp
// @namespace    https://github.com/yancouto/simple-stuff/tree/master/bbo_timestamp
// @version      1.0
// @description  Add timestamps to chats in BBO
// @author       Yan Couto
// @match        https://www.bridgebase.com/v3/*
// @require http://code.jquery.com/jquery-latest.js
// ==/UserScript==

const zeroPad = (num) => String(num).padStart(2, '0')

function genTimestamp() {
    const now = new Date();
    return `[${zeroPad(now.getHours())}:${zeroPad(now.getMinutes())}:${zeroPad(now.getSeconds())}]`;
}

(function () {
    'use strict';

    console.log("Running BBO timestamp script");
    $(document).on('DOMNodeInserted', () => {
        const now = genTimestamp();
        $('chat-list-item').filter(function () { return $('.bbotimestamp', this).length == 0; }).prepend(`<span class="bbotimestamp">${now} </span>`);
    });
})();
