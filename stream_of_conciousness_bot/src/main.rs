use teloxide::{
    prelude::*,
    requests::HasPayload,
    types::{AllowedUpdate, MediaKind, MediaText, MessageCommon, MessageKind, UpdateKind},
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
    let mut msg_count = 0;
    let mut success_count = 0;

    let mut off = None;

    loop {
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

        if msg_count == 0 && !cmds.is_empty() {
            // Let's fail fast if we can't talk to Notion at all.
            notion.check_can_access_database().await?;
        }
        msg_count += cmds.len();
        let cur_success_count = Command::handle(&bot, cmds, &mut notion).await?;
        success_count += cur_success_count;
        // If everything failed, Notion is likely down, let's not ack the messages
        // and hope it works later.
        if off.is_none() || cur_success_count == 0 {
            break;
        }
    }

    if success_count == msg_count {
        Ok(())
    } else if success_count > 0 {
        anyhow::bail!("Some errors occurred, but some successes, continuing.")
    } else {
        anyhow::bail!("All messages failed, will try again later.")
    }
}
