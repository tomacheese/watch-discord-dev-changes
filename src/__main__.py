import json

import requests

from src import load_notified_ids, add_notified_id, send_discord_message


def main():
    with open("config.json") as f:
        config = json.load(f)

    response = requests.get("https://raw.githubusercontent.com/discord/discord-api-docs/master/docs/Change_Log.md")
    lines = response.text.split("\n")

    contents = []
    title = None
    date = None
    texts = []
    for line in lines:
        if line.startswith("## "):
            if title is not None:
                contents.append({
                    "title": title,
                    "date": date,
                    "text": "\n".join(texts).strip()
                })
            title = line.lstrip("## ")
            texts = []
            continue

        if line.startswith("#### "):
            date = line.lstrip("#### ")
            continue

        if title is None:
            continue

        texts.append(line)

    notified_ids = load_notified_ids()
    isFirst = len(notified_ids) == 0

    for content in contents:
        article_id = content["title"] + " " + content["date"]
        if article_id in notified_ids:
            continue

        embed = {
            "title": content["title"] + " " + content["date"],
            "url": "https://discord.com/developers/docs/change-log#" + content["title"].lower().replace(" ", "-"),
            "description": "```markdown\n" + content["text"] + "\n```",
        }

        if not isFirst:
            send_discord_message(config["DISCORD_TOKEN"], config["DISCORD_CHANNEL_ID"], "", embed)

        add_notified_id(article_id)


if __name__ == "__main__":
    main()
