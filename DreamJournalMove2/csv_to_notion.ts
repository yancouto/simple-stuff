import { parse } from "csv-parse/sync";
import fs from "fs";
import { Client } from "@notionhq/client";
import { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";

const filename = process.argv[2];

const dreams: string[][] = parse(fs.readFileSync(filename));
const notion = new Client({ auth: process.env.NOTION_KEY });
const database_id = process.env.DATABASE_ID!;

const d64 = (s: string) => {
    return Buffer.from(s, "base64").toString();
};

const basicText = (s: string) => {
    return [{
        text: {
            content: s
        }
    }];
};

const splitText = (s: string) => {
    return s.split("\n").flatMap(str => {
        str = str.trim();
        if (str.length > 2000) {
            // best effort
            let idx = str.indexOf(". ", 1000);
            return [str.substring(0, idx + 1), str.substring(idx + 2)];
        } else {
            return [str];
        }
    })
};

const validate = (ps: string[]) => {
    if (ps.length >= 100) {
        throw new Error("too many paragraphs");
    }
    for (const text of ps) {
        if (text.length > 2000) {
            throw new Error(`Paragraph too large (${text.length}): ${text}`);
        }
    }
}

const toMultiSelect = (s: string) => {
    return { multi_select: s.split("|").filter(name => name.length > 0).map(name => ({ name: name.replace(",", "") })) }
}

const skip = 0;

const requests: CreatePageParameters[] = dreams.splice(skip).map(dream => {

    const [title64, description64, date, lucidity, nightmare, tags64, people64, feelings64, places64] = dream;
    const paragraphs = splitText(d64(description64));
    validate(paragraphs);

    return {
        icon: {
            type: "emoji",
            emoji: "😴"
        },
        parent: {
            database_id,
        },
        properties: {
            title: {
                title: basicText(d64(title64).trim())
            },
            Date: {
                date: {
                    start: date.substring(0, 4) + "-" + date.substring(4, 6) + "-" + date.substring(6, 8),
                }
            },
            Nightmare: {
                checkbox: nightmare === "1"
            },
            Lucidity: {
                number: parseInt(lucidity)
            },
            Tags: toMultiSelect(d64(tags64)),
            People: toMultiSelect(d64(people64)),
            Feelings: toMultiSelect(d64(feelings64)),
            Places: toMultiSelect(d64(places64)),
        },
        children: [
            {
                paragraph: {
                    rich_text: paragraphs.map(str => ({
                        text: { content: str }
                    }))
                }
            }

        ]
    };
});

let count = skip;
for (const request of requests) {
    await notion.pages.create(request);
    count++;
    console.log(`${count}/${requests.length + skip}`)
}