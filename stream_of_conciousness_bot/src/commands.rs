use chrono::{DateTime, NaiveDate, NaiveTime, Timelike, Utc};
use teloxide::{utils::command::BotCommands, Bot};

use crate::notion_manager::{InnerCommand, NotionCommand, NotionManager, HOUR_CUT_TO_NEXT_DAY};

#[derive(BotCommands, Clone, Debug)]
#[command(
    rename_rule = "lowercase",
    description = "These commands are supported:"
)]
pub enum Command {
    #[command(description = "your current mood in a 0-100 scale.")]
    Mood(u8),
    #[command(description = "people you mention", aliases = ["people", "mention"])]
    Person(String),
    #[command(hide)]
    Text(String),
}

impl Command {
    pub fn parse_or_text(text: String) -> Self {
        Self::parse(&text, "").unwrap_or(Self::Text(text))
    }

    /// Multiple fixes to the date. First, considers the correct timezone.
    /// Then, considers the previous day if the time is before 6am (super reasonable for me).
    fn fix_date(date: DateTime<Utc>) -> (NaiveDate, NaiveTime) {
        const CORRECT_TIMEZONE: chrono_tz::Tz = chrono_tz::America::Sao_Paulo;
        let date = date.with_timezone(&CORRECT_TIMEZONE);
        let datetime = if date.hour() < HOUR_CUT_TO_NEXT_DAY {
            date - chrono::Duration::days(1)
        } else {
            date
        }
        .naive_local();
        // Separated to make it less confusing as it might actually be from the next day.
        (datetime.date(), datetime.time())
    }

    pub async fn handle(
        _bot: &Bot,
        cmds: Vec<(Command, String, DateTime<Utc>)>,
        notion: &mut NotionManager,
    ) -> anyhow::Result<(usize, usize)> {
        let mut success = 0;
        let mut total = 0;
        let mut pending_cmd = None;
        for (cmd, username, date) in cmds {
            let (date, time) = Self::fix_date(date);
            let inner = match cmd {
                Self::Mood(mood) => InnerCommand::Mood(mood),
                Self::Text(text) => InnerCommand::Text(vec![(text, time)]),
                Self::Person(person) => {
                    InnerCommand::People(person.split(',').map(|s| s.trim().to_string()).collect())
                }
            };
            let new_cmd = NotionCommand {
                inner,
                username,
                date,
            };
            match NotionCommand::try_merge(pending_cmd.take(), new_cmd) {
                Ok(cmd) => pending_cmd = Some(cmd),
                Err((old, new)) => {
                    total += 1;
                    success += old.execute_or_log(notion).await as usize;
                    pending_cmd = Some(new);
                }
            }
        }
        if let Some(cmd) = pending_cmd {
            total += 1;
            success += cmd.execute_or_log(notion).await as usize;
        }
        Ok((success, total))
    }
}
