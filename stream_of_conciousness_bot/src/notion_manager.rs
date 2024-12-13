use std::collections::{btree_map::Entry, BTreeMap, BTreeSet};

use anyhow::Context;
use chrono::{NaiveDate, NaiveTime};
use maplit::btreemap;
use notion_client::{
    endpoints::{
        blocks::append::request::AppendBlockChildrenRequestBuilder,
        databases::query::request::{
            DateCondition, Filter, FilterType, MultiSelectCondition, PropertyCondition,
            QueryDatabaseRequestBuilder,
        },
        pages::{
            create::request::CreateAPageRequestBuilder,
            update::request::UpdatePagePropertiesRequestBuilder,
        },
        Client,
    },
    objects::{
        block::{Block, BlockType, ParagraphValue},
        database::DatabaseProperty,
        emoji::Emoji,
        page::{DateOrDateTime, DatePropertyValue, Icon, Page, PageProperty, SelectPropertyValue},
        parent::Parent,
        rich_text::{RichText, Text},
    },
};
use unidecode::unidecode;
#[derive(Clone)]
struct DatabaseId(String);

pub struct NotionManagerForUser {
    api: Client,
    initialized: bool,
    db_id: DatabaseId,
    page_cache: BTreeMap<NaiveDate, Page>,
    people: BTreeSet<String>,
}

pub struct NotionManager {
    per_username: BTreeMap<String, NotionManagerForUser>,
}

const MOOD: &str = "Mood";
const TAGS: &str = "Tags";
const DATE: &str = "Date";
const TITLE: &str = "title"; // Default and lowercase in notion
const PEOPLE: &str = "Pessoas";
const STREAM_OF_CONSCIOUSNESS: &str = "Stream of conciousness";
/// The day actually changes at 6am.
pub const HOUR_CUT_TO_NEXT_DAY: u32 = 6;

#[derive(Debug)]
pub enum InnerCommand {
    Mood(u8),
    /// Note that the NaiveTime might actually be from the next day.
    Text(Vec<(String, NaiveTime)>),
    People(Vec<String>),
}

#[derive(Debug)]
pub struct NotionCommand {
    pub date: NaiveDate,
    pub username: String,
    pub inner: InnerCommand,
}

impl NotionCommand {
    #[allow(clippy::result_large_err)]
    pub fn try_merge(maybe_self: Option<Self>, other: Self) -> Result<Self, (Self, Self)> {
        use InnerCommand::*;
        use NotionCommand as C;
        match (maybe_self, other) {
            (None, other) => Ok(other),
            (Some(a), b) if a.date != b.date || a.username != b.username => Err((a, b)),
            (
                Some(C {
                    date,
                    username,
                    inner: inner1,
                }),
                C {
                    inner: inner2,
                    username: u2,
                    ..
                },
            ) => {
                match match (inner1, inner2) {
                    (Mood(mood1), Mood(mood2)) => Ok(Mood(mood1.min(mood2))),
                    (Text(text1), Text(text2)) => {
                        Ok(Text(text1.into_iter().chain(text2).collect()))
                    }
                    (People(people1), People(people2)) => {
                        Ok(People(people1.into_iter().chain(people2).collect()))
                    }
                    (a, b) => Err((a, b)),
                } {
                    Ok(inner) => Ok(C {
                        date,
                        username,
                        inner,
                    }),
                    Err((inner1, inner2)) => Err((
                        C {
                            date,
                            username,
                            inner: inner1,
                        },
                        C {
                            date,
                            username: u2,
                            inner: inner2,
                        },
                    )),
                }
            }
        }
    }

    pub async fn execute(&self, notion: &mut NotionManager) -> anyhow::Result<()> {
        let date = self.date;
        let notion = notion.user(&self.username)?;
        match &self.inner {
            &InnerCommand::Mood(mood) => notion.set_mood(mood, date).await,
            InnerCommand::Text(texts) => notion.add_text(texts, date).await,
            InnerCommand::People(people) => notion.add_people(people, date).await,
        }
    }

    /// Returns wheter it was a success
    pub async fn execute_or_log(&self, notion: &mut NotionManager) -> bool {
        if let Err(e) = self.execute(notion).await {
            log::error!("Error handling command: {:?}, error: {:?}", self, e);
            false
        } else {
            true
        }
    }
}

impl NotionManager {
    pub async fn new() -> anyhow::Result<Self> {
        let usernames = std::env::var("TELEGRAM_USERNAMES")?;
        let tokens = std::env::var("NOTION_TOKENS")?;
        let db_ids = std::env::var("NOTION_DATABASE_IDS")?;
        Ok(Self {
            per_username: usernames
                .split(',')
                .zip(tokens.split(','))
                .zip(db_ids.split(','))
                .map(|((username, token), db_id)| {
                    Ok((
                        username.to_string(),
                        NotionManagerForUser {
                            api: Client::new(token.to_string(), None)?,
                            initialized: false,
                            db_id: DatabaseId(db_id.to_string()),
                            page_cache: BTreeMap::new(),
                            people: BTreeSet::new(),
                        },
                    ))
                })
                .collect::<anyhow::Result<_>>()?,
        })
    }

    pub fn user(&mut self, username: &str) -> anyhow::Result<&mut NotionManagerForUser> {
        self.per_username.get_mut(username).context("Unknown user")
    }

    pub fn user_is_known(&self, username: &str) -> bool {
        self.per_username.contains_key(username)
    }

    pub async fn check_can_access_database(
        &mut self,
        usernames: BTreeSet<&str>,
    ) -> anyhow::Result<()> {
        for username in usernames {
            self.user(username)?.check_can_access_database().await?;
        }
        Ok(())
    }
}

impl NotionManagerForUser {
    async fn check_can_access_database(&mut self) -> anyhow::Result<()> {
        if self.initialized {
            return Ok(());
        }
        let db = self
            .api
            .databases
            .retrieve_a_database(&self.db_id.0)
            .await?;
        if let Some(DatabaseProperty::MultiSelect { multi_select, .. }) = db.properties.get(PEOPLE)
        {
            for opt in &multi_select.options {
                self.people.insert(opt.name.clone());
            }
        } else {
            anyhow::bail!("Database has no people");
        }
        log::info!(
            "Successfully accessed database: {}.",
            db.title
                .first()
                .context("Database has no title")?
                .plain_text()
                .context("Title is not plain text")?
        );
        self.initialized = true;
        Ok(())
    }

    /// First try to get the previously created page with same date. Otherwise, create a new one.
    /// Always cache in case we have multiple messages.
    async fn get_or_create_page(&mut self, date: NaiveDate) -> Result<&Page, anyhow::Error> {
        let entry = self.page_cache.entry(date);
        Ok(match entry {
            Entry::Occupied(occupied_entry) => occupied_entry.into_mut(),
            Entry::Vacant(vacant_entry) => {
                let filters = vec![
                    FilterType::Property {
                        property: DATE.to_string(),
                        condition: PropertyCondition::Date(DateCondition::Equals(
                            date.and_time(NaiveTime::MIN).and_utc(),
                        )),
                    },
                    FilterType::Property {
                        property: TAGS.to_string(),
                        condition: PropertyCondition::MultiSelect(MultiSelectCondition::Contains(
                            STREAM_OF_CONSCIOUSNESS.to_string(),
                        )),
                    },
                ];
                let res = self
                    .api
                    .databases
                    .query_a_database(
                        &self.db_id.0,
                        QueryDatabaseRequestBuilder::default()
                            .filter(Filter::And { and: filters })
                            .build()?,
                    )
                    .await?;
                let id = if let Some(page) = res.results.into_iter().next() {
                    log::debug!("Found existing page with date: {}, url: {}", date, page.url);
                    page
                } else {
                    log::debug!("Creating new page with date: {}", date);
                    let properties = btreemap! {
                        TAGS.to_string() =>
                            PageProperty::MultiSelect {
                                id: None,
                                multi_select: vec![SelectPropertyValue {
                                    name: Some(STREAM_OF_CONSCIOUSNESS.to_string()),
                                    color: None,
                                    id: None,
                                }],
                            },
                        DATE.to_string() =>
                            PageProperty::Date {
                                id: None,
                                date: Some(DatePropertyValue {
                                    start: Some(DateOrDateTime::Date(date)),
                                    end: None,
                                    time_zone: None,
                                }),
                            },
                        TITLE.to_string() =>
                            PageProperty::Title {
                                id: None,
                                title: vec![RichText::Text {
                                    text: Text {
                                        content: date.to_string(),
                                        link: None,
                                    },
                                    annotations: None,
                                    plain_text: None,
                                    href: None,
                                }],
                            },
                    };
                    self.api
                        .pages
                        .create_a_page(
                            CreateAPageRequestBuilder::default()
                                .parent(Parent::DatabaseId {
                                    database_id: self.db_id.0.clone(),
                                })
                                .properties(properties)
                                .icon(Icon::Emoji(Emoji {
                                    emoji: "💭".to_string(),
                                }))
                                .build()?,
                        )
                        .await?
                };
                vacant_entry.insert(id)
            }
        })
    }

    fn find_person(&self, name: &str) -> Option<&str> {
        if let Some(name) = self.people.get(name) {
            return Some(name);
        }
        let (mut min_dist, mut which) = (usize::MAX, None);
        let name = unidecode(name).to_ascii_lowercase();
        for person in &self.people {
            let lower_person = unidecode(person).to_ascii_lowercase();
            let dist = lower_person
                .split_whitespace()
                .chain(std::iter::once(lower_person.as_str()))
                .map(|p| edit_distance::edit_distance(name.as_str(), p))
                .min()
                .unwrap_or(usize::MAX);
            if dist < min_dist && (dist == 0 || dist < 4.min(name.len().saturating_sub(3))) {
                min_dist = dist;
                which = Some(person.as_str());
            } else if dist == min_dist {
                which = None; // Ambiguous
            }
        }
        if which.is_none() {
            log::warn!("Didn't find person: {}", name);
        }
        which
    }

    pub async fn add_people(&mut self, people: &[String], date: NaiveDate) -> anyhow::Result<()> {
        log::trace!("Adding people: {:?}", people);
        let people: Vec<String> = people
            .iter()
            .filter_map(|p| self.find_person(p))
            .map(ToString::to_string)
            .collect();
        let page = self.get_or_create_page(date).await?;
        let all_people: BTreeSet<String> =
            if let Some(PageProperty::MultiSelect { multi_select, .. }) =
                page.properties.get(PEOPLE)
            {
                multi_select
                    .iter()
                    .filter_map(|p| p.name.clone())
                    .chain(people)
                    .collect()
            } else {
                anyhow::bail!("Page has no people property")
            };
        let multi_select = all_people
            .into_iter()
            .map(|name| SelectPropertyValue {
                name: Some(name),
                id: None,
                color: None,
            })
            .collect();
        let id = page.id.clone();
        self.api
            .pages
            .update_page_properties(
                &id,
                UpdatePagePropertiesRequestBuilder::default()
                    .properties(btreemap! {
                        PEOPLE.to_string() =>
                            Some(PageProperty::MultiSelect {
                                id: None,
                                // TODO: Show errors to user.
                                multi_select,
                            }),
                    })
                    .build()?,
            )
            .await?;
        Ok(())
    }

    pub async fn set_mood(&mut self, mood: u8, date: NaiveDate) -> anyhow::Result<()> {
        let mood = mood.clamp(0, 100);
        log::trace!("Setting mood to Notion: {}", mood);
        let id = self.get_or_create_page(date).await?.id.clone();
        self.api
            .pages
            .update_page_properties(
                &id,
                UpdatePagePropertiesRequestBuilder::default()
                    .properties(btreemap! {
                        MOOD.to_string() =>
                            Some(PageProperty::Number {
                                id: None,
                                number: Some(mood.into()),
                            }),
                    })
                    .build()?,
            )
            .await?;
        Ok(())
    }

    pub async fn add_text(
        &mut self,
        all_text: &[(String, NaiveTime)],
        date: NaiveDate,
    ) -> anyhow::Result<()> {
        log::trace!("Adding text to Notion: {:?}", all_text);
        let id = self.get_or_create_page(date).await?.id.clone();
        let blocks = all_text
            .iter()
            .map(|(text, time)| Block {
                block_type: BlockType::Paragraph {
                    paragraph: ParagraphValue {
                        rich_text: vec![RichText::Text {
                            text: Text {
                                content: format!("[{}] {}", time.format("%H:%M"), text),
                                link: None,
                            },
                            annotations: None,
                            plain_text: None,
                            href: None,
                        }],
                        ..Default::default()
                    },
                },
                ..Default::default()
            })
            .collect();
        self.api
            .blocks
            .append_block_children(
                &id,
                AppendBlockChildrenRequestBuilder::default()
                    .children(blocks)
                    .build()?,
            )
            .await?;
        Ok(())
    }
}
