use chrono::{DateTime, Utc};
use teloxide::{utils::command::BotCommands, Bot};

use crate::notion_manager::NotionManager;

#[derive(BotCommands, Clone, Debug)]
#[command(
    rename_rule = "lowercase",
    description = "These commands are supported:"
)]
pub enum Command {
    #[command(description = "your current mood in a 0-100 scale.")]
    Mood(u8),
    #[command(hide)]
    Text(String),
}

impl Command {
    pub fn parse_or_text(text: String) -> Self {
        Self::parse(&text, "").unwrap_or_else(|_| Self::Text(text))
    }
    pub async fn handle(
        _bot: &Bot,
        cmds: Vec<(Command, DateTime<Utc>)>,
        notion: &mut NotionManager,
    ) -> anyhow::Result<usize> {
        let mut success = 0;
        for (cmd, date) in cmds {
            let res = match &cmd {
                Self::Mood(mood) => notion.set_mood(*mood, date).await,
                Self::Text(text) => notion.add_text(text, date).await,
            };
            if let Err(e) = &res {
                log::error!("Error handling command: {:?}, error: {:?}", cmd, e);
            } else {
                success += 1;
            }
        }
        Ok(success)
    }
}
