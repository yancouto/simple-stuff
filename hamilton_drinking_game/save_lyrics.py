import os
from lyricsgenius import Genius

genius = Genius(open(".genius_token", "r").read())

album = genius.search_album("Hamilton: An American Musical")
assert album is not None
album.save_lyrics("all_lyrics")
