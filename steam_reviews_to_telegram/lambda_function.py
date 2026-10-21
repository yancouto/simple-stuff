# Objective: Send new Steam reviews (from a list of games) to a Telegram chat via a Telegram bot.
# This is made to run using AWS Lambdas once per day. It uses SSM to keep track of the last sent review. It can easily be adapted to run locally.

from datetime import datetime, timezone
import html
import json
import os
import time
import urllib.parse
import urllib.request
import boto3
from botocore.exceptions import ClientError

# Configure your games here: {AppID: "Game Title"}
GAMES = {
    827940: "Marvellous Inc.",
    2716690: "Liquidum",
    1960330: "Alchemia: Creatio Ex Nihilo",
    1636730: "functional",
    1266390: "HookSharks",
    2601920: "At the Edge of the World",
}

TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]
SSM_PARAMETER_NAME = os.environ.get("SSM_PARAMETER_NAME", "/steam-review-bot/state")
STEAM_API_KEY = os.environ.get("STEAM_API_KEY", "")  # Optional

ssm = boto3.client("ssm")


def load_state() -> dict:
    """Loads {appid_str: last_timestamp_created} from AWS SSM Parameter Store."""
    try:
        resp = ssm.get_parameter(Name=SSM_PARAMETER_NAME)
        return json.loads(resp["Parameter"]["Value"])
    except ClientError as e:
        if e.response["Error"]["Code"] == "ParameterNotFound":
            return {}
        raise


def save_state(state: dict) -> None:
    """Saves {appid_str: last_timestamp_created} to AWS SSM Parameter Store."""
    ssm.put_parameter(
        Name=SSM_PARAMETER_NAME,
        Value=json.dumps(state),
        Type="String",
        Overwrite=True,
    )


def fetch_recent_reviews(appid: int, since_timestamp: int) -> list:
    """Fetches reviews created after since_timestamp using IUserReviewsService."""
    base_url = "https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/"
    new_reviews = []
    cursor = "*"
    seen_cursors = set()

    while cursor and cursor not in seen_cursors:
        seen_cursors.add(cursor)
        input_payload = {
            "appid": appid,
            "filter": 1,          # 1 = Most recently created
            "languages": ["all"], # Fetch reviews in all languages
            "purchase_type": 1,   # 1 = All purchases (Steam + Keys)
            "filter_offtopic_activity": False, # Includes off-topic / review-bomb activity
            "num_per_page": 100,
            "cursor": cursor,
        }

        params = {"input_json": json.dumps(input_payload)}
        if STEAM_API_KEY:
            params["key"] = STEAM_API_KEY

        url = f"{base_url}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={"User-Agent": "SteamReviewTelegramBot/1.0"})

        with urllib.request.urlopen(req, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8")).get("response", {})

        reviews = data.get("reviews", [])
        if not reviews:
            break

        reached_old_reviews = False
        for review in reviews:
            created = review.get("timestamp_created", 0)
            if created > since_timestamp:
                new_reviews.append(review)
            else:
                reached_old_reviews = True

        if reached_old_reviews:
            break

        cursor = data.get("cursor")

    # Sort chronologically (oldest to newest)
    new_reviews.sort(key=lambda r: r.get("timestamp_created", 0))
    return new_reviews


def format_telegram_message(game_name: str, appid: int, review: dict) -> str:
    """Formats a single review into an HTML-safe Telegram message."""
    voted_up = review.get("voted_up", False)
    verdict = "👍 Recommended" if voted_up else "👎 Not Recommended"
    
    playtime_minutes = review.get("author", {}).get("playtime_at_review", 0)
    playtime_hours = round(playtime_minutes / 60.0, 1)
    lang = review.get("language", "unknown")
    steamid = review.get("author", {}).get("steamid", "")
    rec_id = review.get("recommendationid", "")

    timestamp_created = review.get("timestamp_created")
    if timestamp_created:
        review_time = datetime.fromtimestamp(timestamp_created, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    else:
        review_time = "Unknown"

    flags = []
    if not review.get("steam_purchase", True):
        flags.append("Key/External")
    if review.get("received_for_free", False):
        flags.append("Free Copy")
    if review.get("primarily_steam_deck", False):
        flags.append("Steam Deck")
    if review.get("refunded", False):
        flags.append("Refunded")
    flag_str = f" ({', '.join(flags)})" if flags else ""

    raw_text = review.get("review", "").strip()
    # Telegram max message length is 4096 chars; cap review text at 3200 chars
    if len(raw_text) > 3200:
        raw_text = raw_text[:3200] + "..."
    safe_text = html.escape(raw_text) if raw_text else "<i>(No text)</i>"

    review_url = f"https://steamcommunity.com/profiles/{steamid}/recommended/{appid}/" if steamid else f"https://store.steampowered.com/app/{appid}/"

    return (
        f"<b>{html.escape(game_name)}</b> — {verdict}{flag_str}\n"
        f"📅 <b>Posted:</b> {review_time}\n"
        f"⏱ <b>Playtime:</b> {playtime_hours}h | 🌐 <b>Lang:</b> {html.escape(lang)}\n\n"
        f"{safe_text}\n\n"
        f"<a href=\"{review_url}\">View Review #{rec_id} on Steam</a>"
    )


def send_telegram_message(text: str) -> None:
    """Sends a message to the configured Telegram chat."""
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = json.dumps({
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        resp.read()


def lambda_handler(event, context):
    state = load_state()
    now_ts = int(time.time())
    state_updated = False
    total_found = 0
    total_sent = 0

    print(f"Starting review check for {len(GAMES)} game(s)...")

    for appid, game_name in GAMES.items():
        appid_key = str(appid)

        # On first run for a game, look back 30 days
        last_seen_ts = state.get(appid_key, now_ts - 30 * 86400)

        new_reviews = fetch_recent_reviews(appid, last_seen_ts)
        num_found = len(new_reviews)
        total_found += num_found

        if not new_reviews:
            # Ensure initial state is recorded even if no reviews arrived in the last 24h
            if appid_key not in state:
                state[appid_key] = last_seen_ts
                state_updated = True
            continue

        print(f"[{game_name} ({appid})] Found {num_found} new review(s).")

        for review in new_reviews:
            msg = format_telegram_message(game_name, appid, review)
            send_telegram_message(msg)
            total_sent += 1
            rec_id = review.get("recommendationid", "")
            print(f"[{game_name}] Sent review #{rec_id} to Telegram.")
            # Update timestamp after each message to prevent duplicates if a later send fails
            state[appid_key] = max(state.get(appid_key, 0), review.get("timestamp_created", 0))
            state_updated = True
            time.sleep(0.5)  # Respect Telegram rate limits

    if state_updated:
        save_state(state)

    summary = f"Review check completed. Total found: {total_found}, total sent: {total_sent}."
    print(summary)

    return {"statusCode": 200, "body": summary}
