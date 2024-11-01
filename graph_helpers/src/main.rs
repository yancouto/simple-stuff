use genpet::GengOption;

mod graph_ext;

use graph_ext::GraphExt;

fn main() {
    genpet::generate_graphs(12, .., &[GengOption::Connected])
        .expect("Failed to execute geng")
        .for_each(|g| println!("{:?}", g.min_degree()));
}
