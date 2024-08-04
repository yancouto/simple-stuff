const { Client } = require('@notionhq/client');
const fs = require('fs');

const notion = new Client({ auth: process.env.NOTION_SECRET });
const database_id = "d1b26065577643a59d361f7dc4faa664"


async function main() {
    const page_names = fs.readFileSync("names.txt", 'utf8').split(/\r?\n/);
    for (const name of page_names) {
        console.log(`Creating page for ${name}...`)
        const newPage = await notion.pages.create({
            parent: {
                database_id: database_id,
            },
            properties: {
                Name: {
                    type: "title",
                    title: [{ type: "text", text: { content: name } }],
                }
            },
        })
    }
    console.log("Done!");
}

main()