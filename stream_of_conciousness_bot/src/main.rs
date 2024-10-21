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
    let mut error_count = 0;

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

        let mut any_success = false;

        for update in updates {
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
                msg_count += 1;
                let res = Command::parse_or_text(text)
                    .handle(&bot, date, &mut notion)
                    .await;
                if let Err(e) = res {
                    log::error!("Error handling command: {:?}", e);
                    error_count += 1;
                } else {
                    any_success = true;
                }
            } else {
                log::info!("Not a text message: {:?}", update);
            }
        }
        // If everything failed, notion is likely down, let's not ack the messages.
        if off.is_none() || !any_success {
            break;
        }
    }

    if error_count == 0 {
        Ok(())
    } else if error_count < msg_count {
        anyhow::bail!("Some errors occurred, but some successes, continuing.")
    } else {
        anyhow::bail!("All messages failed, will try again later.")
    }
}
