I used these scripts to move my dream journal from the "Lucidity" app to Notion.

The file `LucidityToCsv.java` reads the backup format from lucidity and converts it to some CSV, where some fields use base 64 encoding (I didn't use JSON or normal CSV libs because it would need extra dependencies).

Then we read this CSV with the `csv_to_notion.js` file and call Notion's API.