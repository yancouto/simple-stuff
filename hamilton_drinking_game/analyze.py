import json
import re

print(
    """Analysis of the Hamilton Drinking Game variants.
"self-self": How many times a song says its own name
"other-self": How many times a song says another songs name.
"self-other": How many times a songs name is said in another song.
"""
)


def clean_title(t: str):
    t = t.lower()
    for end in ["(reprise)", "#1", "#2"]:
        t = t.removesuffix(end).strip()
    if t.endswith(")"):
        [a, b] = t.split("(")
        return [a.strip().replace("’", "'"), b[:-1].replace("’", "'")]
    return [t.replace("’", "'")]


def clean_lyric(track: dict) -> str:
    title = track["song"]["title"]
    title_lyrics = f"{title} Lyrics"
    lyrics = track["song"]["lyrics"]
    pos = lyrics.find(title_lyrics)
    assert pos != -1
    return re.sub(
        r"\[[^\]]+\]",
        "",
        lyrics[pos + len(title_lyrics) :].strip().lower().replace("’", "'"),
    )


data = json.load(open("all_lyrics.json"))

longest_title = max(len(t["song"]["title"]) for t in data["tracks"])
titles = [clean_title(t["song"]["title"]) for t in data["tracks"]]
self_other_count = [0 for _ in titles]

for i in range(len(titles)):
    for j, track2 in enumerate(data["tracks"]):
        if i == j or titles[i] == titles[j]:
            continue
        lyrics = clean_lyric(track2)
        self_other_count[i] += sum(lyrics.count(s) for s in titles[i])

self_self_total = 0
other_self_total = 0
self_other_total = sum(self_other_count)

for self_other, track in zip(self_other_count, data["tracks"]):
    title: str = track["song"]["title"]
    search_terms = clean_title(title)
    lyrics: str = clean_lyric(track)
    self_self = sum(lyrics.count(s) for s in search_terms)
    other_self = sum(
        lyrics.count(s) for sts in titles for s in sts if sts != search_terms
    )
    print(
        f"{title.ljust(longest_title)}: self-self {self_self:3} other-self {other_self:3} self-other {self_other:3}"
    )
    self_self_total += self_self
    other_self_total += other_self

total = "Total"
print(
    f"\n{total.ljust(longest_title)}: self-self {self_self_total:3} other-self {other_self_total:3} self-other {self_other_total:3}"
)
# other_self_total and self_other_total should be the same.
