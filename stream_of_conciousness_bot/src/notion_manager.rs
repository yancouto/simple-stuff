use std::collections::{btree_map::Entry, BTreeMap};

use anyhow::Context;
use chrono::{DateTime, NaiveDate, NaiveTime, Timelike, Utc};
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
const CORRECT_TIMEZONE: chrono_tz::Tz = chrono_tz::America::Sao_Paulo;

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

    /// Multiple fixes to the date. First, considers the correct timezone.
    /// Then, considers the previous day if the time is before 6am (super reasonable for me).
    /// Finally, sets the time to 00:00:00 to work with notion, and goes back to Utc.
    fn fix_date(date: DateTime<Utc>) -> anyhow::Result<DateTime<Utc>> {
        let date = date.with_timezone(&CORRECT_TIMEZONE);
        if date.hour() < 6 {
            date - chrono::Duration::days(1)
        } else {
            date
        }
        .with_timezone(&Utc)
        .with_time(NaiveTime::MIN)
        .single()
        .context("Failed to set time")
    }

    /// First try to get the previously created page with same date. Otherwise, create a new one.
    /// Always cache in case we have multiple messages.
    async fn get_or_create_page(&mut self, date: DateTime<Utc>) -> Result<PageId, anyhow::Error> {
        let date = Self::fix_date(date)?;
        let entry = self.page_cache.entry(date.date_naive());
        Ok(match entry {
            Entry::Occupied(occupied_entry) => occupied_entry.get().clone(),
            Entry::Vacant(vacant_entry) => {
                let filters = vec![
                    FilterType::Property {
                        property: DATE.to_string(),
                        condition: PropertyCondition::Date(DateCondition::Equals(date)),
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
                    log::debug!(
                        "Found existing page with date: {}, url: {}",
                        date.date_naive(),
                        page.url
                    );
                    PageId(page.id)
                } else {
                    log::debug!("Creating new page with date: {}", date.date_naive());
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
                                    start: Some(DateOrDateTime::Date(date.date_naive())),
                                    end: None,
                                    time_zone: None,
                                }),
                            },
                        TITLE.to_string() =>
                            PageProperty::Title {
                                id: None,
                                title: vec![RichText::Text {
                                    text: Text {
                                        content: date.date_naive().to_string(),
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

    pub async fn set_mood(&mut self, mood: u8, date: DateTime<Utc>) -> Result<(), anyhow::Error> {
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

    pub async fn add_text(&mut self, text: &str, date: DateTime<Utc>) -> Result<(), anyhow::Error> {
        // TODO: This can be easily batched. I'm not sure yet at which level.
        log::trace!("Adding text to Notion: {}", text);
        let id = self.get_or_create_page(date).await?;
        let block = Block {
            block_type: BlockType::Paragraph {
                paragraph: ParagraphValue {
                    rich_text: vec![RichText::Text {
                        text: Text {
                            content: text.to_string(),
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
        };
        self.api
            .blocks
            .append_block_children(
                &id.0,
                AppendBlockChildrenRequestBuilder::default()
                    .children(vec![block])
                    .build()?,
            )
            .await?;
        Ok(())
    }
}
