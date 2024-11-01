use std::ops::Deref;

use petgraph::{prelude::*, Undirected};
use sorted_vec::SortedSet;

type Idx = u32;
type NodeIndex = petgraph::prelude::NodeIndex<Idx>;
type NodeList = SortedSet<NodeIndex>;
type PetGraph = petgraph::Graph<(), (), Undirected, Idx>;

#[derive(Debug, Default)]
pub struct Graph {
    inner: PetGraph,
    mapping: Vec<Idx>,
}

impl Graph {
    pub fn min_degree(&self) -> usize {
        self.node_indices()
            .map(|node| self.neighbors(node).count())
            .min()
            .unwrap_or(0)
    }
    pub fn max_degree(&self) -> usize {
        self.node_indices()
            .map(|node| self.neighbors(node).count())
            .max()
            .unwrap_or(0)
    }
    pub fn induced(&self, nodes: &NodeList) -> Self {
        let mut inner = PetGraph::with_capacity(nodes.len(), nodes.len());

        for _ in nodes.iter() {
            inner.add_node(());
        }
        for (u_i, u) in nodes.iter().enumerate() {
            for v in self.neighbors(*u) {
                if let Ok(v_i) = nodes.binary_search(&v) {
                    if v_i > u_i {
                        inner.add_edge(NodeIndex::new(u_i), NodeIndex::new(v_i), ());
                    }
                }
            }
        }

        Self {
            inner,
            mapping: nodes.iter().map(|n| self.pretty(*n)).collect(),
        }
    }
    /// Pretty name for given node index. Respects mapping if there is one.
    pub fn pretty(&self, u: NodeIndex) -> Idx {
        self.mapping
            .get(u.index())
            .copied()
            .unwrap_or(u.index() as Idx)
    }
    pub fn print_edges(&self) {
        for edge in self.edge_references() {
            println!(
                "{} {}",
                self.pretty(edge.source()),
                self.pretty(edge.target())
            );
        }
    }
}

impl Deref for Graph {
    type Target = PetGraph;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl From<PetGraph> for Graph {
    fn from(inner: PetGraph) -> Self {
        Self {
            inner,
            mapping: Default::default(),
        }
    }
}
