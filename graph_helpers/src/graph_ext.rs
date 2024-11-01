use petgraph::{adj::NodeIndex, Graph, Undirected};

pub trait GraphExt {
    fn min_degree(&self) -> usize;
    fn max_degree(&self) -> usize;
    fn induced(&self, nodes: &[NodeIndex]) -> Self;
}

impl<N, E> GraphExt for Graph<N, E, Undirected>
where
    N: Copy,
    E: Copy,
{
    fn min_degree(&self) -> usize {
        self.node_indices()
            .map(|node| self.neighbors(node).count())
            .min()
            .unwrap_or(0)
    }
    fn max_degree(&self) -> usize {
        self.node_indices()
            .map(|node| self.neighbors(node).count())
            .max()
            .unwrap_or(0)
    }
    fn induced(&self, nodes: &[NodeIndex]) -> Self {
        todo!()
    }
}
