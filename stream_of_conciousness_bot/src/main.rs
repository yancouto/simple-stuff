use teloxide::{
    prelude::*,
    requests::HasPayload,
    types::{AllowedUpdate, MediaKind, MediaText, MessageCommon, MessageKind, UpdateKind},
    utils::command::BotCommands,
    RequestError,
};

#[tokio::main]
async fn main() {
    poll_once().await.unwrap();
}

async fn poll_once() -> anyhow::Result<()> {
    pretty_env_logger::init_timed();
    log::info!("Polling all pending messages from bot...");

    let bot = Bot::from_env();
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
                kind:
                    MessageKind::Common(MessageCommon {
                        media_kind: MediaKind::Text(MediaText { text, .. }),
                        ..
                    }),
                ..
            }) = &update.kind
            {
                msg_count += 1;
                let res = Command::parse(text, "")
                    .unwrap_or_else(|_| Command::Text(text.clone()))
                    .handler(&bot)
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

#[derive(BotCommands, Clone, Debug)]
#[command(
    rename_rule = "lowercase",
    description = "These commands are supported:"
)]
enum Command {
    #[command(description = "display this text.")]
    Help,
    #[command(description = "your current mood in a 0-100 scale.")]
    Mood(u8),
    #[command(hide)]
    Text(String),
}

impl Command {
    async fn handler(self, bot: &Bot) -> ResponseResult<()> {
        log::error!("AAA: {:?}", self);
        if let Self::Text(text) = self {
            if text == "P" {
                return Ok(());
            }
        }
        Err(RequestError::Io(std::io::Error::other("dang")))
    }
}
