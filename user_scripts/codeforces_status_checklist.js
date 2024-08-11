// ==UserScript==
// @name         Submission status checklist
// @namespace    https://codeforces.com
// @version      2024-08-10
// @description  Use to be able to "remove" each entry from the status of the submissions of a contest. For example, to easily track which Approved problems you already gave baloons too. Don't forget to change the "match" section of this script.
// @author       marcoskwkm
// @match        https://codeforces.com/gym/CHANGE_HERE/status
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        none
// ==/UserScript==

(function() {

const getProcessed = () => JSON.parse(localStorage.getItem('processed') ?? '[]')
const getRows = () => [...document.querySelector('.status-frame-datatable > tbody:nth-child(1)').children].slice(1)

const filter = () => {
    const processed = getProcessed()
    const s = new Set(processed)
    console.log(s)
    getRows().forEach((x) => {
        const id = x.getAttribute('data-submission-id')
        s.has(id) && x.remove()
    })
}

const process = (x) => {
    const processed = getProcessed()
    processed.push(x.toString())
    localStorage.setItem('processed', JSON.stringify(processed))
    filter()
}

const run = () => {
    const processed = getProcessed()
    const s = new Set(processed)
    getRows().forEach((x) => {
        const id = x.getAttribute('data-submission-id')
        const el = document.createElement('td')
        const button = document.createElement('button')
        button.innerText = 'remove'
        button.onclick = () => process(id)
        el.appendChild(button)
        x.appendChild(el)
    })
    filter()

    setInterval(() => location.reload(), 10000)
}

run()
})();
