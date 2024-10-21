use std::{
    collections::{btree_map::Entry, BTreeMap, BTreeSet},
    usize,
};

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

pub struct NotionManager {
    api: Client,
    db_id: DatabaseId,
    page_cache: BTreeMap<NaiveDate, Page>,
    people: BTreeSet<String>,
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
pub enum NotionCommand {
    Mood(u8, NaiveDate),
    /// Note that the NaiveTime might actually be from the next day.
    Text(Vec<(String, NaiveTime)>, NaiveDate),
    People(Vec<String>, NaiveDate),
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
            (
                Some(NotionCommand::People(people1, date1)),
                NotionCommand::People(people2, date2),
            ) if date1 == date2 => {
                let combined: Vec<_> = people1.into_iter().chain(people2).collect();
                Ok(NotionCommand::People(combined, date1))
            }
            (Some(a), b) => Err((a, b)),
        }
    }

    pub async fn execute(&self, notion: &mut NotionManager) -> Result<(), anyhow::Error> {
        match self {
            Self::Mood(mood, date) => notion.set_mood(*mood, *date).await,
            Self::Text(texts, date) => notion.add_text(texts, *date).await,
            Self::People(people, date) => notion.add_people(people, *date).await,
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
            people: BTreeSet::new(),
        })
    }

    pub async fn check_can_access_database(&mut self) -> anyhow::Result<()> {
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
        Ok(())
    }

    /// First try to get the previously created page with same date. Otherwise, create a new one.
    /// Always cache in case we have multiple messages.
    async fn get_or_create_page<'a>(
        &'a mut self,
        date: NaiveDate,
    ) -> Result<&'a Page, anyhow::Error> {
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
                    page
                };
                vacant_entry.insert(id)
            }
        })
    }

    fn find_person<'a>(&'a self, name: &'a str) -> Option<&'a str> {
        if self.people.contains(name) {
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

    pub async fn add_people(
        &mut self,
        people: &[String],
        date: NaiveDate,
    ) -> Result<(), anyhow::Error> {
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

    pub async fn set_mood(&mut self, mood: u8, date: NaiveDate) -> Result<(), anyhow::Error> {
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
    ) -> Result<(), anyhow::Error> {
        log::trace!("Adding text to Notion: {:?}", all_text);
        let id = self.get_or_create_page(date).await?.id.clone();
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
                &id,
                AppendBlockChildrenRequestBuilder::default()
                    .children(blocks)
                    .build()?,
            )
            .await?;
        Ok(())
    }
}
