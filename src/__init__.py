import json
import os

import requests


def send_discord_message(token: str, channelId: str, message: str = "", embed: dict = None):
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bot {token}".format(token=token),
        "User-Agent": "Bot"
    }
    params = {
        "content": message,
        "embed": embed
    }
    requests.post(
        "https://discord.com/api/channels/{channelId}/messages".format(channelId=channelId), headers=headers,
        json=params)

def load_notified_ids() -> list:
    notified_ids = []
    if os.path.exists("notified_ids.json"):
        with open("notified_ids.json", "r") as f:
            notified_ids = json.load(f)
    return notified_ids


def add_notified_id(notified_id):
    notified_ids = load_notified_ids()
    notified_ids.append(notified_id)
    save_notified_ids(notified_ids)


def save_notified_ids(notified_ids: list):
    with open("notified_ids.json", "w") as f:
        f.write(json.dumps(notified_ids))
