const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_SECRET });
const database_id = "2b235148e7fd4b6997d49ff4a78aeeab"

async function main() {
    let start_cursor = undefined;
    while (true) {
        const response = await notion.databases.query({
            database_id,
            page_size: 10,
            filter: {
                property: "Date",
                date: {
                    is_empty: true
                }
            },
            start_cursor,
        });
        for (const page of response.results) {
            if (page.object == "page") {
                console.log(`Updating page ${page.url}`);
                const start = page.created_time.substring(0, page.created_time.indexOf("T"))
                await notion.pages.update({
                    page_id: page.id,
                    properties: {
                        "Date": {
                            date: {
                                start,
                            }
                        }
                    }
                });
            }
        }
        start_cursor = response.next_cursor;
        if (!response.has_more) {
            break;
        }
    }
    console.log("Done!");
}

main()