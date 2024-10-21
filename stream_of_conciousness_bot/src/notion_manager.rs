use std::collections::{btree_map::Entry, BTreeMap};

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
        emoji::Emoji,
        page::{DateOrDateTime, DatePropertyValue, Icon, PageProperty, SelectPropertyValue},
        parent::Parent,
        rich_text::{RichText, Text},
    },
};
#[derive(Clone)]
struct PageId(String);
#[derive(Clone)]
struct DatabaseId(String);

pub struct NotionManager {
    api: Client,
    db_id: DatabaseId,
    page_cache: BTreeMap<NaiveDate, PageId>,
}

const MOOD: &str = "Mood";
const TAGS: &str = "Tags";
const DATE: &str = "Date";
const TITLE: &str = "title"; // Default and lowercase in notion
const STREAM_OF_CONSCIOUSNESS: &str = "Stream of conciousness";
/// The day actually changes at 6am.
pub const HOUR_CUT_TO_NEXT_DAY: u32 = 6;

#[derive(Debug)]
pub enum NotionCommand {
    Mood(u8, NaiveDate),
    /// Note that the NaiveTime might actually be from the next day.
    Text(Vec<(String, NaiveTime)>, NaiveDate),
}

impl NotionCommand {
    pub fn try_merge(maybe_self: Option<Self>, other: Self) -> Result<Self, (Self, Self)> {
        match (maybe_self, other) {
            (None, other) => Ok(other),
            (Some(NotionCommand::Mood(mood1, date1)), NotionCommand::Mood(mood2, date2))
                if date1 == date2 =>
            {
                Ok(NotionCommand::Mood(mood1.min(mood2), date1))
            }
            (Some(NotionCommand::Text(text1, date1)), NotionCommand::Text(text2, date2))
                if date1 == date2 =>
            {
                let combined: Vec<_> = text1.into_iter().chain(text2).collect();
                Ok(NotionCommand::Text(combined, date1))
            }
            (Some(a), b) => Err((a, b)),
        }
    }

    pub async fn execute(&self, notion: &mut NotionManager) -> Result<(), anyhow::Error> {
        match self {
            NotionCommand::Mood(mood, date) => notion.set_mood(*mood, *date).await,
            NotionCommand::Text(texts, date) => notion.add_text(texts, *date).await,
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
        let api = Client::new(std::env::var("NOTION_TOKEN")?, None)?;
        let db_id = std::env::var("NOTION_DATABASE_ID")?;
        Ok(Self {
            api,
            db_id: DatabaseId(db_id),
            page_cache: BTreeMap::new(),
        })
    }

    pub async fn check_can_access_database(&self) -> anyhow::Result<()> {
        let db = self
            .api
            .databases
            .retrieve_a_database(&self.db_id.0)
            .await?;
        log::info!(
            "Successfully accessed database: {}.",
            db.title
                .first()
                .context("Database has no title")?
                .plain_text()
                .context("Title is not plain text")?
        );
        Ok(())
    }

    /// First try to get the previously created page with same date. Otherwise, create a new one.
    /// Always cache in case we have multiple messages.
    async fn get_or_create_page(&mut self, date: NaiveDate) -> Result<PageId, anyhow::Error> {
        let entry = self.page_cache.entry(date);
        Ok(match entry {
            Entry::Occupied(occupied_entry) => occupied_entry.get().clone(),
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
                    PageId(page.id)
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
                    let page = self
                        .api
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
                        .await?;

                    PageId(page.id)
                };
                vacant_entry.insert(id).clone()
            }
        })
    }

    pub async fn set_mood(&mut self, mood: u8, date: NaiveDate) -> Result<(), anyhow::Error> {
        log::trace!("Setting mood to Notion: {}", mood);
        let id = self.get_or_create_page(date).await?;
        self.api
            .pages
            .update_page_properties(
                &id.0,
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
    ) -> Result<(), anyhow::Error> {
        log::trace!("Adding text to Notion: {:?}", all_text);
        let id = self.get_or_create_page(date).await?;
        let blocks = all_text
            .into_iter()
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
                &id.0,
                AppendBlockChildrenRequestBuilder::default()
                    .children(blocks)
                    .build()?,
            )
            .await?;
        Ok(())
    }
}