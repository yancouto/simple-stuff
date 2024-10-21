use std::collections::{btree_map::Entry, BTreeMap};

use chrono::{DateTime, NaiveDate, Timelike, Utc};
use chrono_tz::America::Sao_Paulo;
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
        page::{DateOrDateTime, DatePropertyValue, PageProperty, SelectPropertyValue},
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
const STREAM_OF_CONSCIOUSNESS: &str = "Stream of conciousness";

impl NotionManager {
    pub async fn new() -> anyhow::Result<Self> {
        let api = Client::new(std::env::var("NOTION_TOKEN")?, None)?;
        let db_id = std::env::var("NOTION_DATABASE_ID")?;
        // I don't really need to fetch the full database here, but it's good to crash early.
        let db = api.databases.retrieve_a_database(&db_id).await?;
        log::info!(
            "Successfully accessed database: {}.",
            db.title
                .first()
                .and_then(|t| t.plain_text())
                .as_deref()
                .unwrap_or("unknown")
        );
        Ok(Self {
            api,
            db_id: DatabaseId(db_id),
            page_cache: BTreeMap::new(),
        })
    }

    fn fix_date(date: DateTime<Utc>) -> DateTime<Utc> {
        let date = date.with_timezone(&Sao_Paulo);
        if date.hour() < 6 {
            date - chrono::Duration::days(1)
        } else {
            date
        }
        .with_timezone(&Utc)
    }

    async fn get_or_create_page(&mut self, date: DateTime<Utc>) -> Result<PageId, anyhow::Error> {
        let date = Self::fix_date(date);
        let entry = self.page_cache.entry(date.date_naive());
        match entry {
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
                if let Some(page) = res.results.into_iter().next() {
                    Ok(PageId(page.id))
                } else {
                    let properties = BTreeMap::from([
                        (
                            TAGS.to_string(),
                            PageProperty::MultiSelect {
                                id: None,
                                multi_select: vec![SelectPropertyValue {
                                    name: Some(STREAM_OF_CONSCIOUSNESS.to_string()),
                                    color: None,
                                    id: None,
                                }],
                            },
                        ),
                        (
                            DATE.to_string(),
                            PageProperty::Date {
                                id: None,
                                date: Some(DatePropertyValue {
                                    start: Some(DateOrDateTime::Date(date.date_naive())),
                                    end: None,
                                    time_zone: None,
                                }),
                            },
                        ),
                    ]);
                    let page = self
                        .api
                        .pages
                        .create_a_page(
                            CreateAPageRequestBuilder::default()
                                .parent(Parent::DatabaseId {
                                    database_id: self.db_id.0.clone(),
                                })
                                .properties(properties)
                                .build()?,
                        )
                        .await?;

                    Ok(vacant_entry.insert(PageId(page.id)).clone())
                }
            }
            Entry::Occupied(occupied_entry) => Ok(occupied_entry.get().clone()),
        }
    }

    pub async fn set_mood(&mut self, mood: u8, date: DateTime<Utc>) -> Result<(), anyhow::Error> {
        log::trace!("Setting mood to Notion: {}", mood);
        let id = self.get_or_create_page(date).await?;
        self.api
            .pages
            .update_page_properties(
                &id.0,
                UpdatePagePropertiesRequestBuilder::default()
                    .properties(BTreeMap::from([(
                        MOOD.to_string(),
                        Some(PageProperty::Number {
                            id: None,
                            number: Some(mood.into()),
                        }),
                    )]))
                    .build()?,
            )
            .await?;
        Ok(())
    }

    pub async fn add_text(
        &mut self,
        text: String,
        date: DateTime<Utc>,
    ) -> Result<(), anyhow::Error> {
        // TODO: This can be easily batched. I'm not sure yet at which level.
        log::trace!("Adding text to Notion: {}", text);
        let id = self.get_or_create_page(date).await?;
        let block = Block {
            block_type: BlockType::Paragraph {
                paragraph: ParagraphValue {
                    rich_text: vec![RichText::Text {
                        text: Text {
                            content: text,
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
