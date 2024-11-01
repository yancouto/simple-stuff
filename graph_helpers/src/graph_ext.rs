use sorted_vec::SortedSet;

// SMALL_GRAPHS
type Idx = u16;
type NodeSet = SortedSet<Idx>;

#[derive(Debug, Default)]
pub struct Graph {
    adj: Vec<NodeSet>,
    mapping: Vec<Idx>,
}

impl Graph {
    pub fn n(&self) -> Idx {
        self.adj.len() as Idx
    }
    pub fn vertices_from(&self, from: Idx) -> impl Iterator<Item = Idx> {
        from..self.n()
    }
    pub fn vertices(&self) -> impl Iterator<Item = Idx> {
        self.vertices_from(0)
    }
    pub fn adj(&self, u: usize) -> &NodeSet {
        &self.adj[u]
    }
    pub fn min_degree(&self) -> usize {
        self.adj.iter().map(|neigh| neigh.len()).min().unwrap_or(0)
    }
    pub fn max_degree(&self) -> usize {
        self.adj.iter().map(|neigh| neigh.len()).max().unwrap_or(0)
    }
    pub fn induced(&self, nodes: &NodeSet) -> Self {
        let adj = nodes
            .iter()
            .map(|u| {
                self.adj(*u as usize)
                    .iter()
                    .filter(|v| nodes.binary_search(v).is_ok())
                    .copied()
                    .collect::<Vec<_>>()
                    .try_into()
                    .unwrap()
            })
            .collect();

        Self {
            adj,
            mapping: nodes.iter().map(|n| self.pretty(*n)).collect(),
        }
    }
    /// Pretty name for given node index. Respects mapping if there is one.
    pub fn pretty(&self, u: Idx) -> Idx {
        self.mapping.get(u as usize).copied().unwrap_or(u + 1)
    }
    pub fn print_edges(&self) {
        for u in self.vertices() {
            for v in self.adj(u as usize).iter().copied() {
                if v > u {
                    println!("{} {}", self.pretty(u), self.pretty(v));
                }
            }
        }
    }
}

impl From<genpet::Graph> for Graph {
    fn from(g: genpet::Graph) -> Self {
        let adj: Vec<NodeSet> = (0..g.n)
            .map(|u| {
                (0..g.n)
                    .filter_map(|v| {
                        if g.bit_vec[g.n * u + v] == 1 {
                            Some(v as Idx)
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<_>>()
                    .try_into()
                    .unwrap()
            })
            .collect();

        Self {
            adj,
            mapping: vec![],
        }
    }
}
