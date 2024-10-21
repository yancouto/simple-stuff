use teloxide::{
    prelude::*,
    requests::HasPayload,
    types::{AllowedUpdate, MediaKind, MediaText, MessageCommon, MessageKind, UpdateKind},
    utils::command::BotCommands,
};

mod commands;
mod notion_manager;

use commands::Command;

#[tokio::main]
async fn main() {
    poll_once().await.unwrap();
}

async fn poll_once() -> anyhow::Result<()> {
    pretty_env_logger::init_timed();
    log::info!("Polling all pending messages from bot...");

    let mut notion = notion_manager::NotionManager::new().await?;
    let bot = Bot::new(std::env::var("TELEGRAM_TOKEN")?);

    if std::env::var("SET_COMMANDS").is_ok() {
        log::info!("Setting commands using API");
        bot.set_my_commands(Command::bot_commands()).send().await?;
    }

    let mut any_update = false;
    let mut some_failures = false;

    let mut off = None;

    let all_failure = loop {
        let updates = bot
            .get_updates()
            .with_payload_mut(|p| {
                p.offset = off;
                p.allowed_updates = Some(vec![AllowedUpdate::Message]);
            })
            .send()
            .await?;

        off = updates.last().map(|u| u.id.as_offset());

        let cmds: Vec<_> = updates
            .into_iter()
            .flat_map(|update| {
                if let UpdateKind::Message(Message {
                    date,
                    kind:
                        MessageKind::Common(MessageCommon {
                            media_kind: MediaKind::Text(MediaText { text, .. }),
                            ..
                        }),
                    ..
                }) = update.kind
                {
                    Some((Command::parse_or_text(text), date))
                } else {
                    log::info!("Not a text message: {:?}", update);
                    None
                }
            })
            .collect();

        if !any_update && !cmds.is_empty() {
            // Let's fail fast if we can't talk to Notion at all.
            notion.check_can_access_database().await?;
            any_update = true;
        }
        let (suc, tot) = Command::handle(&bot, cmds, &mut notion).await?;
        some_failures = some_failures || suc < tot;
        // No updates
        if off.is_none() {
            break false;
        // If everything failed, Notion is likely down, let's not ack the messages
        // and hope it works later.
        } else if suc == 0 {
            break true;
        }
    };

    if all_failure {
        anyhow::bail!("All messages failed, will try again later.")
    } else if some_failures {
        anyhow::bail!("Some errors occurred, but some successes, continuing.")
    } else {
        Ok(())
    }
}
