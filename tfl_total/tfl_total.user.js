// ==UserScript==
// @name         Add up expenses in TFL
// @namespace    https://github.com/yancouto/simple-stuff/tree/master/tfl_total
// @version      0.1
// @author       Yan Couto
// @match        https://contactless.tfl.gov.uk/NewStatements/Billing*
// @require http://code.jquery.com/jquery-latest.js
// ==/UserScript==

(function() {
    'use strict';

    console.log("Running TFL sum script")
    $(document).on('DOMNodeInserted', () => {
        let statement = $('.col-md-12 > ').filter(function() { return $(this).text() === "Statement"; });
        let values = statement.parent().find('.travelstatement-billingdetail-priceheading').map((a, b) => b.innerText);
        let total = [...values].reduce((a, b) => {
            let m = b.match(/£(\d+(.\d+)?)/);
            if (m) {
                return a + parseFloat(m[1]);
            } else {
                return a;
            }
        }, 0.0);
        statement.prepend(`<p> Total: £${total.toFixed(2)} </p>`);
    });
})();
